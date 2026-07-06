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
  signerFromPem,
  type CmsVerifyResult,
} from "./crypto.js";

class EcdsaCmsSigner extends Signer {
  constructor(
    private readonly signer: {
      certificate: pkijs.Certificate;
      privateKey: CryptoKey;
    },
    private readonly opts?: { tsaUrl?: string; chain?: pkijs.Certificate[] },
  ) {
    super();
  }
  // @signpdf calls this with the ByteRange-covered PDF bytes; return the CMS DER.
  async sign(pdfBuffer: Buffer): Promise<Buffer> {
    const cms = await signDetachedCms(new Uint8Array(pdfBuffer), this.signer, {
      tsaUrl: this.opts?.tsaUrl,
      chain: this.opts?.chain,
    });
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
  /** RFC-3161 TSA URL — when set, adds a PAdES-T trusted timestamp. */
  tsaUrl?: string;
  /** Issuer/intermediate certs to embed (chain to a trusted CA, e.g. UTS). */
  chain?: pkijs.Certificate[];
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
  // A timestamped CMS (sig + cert + ~6 KB TST) needs more room than a bare one.
  const reserve = options.signatureLength ?? (options.tsaUrl ? 24576 : 8192);
  const withPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: options.reason ?? "I approve this document",
    contactInfo: options.contactInfo ?? "",
    name: options.name ?? "",
    location: options.location ?? "",
    signatureLength: reserve,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
  });
  const signed = await new SignPdf().sign(
    withPlaceholder,
    new EcdsaCmsSigner(
      {
        certificate: options.certificate,
        privateKey: options.privateKey,
      },
      { tsaUrl: options.tsaUrl, chain: options.chain },
    ),
  );
  return new Uint8Array(signed);
}

/**
 * Sign a PDF using a persisted PEM identity (cert + private key) — the convenient
 * entry point for the desktop/CLI, which stores the identity in the OS keychain.
 */
export async function signPdfWithPem(
  pdf: Uint8Array,
  options: {
    certPem: string;
    privateKeyPem: string;
    reason?: string;
    name?: string;
    location?: string;
    contactInfo?: string;
    tsaUrl?: string;
    signatureLength?: number;
  },
): Promise<Uint8Array> {
  const signer = await signerFromPem(options.certPem, options.privateKeyPem);
  return signPdf(pdf, {
    certificate: signer.certificate,
    privateKey: signer.privateKey,
    reason: options.reason,
    name: options.name,
    location: options.location,
    contactInfo: options.contactInfo,
    tsaUrl: options.tsaUrl,
    signatureLength: options.signatureLength,
  });
}

export interface PdfSignatureInfo extends CmsVerifyResult {
  /** True if a signature placeholder/dict was found at all. */
  present: boolean;
  /** True if the /ByteRange spans the whole file (no content appended after signing). */
  coversWholeFile: boolean;
  /** How many signatures the PDF carries. When > 1, this result is only the FIRST —
   *  use verifyAllPdfSignatures to verify every approver (finding #41). */
  signatureCount?: number;
}

type RawSig = { byteRange: number[]; signedBytes: Uint8Array; cms: Uint8Array };

/** Parse EVERY signature's /ByteRange + /Contents from a signed PDF (in file order). */
function extractAllSignatures(pdf: Uint8Array): RawSig[] {
  const latin1 = Buffer.from(pdf).toString("latin1");
  const buf = Buffer.from(pdf);
  const re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  const out: RawSig[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin1)) !== null) {
    const a = +m[1],
      b = +m[2],
      c = +m[3],
      d = +m[4];
    const signedBytes = Buffer.concat([
      buf.subarray(a, a + b),
      buf.subarray(c, c + d),
    ]);
    // /Contents <hex…> lives in the gap between the two ranges.
    const hexMatch = buf.subarray(a + b, c).toString("latin1").match(/<([0-9A-Fa-f]+)>/);
    if (!hexMatch) continue;
    out.push({
      byteRange: [a, b, c, d],
      signedBytes: new Uint8Array(signedBytes),
      cms: new Uint8Array(Buffer.from(hexMatch[1], "hex")),
    });
  }
  return out;
}

/** Parse the FIRST signature's /ByteRange + /Contents from a signed PDF. */
function extractSignature(pdf: Uint8Array): RawSig | null {
  return extractAllSignatures(pdf)[0] ?? null;
}

/**
 * Verify a signed PDF's first signature WITHOUT Adobe — checks the CMS verifies
 * over the /ByteRange bytes and that the range covers the whole file.
 */
export async function verifyPdfSignature(
  pdf: Uint8Array,
  opts?: { trustedRoots?: pkijs.Certificate[] },
): Promise<PdfSignatureInfo> {
  const sig = extractSignature(pdf);
  if (!sig) {
    return { present: false, coversWholeFile: false, valid: false, reason: "no signature found" };
  }
  const all = extractAllSignatures(pdf);
  const [a, b, c, d] = sig.byteRange;
  const coversWholeFile = a === 0 && c + d === pdf.byteLength;
  const cms = await verifyDetachedCms(sig.signedBytes, sig.cms, opts);
  return { present: true, coversWholeFile, signatureCount: all.length, ...cms };
}

export interface PdfMultiSignatureInfo {
  present: boolean;
  /** Number of signatures found. */
  count: number;
  /** Every signature verifies (CMS math) AND covers the whole file. */
  allValid: boolean;
  /** Per-signature verdict, in file order (approver 1, 2, …). */
  signatures: PdfSignatureInfo[];
}

/**
 * Verify EVERY signature in a PDF — not just the first (finding #41). A multi-approver
 * PDF (several `sign:` parties) carries one signature dictionary per approver, each with
 * its own /ByteRange; `verifyPdfSignature` checks only the first, so a later approver's
 * broken/appended signature would go unnoticed. This verifies each and reports per-signer.
 */
export async function verifyAllPdfSignatures(
  pdf: Uint8Array,
  opts?: { trustedRoots?: pkijs.Certificate[] },
): Promise<PdfMultiSignatureInfo> {
  const sigs = extractAllSignatures(pdf);
  if (sigs.length === 0) {
    return { present: false, count: 0, allValid: false, signatures: [] };
  }
  const signatures: PdfSignatureInfo[] = [];
  for (const s of sigs) {
    const [a, b, c, d] = s.byteRange;
    const coversWholeFile = a === 0 && c + d === pdf.byteLength;
    const cms = await verifyDetachedCms(s.signedBytes, s.cms, opts);
    signatures.push({
      present: true,
      coversWholeFile,
      signatureCount: sigs.length,
      ...cms,
    });
  }
  return {
    present: true,
    count: signatures.length,
    allValid: signatures.every((r) => r.valid && r.coversWholeFile),
    signatures,
  };
}
