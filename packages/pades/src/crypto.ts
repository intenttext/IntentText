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
import { requestTimestampToken, timestampTokenTime } from "./tsa.js";

const ID_AA_TIMESTAMP_TOKEN = "1.2.840.113549.1.9.16.2.14";

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
// Shared cert builder: subject signed by `signWith` (self-signed when omitted).
// `ca` adds basicConstraints cA + keyCertSign/cRLSign usage.
async function buildCert(opts: {
  commonName: string;
  organization?: string;
  days?: number;
  ca?: boolean;
  issuerName?: pkijs.RelativeDistinguishedNames;
  signWith?: CryptoKey;
}): Promise<GeneratedCert> {
  const keys = (await subtle.generateKey(ECDSA_ALG, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;

  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({
    value: Date.now() + Math.floor(performance.now()),
  });
  cert.subject = nameWith(opts.commonName, opts.organization);
  cert.issuer = opts.issuerName ?? cert.subject;

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + (opts.days ?? 825));
  cert.notBefore.value = now;
  cert.notAfter.value = end;

  cert.extensions = [
    new pkijs.Extension({
      extnID: "2.5.29.19",
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: !!opts.ca })
        .toSchema()
        .toBER(false),
    }),
    new pkijs.Extension({
      extnID: "2.5.29.15",
      critical: true,
      // CA: keyCertSign+cRLSign=0x06; leaf: digitalSignature+nonRepudiation=0xc0
      extnValue: new asn1js.BitString({
        valueHex: new Uint8Array([opts.ca ? 0x06 : 0xc0]).buffer,
      }).toBER(false),
    }),
  ];

  await cert.subjectPublicKeyInfo.importKey(keys.publicKey, cryptoEngine);
  await cert.sign(opts.signWith ?? keys.privateKey, HASH, cryptoEngine);

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

/**
 * Create an X.509 Certificate Authority (self-signed, cA:true) — the UTS root or
 * an intermediate. Keep the root key OFFLINE; issue an intermediate for online use.
 */
export async function createCertificateAuthority(opts: {
  commonName: string;
  organization?: string;
  days?: number;
}): Promise<GeneratedCert> {
  return buildCert({ ...opts, ca: true, days: opts.days ?? 3650 });
}

/**
 * Issue a certificate signed by a CA. Generates the subject keypair and returns
 * its cert+key plus the issuer cert as the chain. Set `isCa` for an intermediate
 * (root -> intermediate -> signer).
 */
export async function issueCertificate(opts: {
  issuer: { certificate: pkijs.Certificate; privateKey: CryptoKey };
  commonName: string;
  organization?: string;
  isCa?: boolean;
  days?: number;
}): Promise<GeneratedCert & { chain: pkijs.Certificate[]; chainPem: string }> {
  const leaf = await buildCert({
    commonName: opts.commonName,
    organization: opts.organization,
    days: opts.days,
    ca: opts.isCa,
    issuerName: opts.issuer.certificate.subject,
    signWith: opts.issuer.privateKey,
  });
  const issuerDer = new Uint8Array(
    opts.issuer.certificate.toSchema(true).toBER(false),
  );
  return {
    ...leaf,
    chain: [opts.issuer.certificate],
    chainPem: toPem(issuerDer, "CERTIFICATE"), // the issuer cert(s) above the leaf
  };
}

/**
 * Create a PKCS#10 Certification Request (CSR). The requester self-signs it to
 * prove possession of the private key; a CA later certifies only the PUBLIC key,
 * so the private key never leaves the requester — the correct custody model for a
 * notary/CA like UTS. Generates a fresh ECDSA P-256 keypair unless one is supplied.
 */
