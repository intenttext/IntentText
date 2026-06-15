/**
 * x509ca.ts — UTS X.509 Certificate Authority (the PAdES / Adobe-recognized chain).
 *
 * This is a SECOND, separate trust root from the native Ed25519 authority in
 * keys.ts. Adobe Reader, courts, and most government e-signature stacks validate
 * PAdES PDF signatures against X.509 / ECDSA certificates — NOT Ed25519. So when a
 * customer exports a sealed `.it` as a PAdES-signed PDF, the embedded signature
 * must chain to an X.509 CA. UTS runs that CA here (ECDSA P-256), signing leaf
 * certificates for KYC-verified accounts.
 *
 * Custody — the right model for a CA issuing SIGNING certs:
 *   • the customer generates their OWN keypair and sends a CSR (proof of
 *     possession). UTS certifies only the PUBLIC key, so the signing private key
 *     never reaches this service (see @dotit/pades issueCertificateFromCsr).
 *   • the CA's own private key signs those leaf certs. It is published ONLY as the
 *     CA CERTIFICATE (public) at GET /.well-known/uts-ca.pem, which verifiers add
 *     to their trust store (and, eventually, Adobe's AATL once UTS is enrolled).
 *
 * The CA cert/key custody mirrors keys.ts EnvKeyProvider:
 *   • production: UTS_X509_CA_CERT + UTS_X509_CA_KEY (PEM, from a secret manager);
 *     a missing key is fatal.
 *   • dev/test:   generated once and persisted to .keys/uts-x509-ca.json
 *     (gitignored, chmod 0600) with a LOUD warning.
 *
 * Native `.it` trust stays Ed25519 + queryable; this X.509 CA is purely the
 * export bridge to the PAdES world.
 */
import {
  createCertificateAuthority,
  signerFromPem,
  issueCertificateFromCsr,
} from "@dotit/pades";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_DIR = resolve(HERE, "..", ".keys");
const CA_FILE = resolve(KEY_DIR, "uts-x509-ca.json");

/** The loaded CA signer (cert + private key) — type inferred to avoid a direct
 *  pkijs / DOM-lib dependency in this service's tsconfig. */
type CaSigner = Awaited<ReturnType<typeof signerFromPem>>;

/** A CA cert + private key, both PEM. The key half is a secret. */
export interface X509CaMaterial {
  certPem: string;
  privateKeyPem: string;
}

/** The custody seam for the X.509 CA — env, dev-file, or (future) Mongo/KMS. */
export interface X509CaProvider {
  /** True once a CA is loaded (issuance is possible). */
  ready(): boolean;
  /** The CA CERTIFICATE (public) — published for verifiers' trust stores. */
  getCaCertPem(): string;
  /**
   * Issue a leaf signing certificate for `commonName` (the KYC-verified entity)
   * by certifying the public key inside `csrPem`. The requester's private key is
   * never seen. Returns the leaf cert + the chain (the CA cert) as PEM, plus the
   * public identifying details of the leaf for the issuance log.
   */
  issueLeaf(opts: {
    csrPem: string;
    commonName: string;
    organization?: string;
    days?: number;
  }): Promise<IssuedLeaf>;
}

/** What issueLeaf returns: the PEMs plus public identifying details of the leaf. */
export interface IssuedLeaf {
  certPem: string;
  chainPem: string;
  /** Hex serial number of the issued cert. */
  serial: string;
  /** sha256 hex fingerprint of the leaf cert DER. */
  fingerprint: string;
  notBefore: string;
  notAfter: string;
}

/** Read CA material from env (PEM). Returns null when not configured. */
function fromEnv(): X509CaMaterial | null {
  const certPem = process.env.UTS_X509_CA_CERT?.trim();
  const keyPem = process.env.UTS_X509_CA_KEY?.trim();
  if (certPem && keyPem) {
    // env vars often carry escaped newlines — restore real PEM line breaks.
    return {
      certPem: certPem.replace(/\\n/g, "\n"),
      privateKeyPem: keyPem.replace(/\\n/g, "\n"),
    };
  }
  if (certPem || keyPem) {
    throw new Error(
      "X.509 CA misconfigured: set BOTH UTS_X509_CA_CERT and UTS_X509_CA_KEY (PEM).",
    );
  }
  return null;
}

