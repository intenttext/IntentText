import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { renderSignedPDF } from "../src/index";

/** Find a Chrome/Chromium binary (puppeteer cache or system) for the render step. */
function findChrome(): string | undefined {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH))
    return process.env.CHROME_PATH;
  const cache = join(homedir(), ".cache", "puppeteer", "chrome");
  if (existsSync(cache)) {
    for (const ver of readdirSync(cache)) {
      for (const sub of ["chrome-mac-x64", "chrome-mac-arm64", "chrome-linux64"]) {
        for (const bin of [
          "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
          "chrome",
        ]) {
          const p = join(cache, ver, sub, bin);
          if (existsSync(p)) return p;
        }
      }
    }
  }
  const sys = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return existsSync(sys) ? sys : undefined;
}

const chrome = findChrome();
const distBuilt = existsSync(resolve(__dirname, "../dist/index.js"));
const padesBuilt = existsSync(resolve(__dirname, "../../pades/dist/index.js"));

it("renderSignedPDF export exists", () => {
  expect(typeof renderSignedPDF).toBe("function");
});

// The render+sign path uses CJS require.resolve + dynamic ESM import, which behave
// correctly in real Node but not under vitest's Vite transform — so exercise the
// BUILT dist in a real Node process.
describe.skipIf(!chrome || !distBuilt || !padesBuilt)(
  "renderSignedPDF (built dist, real Node, real Chrome)",
  () => {
    it(
      "renders a sealed .it to a PAdES-signed PDF that verifies",
      () => {
        const pdfDist = resolve(__dirname, "../dist/index.js");
        const padesDist = resolve(__dirname, "../../pades/dist/index.js");
        const script = `
          const { renderSignedPDF } = require(${JSON.stringify(pdfDist)});
          const sealed = "title: Invoice INV-3003\\nmeta: | author: Dalil\\nfooter: Page {{page}} of {{pages}}\\npage: | size: A4\\nsection: Items\\ntext: Consulting | end: 1,200.00\\nsign: Dalil | at: 2026-06-15T00:00:00.000Z | hash: sha256:abc\\nfreeze: | at: 2026-06-15T00:00:00.000Z | hash: sha256:abc | status: locked\\n";
          (async () => {
            const pades = await import(${JSON.stringify(padesDist)});
            const id = await pades.generateSelfSignedCert({ commonName: "Dalil Technology", organization: "Dalil" });
            const signed = await renderSignedPDF(sealed, {
              executablePath: process.env.CHROME_BIN,
              launchArgs: ["--no-sandbox"],
              signer: { certPem: id.certPem, privateKeyPem: id.privateKeyPem, name: "Dalil Technology" },
            });
            const info = await pades.verifyPdfSignature(signed);
            process.stdout.write("RESULT:" + JSON.stringify({ header: Buffer.from(signed.subarray(0,5)).toString(), ...info }));
          })().catch(e => { process.stderr.write(String(e && e.message || e)); process.exit(1); });
        `;
        const out = execFileSync("node", ["-e", script], {
          env: { ...process.env, CHROME_BIN: chrome },
          encoding: "utf8",
          timeout: 60_000,
        });
        const info = JSON.parse(out.split("RESULT:")[1]);
        expect(info.header).toBe("%PDF-");
        expect(info.present).toBe(true);
        expect(info.valid).toBe(true);
        expect(info.coversWholeFile).toBe(true);
        expect(info.signerCommonName).toBe("Dalil Technology");
      },
      90_000,
    );
  },
);
