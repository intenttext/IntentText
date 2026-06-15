import { describe, it, expect } from "vitest";
import {
  generateSelfSignedCert,
  createCertificateAuthority,
  issueCertificate,
  signDetachedCms,
  verifyDetachedCms,
  signPdf,
  signPdfWithPem,
  verifyPdfSignature,
  PUBLIC_TSA,
} from "../src/index.js";

/** A correct minimal 1-page PDF with proper xref offsets (signable by @signpdf). */
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
  body += `xref\n0 ${objs.length + 1}\n`;
  body += "0000000000 65535 f \n";
  offsets.forEach((off) => {
    body += String(off).padStart(10, "0") + " 00000 n \n";
  });
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe("ECDSA P-256 + X.509 + CMS foundation", () => {
  it("generates a self-signed ECDSA cert", async () => {
    const c = await generateSelfSignedCert({
      commonName: "Dalil Technology",
      organization: "Dalil",
    });
    expect(c.certPem).toContain("BEGIN CERTIFICATE");
    expect(c.privateKeyPem).toContain("BEGIN PRIVATE KEY");
    expect(c.certDer.byteLength).toBeGreaterThan(200);
  });

  it("CMS sign → verify round-trips, and rejects tampered data", async () => {
    const c = await generateSelfSignedCert({ commonName: "Notary" });
    const data = new TextEncoder().encode("the bytes that get signed");
    const cms = await signDetachedCms(data, c);

    const ok = await verifyDetachedCms(data, cms);
    expect(ok.valid).toBe(true);
    expect(ok.signerCommonName).toBe("Notary");
    expect(ok.signedAt).toBeTruthy();

    const tampered = new TextEncoder().encode("the bytes that got changed");
    const bad = await verifyDetachedCms(tampered, cms);
    expect(bad.valid).toBe(false);
  });
});

describe("PAdES PDF signing", () => {
  it("signs a PDF and verifies the embedded signature headlessly", async () => {
    const c = await generateSelfSignedCert({
      commonName: "Sarah Al-Ahmad",
      organization: "Dalil Technology",
    });
    const pdf = minimalPdf();
    const signed = await signPdf(pdf, {
      certificate: c.certificate,
      privateKey: c.privateKey,
      reason: "Vendor onboarding approval",
      name: "Sarah Al-Ahmad",
    });

    // it's still a PDF, and it grew (placeholder + signature added)
    expect(Buffer.from(signed.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(signed.byteLength).toBeGreaterThan(pdf.byteLength);

    const info = await verifyPdfSignature(signed);
    expect(info.present).toBe(true);
    expect(info.valid).toBe(true);
    expect(info.coversWholeFile).toBe(true);
    expect(info.signerCommonName).toBe("Sarah Al-Ahmad");
  });

  it("signs via a persisted PEM identity (desktop/CLI path)", async () => {
    const c = await generateSelfSignedCert({ commonName: "Notary One" });
    // persist + reload as PEM (what the keychain stores)
    const signed = await signPdfWithPem(minimalPdf(), {
      certPem: c.certPem,
      privateKeyPem: c.privateKeyPem,
      reason: "Approved",
      name: "Notary One",
    });
    const info = await verifyPdfSignature(signed);
    expect(info.valid).toBe(true);
    expect(info.coversWholeFile).toBe(true);
    expect(info.signerCommonName).toBe("Notary One");
  });

  it(
    "PAdES-T: adds a trusted RFC-3161 timestamp via a TSA",
    async (ctx) => {
      const c = await generateSelfSignedCert({ commonName: "Notary T" });
      let signed: Uint8Array;
      try {
        signed = await signPdf(minimalPdf(), {
          certificate: c.certificate,
          privateKey: c.privateKey,
          tsaUrl: PUBLIC_TSA.digicert,
        });
      } catch {
        ctx.skip(); // TSA/network unavailable — skip rather than fail CI
        return;
      }
      const info = await verifyPdfSignature(signed);
      expect(info.valid).toBe(true);
      expect(info.timestamped).toBe(true);
      expect(info.timestampTime).toBeTruthy();
    },
    30_000,
  );

  it("UTS-as-CA: signer cert chains to a trusted CA root", async () => {
    const ca = await createCertificateAuthority({
      commonName: "UTS Root CA",
      organization: "UTS",
    });
    const signer = await issueCertificate({
      issuer: { certificate: ca.certificate, privateKey: ca.privateKey },
      commonName: "Dalil Technology",
      organization: "Dalil",
    });
    const signed = await signPdf(minimalPdf(), {
      certificate: signer.certificate,
      privateKey: signer.privateKey,
      chain: signer.chain, // embed the CA cert so verifiers can build the path
    });

    // trusting the CA root → chain validates
    const trusted = await verifyPdfSignature(signed, {
      trustedRoots: [ca.certificate],
    });
    expect(trusted.valid).toBe(true);
    expect(trusted.chainValid).toBe(true);
    expect(trusted.signerCommonName).toBe("Dalil Technology");

    // signature still verifies without a trust anchor (chainValid just undefined)
    const noAnchor = await verifyPdfSignature(signed);
    expect(noAnchor.valid).toBe(true);
    expect(noAnchor.chainValid).toBeUndefined();

    // a DIFFERENT CA is not trusted → chain fails
    const otherCa = await createCertificateAuthority({ commonName: "Other CA" });
    const untrusted = await verifyPdfSignature(signed, {
      trustedRoots: [otherCa.certificate],
    });
    expect(untrusted.chainValid).toBe(false);
  });

  it("detects a tampered signed PDF", async () => {
    const c = await generateSelfSignedCert({ commonName: "X" });
    const signed = await signPdf(minimalPdf(), {
      certificate: c.certificate,
      privateKey: c.privateKey,
    });
    // flip a byte in the signed content region (near the top, inside ByteRange)
    const tampered = Uint8Array.from(signed);
    tampered[20] = tampered[20] ^ 0xff;
    const info = await verifyPdfSignature(tampered);
    expect(info.valid).toBe(false);
  });
});
