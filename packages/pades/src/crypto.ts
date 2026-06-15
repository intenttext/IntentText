// crypto.ts — the ECDSA P-256 + X.509 + CMS foundation for PAdES.
//
// PAdES signatures that Adobe/readers validate use X.509 certificates + a
// CMS/PKCS#7 SignedData (not @dotit/sign's native Ed25519). This module:
//   • generates a self-signed ECDSA P-256 certificate (V1 issuance), and
//   • builds / verifies a DETACHED CMS SignedData over arbitrary bytes
//     (the PDF ByteRange content), with the signed attributes PAdES needs
//     (content-type, message-digest, signing-time, signing-certificate-v2).
//
// It runs on Node's built-in WebCrypto (no extra crypto dependency).

import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import { webcrypto } from "node:crypto";

// pkijs needs a WebCrypto engine — Node's built-in one serves fine.
const cryptoEngine = new pkijs.CryptoEngine({
  name: "node-webcrypto",
  crypto: webcrypto as unknown as Crypto,
});
pkijs.setEngine("node-webcrypto", cryptoEngine);

const subtle = (webcrypto as unknown as Crypto).subtle;

/** Return a tight ArrayBuffer view of a Uint8Array (handles byteOffset/shared buffers). */
function ab(u8: Uint8Array): ArrayBuffer {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (u8.slice().buffer as ArrayBuffer);
}

const HASH = "SHA-256";
const ECDSA_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;

export interface GeneratedCert {
  /** The pkijs Certificate object. */
  certificate: pkijs.Certificate;
  /** DER bytes of the X.509 certificate. */
  certDer: Uint8Array;
  /** PKCS#8 DER bytes of the private key. */
  pkcs8: Uint8Array;
  /** The WebCrypto private key (usable for signing without re-import). */
  privateKey: CryptoKey;
  /** PEM forms (handy for storage / inspection). */
  certPem: string;
  privateKeyPem: string;
}

function toPem(der: Uint8Array, label: string): string {
  const b64 = Buffer.from(der).toString("base64").replace(/(.{64})/g, "$1\n");
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

function nameWith(cn: string, org?: string): pkijs.RelativeDistinguishedNames {
  const rdn = new pkijs.RelativeDistinguishedNames();
  rdn.typesAndValues.push(
    new pkijs.AttributeTypeAndValue({
      type: "2.5.4.3", // commonName
      value: new asn1js.Utf8String({ value: cn }),
    }),
  );
  if (org) {
    rdn.typesAndValues.push(
      new pkijs.AttributeTypeAndValue({
        type: "2.5.4.10", // organizationName
        value: new asn1js.Utf8String({ value: org }),
      }),
    );
  }
  return rdn;
}

/**
 * Generate a self-signed ECDSA P-256 signing certificate (V1 issuance — the
 * org vouches for itself; UTS-as-CA replaces this later). Marked for digital
 * signature + non-repudiation (the key usages PDF signing needs).
 */
export async function generateSelfSignedCert(opts: {
  commonName: string;
  organization?: string;
  /** Validity window in days (default 825 — the max many platforms accept). */
  days?: number;
}): Promise<GeneratedCert> {
  const keys = (await subtle.generateKey(ECDSA_ALG, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const cert = new pkijs.Certificate();
  cert.version = 2; // X.509 v3
  cert.serialNumber = new asn1js.Integer({ value: Date.now() });
  cert.subject = nameWith(opts.commonName, opts.organization);
  cert.issuer = nameWith(opts.commonName, opts.organization); // self-signed

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + (opts.days ?? 825));
  cert.notBefore.value = now;
  cert.notAfter.value = end;

  cert.extensions = [];
  // basicConstraints: cA = false
  cert.extensions.push(
    new pkijs.Extension({
      extnID: "2.5.29.19",
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: false }).toSchema().toBER(false),
    }),
  );
  // keyUsage: digitalSignature (bit 0) + nonRepudiation/contentCommitment (bit 1)
  const keyUsageBits = new Uint8Array([0xc0]); // 1100 0000
  cert.extensions.push(
    new pkijs.Extension({
      extnID: "2.5.29.15",
      critical: true,
      extnValue: new asn1js.BitString({ valueHex: keyUsageBits.buffer }).toBER(false),
    }),
  );

  await cert.subjectPublicKeyInfo.importKey(keys.publicKey, cryptoEngine);
  await cert.sign(keys.privateKey, HASH, cryptoEngine);

  const certDer = new Uint8Array(cert.toSchema(true).toBER(false));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", keys.privateKey));

  return {
    certificate: cert,
    certDer,
    pkcs8,
    privateKey: keys.privateKey,
    certPem: toPem(certDer, "CERTIFICATE"),
    privateKeyPem: toPem(pkcs8, "PRIVATE KEY"),
  };
}

function pemToDer(pem: string, label: string): Uint8Array {
  const body = pem
    .replace(new RegExp(`-----BEGIN ${label}-----`), "")
    .replace(new RegExp(`-----END ${label}-----`), "")
    .replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(body, "base64"));
}

