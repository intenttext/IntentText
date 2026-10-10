// core 3.9.0 — the printed seal where the paper wants it, and a QR to verify it.
// CI-safe proofs; print-chrome.test.ts prints
// the same documents through real Chrome. Every QR is read back by two independent
// decoders (helpers/qr-decode.ts) and must return the exact bytes.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseIntentText, renderHTML, renderPrint, renderTrustBand, sealDocument } from "../src/index";
import { decodeJsQR, decodeZXing, modulesFromSvg, rasterModules } from "./helpers/qr-decode";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "print-fixtures", name), "utf8");
const sealed = (src: string) => sealDocument(src, { signer: "Billing", role: "Accounts" }).source;
const PAPERS = ["ar", "en"].map((lang) => ({ lang, src: sealed(fixture(`invoice-${lang}.it`)) }));

/** Every QR in `html`, decoded by both decoders (they must agree). */
function qrPayloads(html: string): string[] {
  return [...html.matchAll(/<svg[^>]*aria-label="QR code"[\s\S]*?<\/svg>/g)].map(([svg]) => {
    const { gray, width, height } = rasterModules(modulesFromSvg(svg));
    const z = decodeZXing(gray, width, height);
    expect(z, "ZXing").not.toBeNull();
    expect(decodeJsQR(gray, width, height), "jsQR").toEqual(z);
    return new TextDecoder().decode(Uint8Array.from(z as number[]));
  });
}

describe("seal: a QR in the trust band (verifyUrl)", () => {
  for (const { lang, src } of PAPERS) {
    it(`draws the verify link as a QR that decodes to it exactly (${lang})`, () => {
      const url = "https://example.qa/d/INV-0042/verify";
      const html = renderPrint(parseIntentText(src), { source: src, seal: { verifyUrl: url } });
      expect(html).toContain('<span class="it-trust-band__qr">');
      expect(qrPayloads(html)).toEqual([url]);
    });
  }

  it("a function receives the seal hash and date, computed at render time", () => {
    const src = PAPERS[1].src;
    const html = renderPrint(parseIntentText(src), {
      source: src,
      seal: { verifyUrl: ({ hash, at }) => `https://example.qa/v?h=${hash}&at=${at}` },
    });
    const [payload] = qrPayloads(html);
    const freeze = /^freeze: .*\| hash: (sha256:[0-9a-f]+)/m.exec(src)?.[1];
    const at = /^freeze: \| at: ([^ |]+)/m.exec(src)?.[1];
    expect(payload).toBe(`https://example.qa/v?h=${freeze}&at=${at}`);
  });

  it("an Arabic verify link decodes byte for byte (UTF-8)", () => {
    const url = "https://example.qa/تحقق/فاتورة-٤٢";
    const src = PAPERS[0].src;
    const html = renderPrint(parseIntentText(src), { source: src, seal: { verifyUrl: url } });
    expect(qrPayloads(html)).toEqual([url]);
  });

  it("renderTrustBand takes it directly, and renderHTML forwards it", () => {
    const url = "https://example.qa/d/1";
    expect(qrPayloads(renderTrustBand(PAPERS[1].src, { verifyUrl: url }))).toEqual([url]);
    const html = renderHTML(parseIntentText(PAPERS[1].src), {
      source: PAPERS[1].src,
      seal: { verifyUrl: url },
    });
    expect(qrPayloads(html)).toEqual([url]);
  });

  it("without verifyUrl the band is exactly what it was", () => {
    const band = renderTrustBand(PAPERS[1].src);
    expect(band).not.toContain("it-trust-band__qr");
    expect(band).toMatch(/^<div class="it-trust-band"><span class="it-trust-band__seal">/);
  });

  it("an unsigned document gets no band and no QR, whatever the option says", () => {
    const html = renderPrint(parseIntentText(fixture("invoice-en.it")), {
      seal: { verifyUrl: "https://example.qa/d/1" },
    });
    expect(html).not.toContain('<div class="it-trust-band');
  });
});

describe("seal: sealPosition", () => {
  for (const { lang, src } of PAPERS) {
    it(`"end" prints the band once, after the last block, in the flow (${lang})`, () => {
      const html = renderPrint(parseIntentText(src), { source: src, sealPosition: "end" });
      const body = html.slice(html.indexOf("<body"));
      expect(body.match(/<div class="it-trust-band"/g)).toHaveLength(1);
      expect(body).toMatch(/<div class="it-trust-band-end"><div class="it-trust-band">[\s\S]*<\/div><\/div><\/div><\/body>/);
      expect(html).not.toContain(".it-trust-band{position:fixed");
      expect(html).toContain(".it-trust-band-end{");
    });
  }

  it('"page" stays the default: pinned in the corner of every page', () => {
    const src = PAPERS[1].src;
    for (const html of [
      renderPrint(parseIntentText(src), { source: src }),
      renderPrint(parseIntentText(src), { source: src, sealPosition: "page" }),
    ]) {
      expect(html).toContain(".it-trust-band{position:fixed");
      expect(html).not.toContain('<div class="it-trust-band-end">');
    }
  });
});
