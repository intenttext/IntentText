// @dotit/pades — export a sealed IntentText document as a PAdES-signed PDF
// (ECDSA P-256 + X.509 + CMS) that Adobe/readers recognize. The standards
// bridge on top of @dotit/sign's native Ed25519 trust: `.it` stays Ed25519 +
// queryable; the exported PDF carries the legally-recognized PAdES signature.

export {
  generateSelfSignedCert,
  createCertificateAuthority,
  issueCertificate,
  createCsr,
  issueCertificateFromCsr,
  loadSigner,
  signerFromPem,
  signDetachedCms,
  verifyDetachedCms,
} from "./crypto.js";
export type { GeneratedCert, CmsVerifyResult } from "./crypto.js";

export { signPdf, signPdfWithPem, verifyPdfSignature } from "./pdf.js";
export type { SignPdfOptions, PdfSignatureInfo } from "./pdf.js";

export { requestTimestampToken, timestampTokenTime, PUBLIC_TSA } from "./tsa.js";
