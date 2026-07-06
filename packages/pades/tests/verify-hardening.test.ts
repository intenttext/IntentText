import { describe, it, expect } from "vitest";
import {
  generateSelfSignedCert,
  signDetachedCms,
  verifyDetachedCms,
  signPdfWithPem,
  verifyPdfSignature,
  verifyAllPdfSignatures,
} from "../src/index";

function minimalPdf(): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => (body += String(off).padStart(10, "0") + " 00000 n \n"));
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

// #43: verification never checked the signing cert's validity window or keyUsage, so a
// signature from an EXPIRED cert read as fully valid.
describe("#43: certificate validity is verified", () => {
  const data = new TextEncoder().encode("bank-payload");

  it("flags an EXPIRED signing certificate (CMS math still verifies)", async () => {
    const expired = await generateSelfSignedCert({ commonName: "Old", days: -1 });
    const v = await verifyDetachedCms(data, await signDetachedCms(data, expired));
    expect(v.valid).toBe(true); // the signature math is fine…
    expect(v.certExpired).toBe(true); // …but the cert was expired at signing time
    expect(v.reason).toMatch(/validity window/i);
  });

  it("a fresh certificate is not expired and its keyUsage permits signing", async () => {
    const c = await generateSelfSignedCert({ commonName: "Fresh" });
    const v = await verifyDetachedCms(data, await signDetachedCms(data, c));
    expect(v.certExpired).toBe(false);
    expect(v.keyUsageValid).toBe(true);
  });
});

// #41: only the first signature was verified. verifyAllPdfSignatures enumerates every
// signature dictionary and verifies each; verifyPdfSignature reports how many exist.
describe("#41: all PDF signatures are enumerated + verified", () => {
  it("verifyAllPdfSignatures verifies each; verifyPdfSignature reports the count", async () => {
    const c = await generateSelfSignedCert({ commonName: "Signer" });
    const signed = await signPdfWithPem(minimalPdf(), {
      certPem: c.certPem,
      privateKeyPem: c.privateKeyPem,
      name: "Signer",
    });

    const first = await verifyPdfSignature(signed);
    expect(first.present).toBe(true);
    expect(first.signatureCount).toBe(1);

    const all = await verifyAllPdfSignatures(signed);
    expect(all.present).toBe(true);
    expect(all.count).toBe(1);
    expect(all.signatures[0].valid).toBe(true);
    expect(all.allValid).toBe(all.signatures.every((s) => s.valid && s.coversWholeFile));
  });

  it("reports present:false for an unsigned PDF", async () => {
    const all = await verifyAllPdfSignatures(minimalPdf());
    expect(all.present).toBe(false);
    expect(all.count).toBe(0);
  });
});