export async function createCsr(opts: {
  commonName: string;
  organization?: string;
  keyPair?: CryptoKeyPair;
}): Promise<{
  csrPem: string;
  csrDer: Uint8Array;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  /** PKCS#8 PEM of the requester's private key — kept by the requester, never sent. */
  privateKeyPem: string;
}> {
  const keys =
    opts.keyPair ??
    ((await subtle.generateKey(ECDSA_ALG, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair);

  const pkcs10 = new pkijs.CertificationRequest();
  pkcs10.version = 0;
  pkcs10.subject = nameWith(opts.commonName, opts.organization);
  await pkcs10.subjectPublicKeyInfo.importKey(keys.publicKey, cryptoEngine);
  await pkcs10.sign(keys.privateKey, HASH, cryptoEngine);

  const csrDer = new Uint8Array(pkcs10.toSchema().toBER(false));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", keys.privateKey));
  return {
    csrPem: toPem(csrDer, "CERTIFICATE REQUEST"),
    csrDer,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    privateKeyPem: toPem(pkcs8, "PRIVATE KEY"),
  };
}

/**
 * Issue a leaf certificate by signing a CSR with a CA — the UTS-as-CA path. The CA
 * validates the CSR's proof-of-possession signature, then certifies the requester's
 * public key under a subject the CA controls (`commonName` override — e.g. the
 * KYC-verified legal entity). The requester's private key is never seen, and NO
 * private key is returned (it stays with the requester). Returns the issued cert
 * plus the issuer chain, ready to embed in a CMS/PAdES signature.
 */
export async function issueCertificateFromCsr(opts: {
  issuer: { certificate: pkijs.Certificate; privateKey: CryptoKey };
  csrPem: string;
  /** CA-asserted subject CN. Omit to keep the CSR's own CN. */
  commonName?: string;
  organization?: string;
  days?: number;
  isCa?: boolean;
}): Promise<{
  certificate: pkijs.Certificate;
  certDer: Uint8Array;
  certPem: string;
  chain: pkijs.Certificate[];
  chainPem: string;
}> {
  const csrDer = pemToDer(opts.csrPem, "CERTIFICATE REQUEST");
  const asn1 = asn1js.fromBER(ab(csrDer));
  if (asn1.offset === -1) throw new Error("CSR is not valid DER");
  const pkcs10 = new pkijs.CertificationRequest({ schema: asn1.result });

  // Proof of possession: the CSR must be self-signed by the requester's key.
  const proofOk = await pkcs10.verify().catch(() => false);
  if (!proofOk) throw new Error("CSR proof-of-possession signature is invalid");

  // Subject CN: the CA's asserted identity overrides whatever the CSR claimed.
  let cn = opts.commonName;
  if (!cn) {
    const t = pkcs10.subject.typesAndValues.find((x) => x.type === "2.5.4.3");
    cn = (t?.value.valueBlock.value as string) || "Unknown";
  }

  const cert = new pkijs.Certificate();
  cert.version = 2;
  cert.serialNumber = new asn1js.Integer({
    value: Date.now() + Math.floor(performance.now()),
  });
  cert.subject = nameWith(cn, opts.organization);
  cert.issuer = opts.issuer.certificate.subject;

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + (opts.days ?? 825));
  cert.notBefore.value = now;
  cert.notAfter.value = end;

  cert.extensions = [
    new pkijs.Extension({
      extnID: "2.5.29.19",
      critical: true,
      extnValue: new pkijs.BasicConstraints({ cA: !!opts.isCa })
        .toSchema()
        .toBER(false),
    }),
    new pkijs.Extension({
      extnID: "2.5.29.15",
      critical: true,
      extnValue: new asn1js.BitString({
        valueHex: new Uint8Array([opts.isCa ? 0x06 : 0xc0]).buffer,
      }).toBER(false),
    }),
  ];

  // Certify the CSR's public key directly (no CryptoKey round-trip).
  cert.subjectPublicKeyInfo = pkcs10.subjectPublicKeyInfo;
  await cert.sign(opts.issuer.privateKey, HASH, cryptoEngine);

  const certDer = new Uint8Array(cert.toSchema(true).toBER(false));
  const issuerDer = new Uint8Array(
    opts.issuer.certificate.toSchema(true).toBER(false),
  );
  return {
    certificate: cert,
    certDer,
    certPem: toPem(certDer, "CERTIFICATE"),
    chain: [opts.issuer.certificate],
    chainPem: toPem(issuerDer, "CERTIFICATE"),
  };
}

export async function signerFromPem(
  certPem: string,
  privateKeyPem: string,
): Promise<{ certificate: pkijs.Certificate; privateKey: CryptoKey }> {
  return loadSigner(
    pemToDer(certPem, "CERTIFICATE"),
    pemToDer(privateKeyPem, "PRIVATE KEY"),
  );
}

/**
 * Parse a certificate from PEM into a pkijs.Certificate — the form a verifier uses
 * to pin a trust anchor (e.g. the UTS CA cert from /.well-known/uts-ca.pem) for
 * verifyPdfSignature / verifyDetachedCms `trustedRoots`.
 */
export function parseCertificatePem(certPem: string): pkijs.Certificate {
  const der = pemToDer(certPem, "CERTIFICATE");
  const asn1 = asn1js.fromBER(ab(der));
  if (asn1.offset === -1) throw new Error("Certificate is not valid PEM/DER");
  return new pkijs.Certificate({ schema: asn1.result });
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
  opts?: { tsaUrl?: string; chain?: pkijs.Certificate[] },
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
    certificates: [signer.certificate, ...(opts?.chain ?? [])],
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

  // PAdES-T: a trusted timestamp over the signature value (id-aa-timeStampToken
  // unsigned attribute) — proves the signature existed at time T.
  if (opts?.tsaUrl) {
    const sigValue = signedData.signerInfos[0].signature.valueBlock.valueHexView;
    const tst = await requestTimestampToken(new Uint8Array(sigValue), opts.tsaUrl);
    signedData.signerInfos[0].unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({
      type: 1,
      attributes: [
        new pkijs.Attribute({
          type: ID_AA_TIMESTAMP_TOKEN,
          values: [asn1js.fromBER(ab(tst)).result],
        }),
      ],
    });
  }

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
  /** True if a PAdES-T trusted timestamp (id-aa-timeStampToken) is present. */
  timestamped?: boolean;
  /** The TSA's asserted time (genTime), when timestamped. */
  timestampTime?: string;
  /** When trusted roots are supplied: did the cert chain validate to one? */
  chainValid?: boolean;
  reason?: string;
}

/** Verify a detached CMS SignedData over `data` (headless verification). */
export async function verifyDetachedCms(
  data: Uint8Array,
  cmsDer: Uint8Array,
  opts?: { trustedRoots?: pkijs.Certificate[] },
): Promise<CmsVerifyResult> {
  try {
    const asn1 = asn1js.fromBER(ab(cmsDer));
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    const signedData = new pkijs.SignedData({ schema: contentInfo.content });

    const asBool = (r: unknown) =>
      typeof r === "boolean"
        ? r
        : (r as { signatureVerified?: boolean }).signatureVerified === true;

    // Signature validity (no chain) — never throws for a well-formed CMS.
    const verified = asBool(
      await signedData.verify({ signer: 0, data: ab(data), checkChain: false }),
    );

    // Chain validity (only when trust anchors supplied). pkijs THROWS when the
    // chain can't be built to a trusted root, so guard it → chainValid:false.
    let chainValid: boolean | undefined;
    if (opts?.trustedRoots?.length) {
      try {
        chainValid = asBool(
          await signedData.verify({
            signer: 0,
            data: ab(data),
            checkChain: true,
            trustedCerts: opts.trustedRoots,
          }),
        );
      } catch {
        chainValid = false;
      }
    }

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

    // PAdES-T trusted timestamp (unsigned attribute), if present.
    let timestamped = false;
    let timestampTime: string | undefined;
    const tsAttr = signedData.signerInfos[0].unsignedAttrs?.attributes.find(
      (a) => a.type === ID_AA_TIMESTAMP_TOKEN,
    );
    if (tsAttr) {
      timestamped = true;
      timestampTime = timestampTokenTime(
        new Uint8Array((tsAttr.values[0] as asn1js.Sequence).toBER(false)),
      );
    }

    return {
      valid: !!verified,
      signerCommonName,
      signedAt,
      timestamped,
      timestampTime,
      chainValid,
    };
  } catch (e) {
    return { valid: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
