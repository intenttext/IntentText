// pdf.ts — embed a PAdES signature into a PDF buffer, and verify it headlessly.
//
// @signpdf handles the PDF byte mechanics (signature placeholder, /ByteRange,
// incremental update); our EcdsaCmsSigner (crypto.ts) produces the detached CMS
// that goes in /Contents. SubFilter ETSI.CAdES.detached = true PAdES.

import { SignPdf } from "@signpdf/signpdf";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { Signer, SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";
import * as pkijs from "pkijs";
import {
  signDetachedCms,
  verifyDetachedCms,
  type CmsVerifyResult,
} from "./crypto.js";

class EcdsaCmsSigner extends Signer {
  constructor(
    private readonly signer: {
      certificate: pkijs.Certificate;
      privateKey: CryptoKey;
    },
  ) {
    super();
  }
  // @signpdf calls this with the ByteRange-covered PDF bytes; return the CMS DER.
  async sign(pdfBuffer: Buffer): Promise<Buffer> {
    const cms = await signDetachedCms(new Uint8Array(pdfBuffer), this.signer);
    return Buffer.from(cms);
  }
}

export interface SignPdfOptions {
  certificate: pkijs.Certificate;
  privateKey: CryptoKey;
  /** Shown in the signature appearance / properties. */
  reason?: string;
  /** The signer's name (defaults to the cert common name shown by readers). */
  name?: string;
  location?: string;
  contactInfo?: string;
  /** Reserved bytes for the CMS in /Contents (ECDSA CMS is small; 8 KB is safe). */
  signatureLength?: number;
}

/**
 * Return a new PDF buffer with an embedded PAdES (ETSI.CAdES.detached) signature.
 * The input should be a finished PDF (e.g. from @dotit/pdf's renderPDF).
 */
export async function signPdf(
  pdf: Uint8Array,
  options: SignPdfOptions,
): Promise<Uint8Array> {
  const pdfBuffer = Buffer.from(pdf);
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: options.reason ?? "I approve this document",
    contactInfo: options.contactInfo ?? "",
    name: options.name ?? "",
    location: options.location ?? "",
    signatureLength: options.signatureLength ?? 8192,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });
  const signed = await new SignPdf().sign(
    withPlaceholder,
    new EcdsaCmsSigner({
      certificate: options.certificate,
      privateKey: options.privateKey,
    }),
  );
  return new Uint8Array(signed);
}

export interface PdfSignatureInfo extends CmsVerifyResult {
  /** True if a signature placeholder/dict was found at all. */
  present: boolean;
  /** True if the /ByteRange spans the whole file (no content appended after signing). */
  coversWholeFile: boolean;
}

/** Parse the FIRST signature's /ByteRange + /Contents from a signed PDF. */
function extractSignature(
  pdf: Uint8Array,
): { byteRange: number[]; signedBytes: Uint8Array; cms: Uint8Array } | null {
  const latin1 = Buffer.from(pdf).toString("latin1");
  const m = latin1.match(
    /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/,
  );
  if (!m) return null;
  const a = +m[1],
    b = +m[2],
    c = +m[3],
    d = +m[4];
  const buf = Buffer.from(pdf);
  const signedBytes = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]);
  // /Contents <hex…> lives in the gap between the two ranges.
  const gap = buf.subarray(a + b, c).toString("latin1");
  const hexMatch = gap.match(/<([0-9A-Fa-f]+)>/);
  if (!hexMatch) return null;
  const cms = Buffer.from(hexMatch[1], "hex"); // trailing zero-padding is ignored by the DER parser
  return { byteRange: [a, b, c, d], signedBytes: new Uint8Array(signedBytes), cms: new Uint8Array(cms) };
}

/**
 * Verify a signed PDF's first signature WITHOUT Adobe — checks the CMS verifies
 * over the /ByteRange bytes and that the range covers the whole file.
 */
export async function verifyPdfSignature(
  pdf: Uint8Array,
): Promise<PdfSignatureInfo> {
  const sig = extractSignature(pdf);
  if (!sig) {
    return { present: false, coversWholeFile: false, valid: false, reason: "no signature found" };
  }
  const [a, b, c, d] = sig.byteRange;
  const coversWholeFile = a === 0 && c + d === pdf.byteLength;
  const cms = await verifyDetachedCms(sig.signedBytes, sig.cms);
  return { present: true, coversWholeFile, ...cms };
}
