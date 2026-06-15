// CLI for @dotit/pades — create a signing identity, PAdES-sign a PDF, and verify.
// Usage (via the `dotit-pades` bin):
//   dotit-pades identity --cn "Acme Corp" [--org Acme] --out identity.json
//   dotit-pades sign in.pdf out.pdf --identity identity.json [--tsa <url>] [--name X] [--reason Y]
//   dotit-pades verify in.pdf
import { readFile, writeFile } from "node:fs/promises";
import {
  generateSelfSignedCert,
  signPdfWithPem,
  verifyPdfSignature,
} from "./index.js";

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

export async function main(argv: string[]): Promise<number> {
  const cmd = argv[0];

  if (cmd === "identity") {
    const cn = flag(argv, "cn");
    if (!cn) {
      console.error("dotit-pades identity --cn <commonName> [--org <org>] [--out <file>]");
      return 1;
    }
    const id = await generateSelfSignedCert({
      commonName: cn,
      organization: flag(argv, "org"),
    });
    const json = JSON.stringify(
      { commonName: cn, certPem: id.certPem, privateKeyPem: id.privateKeyPem },
      null,
      2,
    );
    const out = flag(argv, "out");
    if (out) {
      await writeFile(out, json);
      console.error(`identity written to ${out} (keep the private key secret)`);
    } else {
      console.log(json);
    }
    return 0;
  }

  if (cmd === "sign") {
    const input = argv[1];
    const output = argv[2];
    const idFile = flag(argv, "identity");
    if (!input || !output || !idFile) {
      console.error(
        "dotit-pades sign <in.pdf> <out.pdf> --identity <identity.json> [--tsa <url>] [--name X] [--reason Y]",
      );
      return 1;
    }
    const id = JSON.parse(await readFile(idFile, "utf8")) as {
      certPem: string;
      privateKeyPem: string;
      commonName?: string;
    };
    const pdf = new Uint8Array(await readFile(input));
    const signed = await signPdfWithPem(pdf, {
      certPem: id.certPem,
      privateKeyPem: id.privateKeyPem,
      name: flag(argv, "name") ?? id.commonName,
      reason: flag(argv, "reason"),
      tsaUrl: flag(argv, "tsa"),
    });
    await writeFile(output, signed);
    console.error(`signed → ${output} (${signed.byteLength} bytes)`);
    return 0;
  }

  if (cmd === "verify") {
    const input = argv[1];
    if (!input) {
      console.error("dotit-pades verify <in.pdf>");
      return 1;
    }
    const info = await verifyPdfSignature(new Uint8Array(await readFile(input)));
    console.log(JSON.stringify(info, null, 2));
    return info.valid ? 0 : 2;
  }

  console.error(
    "dotit-pades <identity|sign|verify> — see https://github.com/intenttext/IntentText",
  );
  return cmd ? 1 : 0;
}