/** Dev/test: load the persisted CA, else generate + persist one (gitignored). */
async function loadOrCreateDevCa(): Promise<X509CaMaterial> {
  if (existsSync(CA_FILE)) {
    const raw = JSON.parse(readFileSync(CA_FILE, "utf8")) as Partial<X509CaMaterial>;
    if (!raw.certPem || !raw.privateKeyPem) {
      throw new Error(`${CA_FILE} exists but is missing certPem/privateKeyPem — refusing to overwrite.`);
    }
    return { certPem: raw.certPem, privateKeyPem: raw.privateKeyPem };
  }
  const ca = await createCertificateAuthority({
    commonName: "UTS Certificate Authority (DEV)",
    organization: "UTS",
    days: 3650,
  });
  const material: X509CaMaterial = {
    certPem: ca.certPem,
    privateKeyPem: ca.privateKeyPem,
  };
  mkdirSync(KEY_DIR, { recursive: true });
  writeFileSync(CA_FILE, JSON.stringify(material, null, 2));
  try {
    chmodSync(CA_FILE, 0o600);
  } catch {
    /* best-effort on platforms without POSIX perms */
  }
  warnDevCa();
  return material;
}

function warnDevCa(): void {
  console.warn(
    [
      "",
      "  ************************************************************************",
      "  *  DEV-ONLY UTS X.509 CA — generated in .keys/uts-x509-ca.json         *",
      "  *  UTS_X509_CA_CERT / UTS_X509_CA_KEY were not set, so an EPHEMERAL CA  *",
      "  *  is in use. DO NOT use this in production — leaf certs it issues will *",
      "  *  not chain to a CA any verifier trusts. In production supply the CA   *",
      "  *  cert+key from a secret manager (key OFFLINE / HSM ideally).          *",
      "  ************************************************************************",
      "",
    ].join("\n"),
  );
}

/**
 * The default X.509 CA provider. Loads CA material from env (production) or a
 * generated dev file, then keeps the loaded CA signer in memory. Issuance signs a
 * CSR with the CA key — the customer's signing key never enters the process.
 */
export class EnvX509CaProvider implements X509CaProvider {
  private caCertPem = "";
  private signer: CaSigner | null = null;

  private constructor() {}

  /** Build the provider, loading CA material. Async (may generate a dev CA). */
  static async create(): Promise<EnvX509CaProvider> {
    const self = new EnvX509CaProvider();
    const env = fromEnv();
    let material: X509CaMaterial | null = env;
    if (!material) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          [
            "FATAL: no X.509 CA configured and NODE_ENV=production.",
            "The UTS X.509 CA signs the PAdES certs customers use to sign PDFs;",
            "its key must come from a secret manager, never a committed file.",
            "",
            "  1. Provision a CA:  pnpm --filter @dotit/uts-certify x509:init",
            "  2. Store UTS_X509_CA_KEY (PEM) in your secret manager; keep the root",
            "     key OFFLINE and issue an online intermediate if possible.",
            "  3. Publish the CA cert (GET /.well-known/uts-ca.pem) to verifiers.",
          ].join("\n"),
        );
      }
      material = await loadOrCreateDevCa();
    }
    self.caCertPem = material.certPem;
    self.signer = await signerFromPem(material.certPem, material.privateKeyPem);
    return self;
  }

  ready(): boolean {
    return this.signer !== null;
  }

  getCaCertPem(): string {
    return this.caCertPem;
  }

  async issueLeaf(opts: {
    csrPem: string;
    commonName: string;
    organization?: string;
    days?: number;
  }): Promise<IssuedLeaf> {
    if (!this.signer) throw new Error("X.509 CA is not initialized");
    const issued = await issueCertificateFromCsr({
      issuer: this.signer,
      csrPem: opts.csrPem,
      commonName: opts.commonName,
      organization: opts.organization,
      days: opts.days,
    });
    const serialHex = Buffer.from(
      issued.certificate.serialNumber.valueBlock.valueHexView,
    ).toString("hex");
    const fingerprint = createHash("sha256")
      .update(Buffer.from(issued.certDer))
      .digest("hex");
    return {
      certPem: issued.certPem,
      chainPem: issued.chainPem,
      serial: serialHex || "0",
      fingerprint,
      notBefore: issued.certificate.notBefore.value.toISOString(),
      notAfter: issued.certificate.notAfter.value.toISOString(),
    };
  }
}

/**
 * Build the active X.509 CA provider, or return null if the platform is told to
 * run WITHOUT X.509 issuance (UTS_X509=off) — in which case the /certify/x509
 * routes report 503 and the rest of the service is unaffected.
 */
export async function createX509CaProvider(): Promise<X509CaProvider | null> {
  if ((process.env.UTS_X509 ?? "").toLowerCase() === "off") return null;
  return EnvX509CaProvider.create();
}