/**
 * Load a signer from PEM strings (the persisted form — e.g. a signing identity
 * kept in the OS keychain). Pairs with generateSelfSignedCert's certPem/privateKeyPem.
 */
export async function signerFromPem(
  certPem: string,
  privateKeyPem: string,
): Promise<{ certificate: pkijs.Certificate; privateKey: CryptoKey }> {
  return loadSigner(
    pemToDer(certPem, "CERTIFICATE"),
    pemToDer(privateKeyPem, "PRIVATE KEY"),
  );
}

/** Load a certificate + private key from DER/PKCS#8 bytes (e.g. from storage). */
export async function loadSigner(
  certDer: Uint8Array,
  pkcs8: Uint8Array,
): Promise<{ certificate: pkijs.Certificate; privateKey: CryptoKey }> {
  const asn1 = asn1js.fromBER(ab(certDer));
  const certificate = new pkijs.Certificate({ schema: asn1.result });
  const privateKey = await subtle.importKey(
    "pkcs8",
    ab(pkcs8),
    ECDSA_ALG,
    false,
    ["sign"],
  );
  return { certificate, privateKey };
}

/**
 * Build a DETACHED CMS SignedData (PKCS#7) over `data`, ECDSA-SHA256, with the
 * signed attributes PAdES requires. Returns DER bytes suitable for a PDF
 * /Contents. `data` is the PDF's ByteRange-covered content.
 */
export async function signDetachedCms(
  data: Uint8Array,
  signer: { certificate: pkijs.Certificate; privateKey: CryptoKey },
): Promise<Uint8Array> {
  const messageDigest = await subtle.digest(HASH, ab(data));

  const signedData = new pkijs.SignedData({
    version: 1,
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: "1.2.840.113549.1.7.1", // id-data (detached: no eContent)
    }),
    signerInfos: [
      new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
          issuer: signer.certificate.issuer,
          serialNumber: signer.certificate.serialNumber,
        }),
      }),
    ],
    certificates: [signer.certificate],
  });

  // ESS signing-certificate-v2 (PAdES-B-B): binds the signature to THIS cert.
  const certHash = await subtle.digest(HASH, signer.certificate.toSchema(true).toBER(false));
  const essCertIDv2 = new asn1js.Sequence({
    value: [new asn1js.OctetString({ valueHex: certHash })],
  });
  const signingCertV2 = new asn1js.Sequence({
    value: [new asn1js.Sequence({ value: [essCertIDv2] })],
  });

  signedData.signerInfos[0].signedAttrs = new pkijs.SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.3", // content-type
        values: [new asn1js.ObjectIdentifier({ value: "1.2.840.113549.1.7.1" })],
      }),
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.5", // signing-time
        values: [new asn1js.UTCTime({ valueDate: new Date() })],
      }),
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.4", // message-digest
        values: [new asn1js.OctetString({ valueHex: messageDigest })],
      }),
      new pkijs.Attribute({
        type: "1.2.840.113549.1.9.16.2.47", // id-aa-signingCertificateV2
        values: [signingCertV2],
      }),
    ],
  });

  await signedData.sign(signer.privateKey, 0, HASH, undefined, cryptoEngine);

  const cmsContent = new pkijs.ContentInfo({
    contentType: "1.2.840.113549.1.7.2", // id-signedData
    content: signedData.toSchema(true),
  });
  return new Uint8Array(cmsContent.toSchema().toBER(false));
}

export interface CmsVerifyResult {
  valid: boolean;
  signerCommonName?: string;
  signedAt?: string;
  reason?: string;
}

/** Verify a detached CMS SignedData over `data` (headless verification). */
export async function verifyDetachedCms(
  data: Uint8Array,
  cmsDer: Uint8Array,
): Promise<CmsVerifyResult> {
  try {
    const asn1 = asn1js.fromBER(ab(cmsDer));
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    const signedData = new pkijs.SignedData({ schema: contentInfo.content });

    const ok = await signedData.verify({
      signer: 0,
      data: ab(data),
      checkChain: false,
    });

    const verified =
      typeof ok === "boolean"
        ? ok
        : (ok as { signatureVerified?: boolean }).signatureVerified === true;

    let signerCommonName: string | undefined;
    const cert = signedData.certificates?.[0];
    if (cert instanceof pkijs.Certificate) {
      const cn = cert.subject.typesAndValues.find((t) => t.type === "2.5.4.3");
      signerCommonName = cn?.value.valueBlock.value as string | undefined;
    }
    let signedAt: string | undefined;
    const stAttr = signedData.signerInfos[0].signedAttrs?.attributes.find(
      (a) => a.type === "1.2.840.113549.1.9.5",
    );
    if (stAttr) {
      const v = stAttr.values[0] as asn1js.UTCTime;
      signedAt = v.toDate().toISOString();
    }

    return { valid: !!verified, signerCommonName, signedAt };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
