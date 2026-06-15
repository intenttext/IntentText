/**
 * db.ts — MongoDB-backed persistence for the UTS certification service.
 *
 * The operator runs their OWN MongoDB (one engine, many uses) and points the
 * service at it via `MONGODB_URI`. The service owns its collections inside
 * `DB_NAME` (default "uts") and creates the required indexes on connect, so a
 * fresh database needs no manual setup.
 *
 * Collections:
 *   - uts_accounts        — one doc per account (the billing/identity subject).
 *   - uts_api_keys        — one doc per minted API key (stored HASHED, never raw).
 *   - uts_certifications  — append-only audit log, one doc per issued cert.
 *
 * The authority PRIVATE key is NEVER stored here — see src/keys.ts.
 */
import { MongoClient, type Db, type Collection } from "mongodb";

/** The account: the subject a certification is issued on behalf of. */
export interface AccountDoc {
  /** Stable URL-safe slug, stamped into the certify: line (e.g. "acme-corp"). */
  account: string;
  /** Human label for dashboards / logs. */
  label: string;
  /** KYC-verified legal name (Phase 3b). null until verified. */
  entity: string | null;
  /** True once identity has been verified; gates whether entity is embedded. */
  entityVerified: boolean;
  /** Commercial registration number (KYC artifact), or null. */
  cr: string | null;
  /** Plan slug (billing — Phase 3c). */
  plan: string;
  createdAt: Date;
}

/** A minted API key. The plaintext is shown once and never stored. */
export interface ApiKeyDoc {
  /** sha256 hex of the plaintext key — the only persisted form. */
  keyHash: string;
  /** First ~8 chars of the plaintext, for display/identification only. */
  prefix: string;
  /** The account this key certifies for. */
  account: string;
  label: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revoked: boolean;
}

/** Append-only audit record of an issued certification. */
export interface CertificationDoc {
  account: string;
  /** The verified legal name embedded at issue time, or null. */
  entity: string | null;
  /** sha256:… content hash that was certified. */
  hash: string;
  /** Issuer name (e.g. "UTS"). */
  issuer: string;
  /** ISO timestamp embedded in the certify: line. */
  at: string;
  /** The signing (intermediate) public key that issued this cert — lets a whole
   *  key's output be revoked at once if that key is ever compromised. */
  issuerKey?: string;
  createdAt: Date;
}

/**
 * A revocation: a certification (by content hash) or an entire signing key that
 * should no longer be trusted. /verify consults this, and it is published (signed)
 * at /revocations so offline verifiers can pin it.
 */
export interface RevocationDoc {
  /** "hash" revokes one certified content hash; "key" revokes a signing key. */
  kind: "hash" | "key";
  /** sha256:… content hash (kind="hash") or the ed25519 public key (kind="key"). */
  value: string;
  issuer: string;
  reason: string;
  /** ISO instant the revocation takes effect. */
  revokedAt: string;
  /** Admin token prefix / identifier that issued the revocation (audit). */
  revokedBy: string;
  createdAt: Date;
}

/**
 * Append-only audit trail of privileged + security-relevant actions (account
 * creation, KYC verification, key mint/revoke, ICA provisioning, revocations).
 * Tamper-evidence is by being append-only + (optionally) WORM storage in prod.
 */
export interface AuditDoc {
  /** Event type, e.g. "account.create", "key.revoke", "cert.revoke". */
  action: string;
  /** Who performed it — admin token prefix or API-key prefix. */
  actor: string;
  /** Subject of the action (account slug, key prefix, hash…). */
  subject: string;
  /** Arbitrary structured detail (no secrets). */
  meta: Record<string, unknown>;
  ip: string;
  at: Date;
}

/**
 * The UTS authority keypair, persisted in Mongo. The public key is stored in the
 * clear (it's published anyway); the private key is stored ONLY as an
 * AES-256-GCM ciphertext (envelope encryption) whose key-encryption-key (KEK)
 * lives in the `UTS_KEK` env secret — so a database breach alone cannot recover
 * the signing key or forge certifications.
 */
export interface AuthorityKeyDoc {
  publicKey: string;
  alg: "ed25519";
  /** AES-256-GCM envelope of the base64url private key. */
  enc: { v: 1; alg: "aes-256-gcm"; iv: string; ct: string; tag: string };
  active: boolean;
  createdAt: Date;
  /**
   * The role of this key in the root→intermediate hierarchy. The online service's
   * key is the "intermediate" (it signs daily certifications). Optional for
   * backward compatibility — docs written before the hierarchy lack this field and
   * are treated as intermediate (legacy single-key). The "root" never lives here:
   * it is offline (see scripts/root-ca.mjs).
   */
  role?: "intermediate" | "root";
  /**
   * The provisioned ICA token (root's signed vouch for THIS key as an
   * intermediate). When present and matching this key, every certification chains
   * to the root. Absent in legacy single-key mode. Issued offline by the root CLI
   * and POSTed to /admin/intermediate-cert (or supplied via UTS_ICA).
   */
  intermediateCert?: string;
}

/**
 * Append-only record of an X.509 leaf certificate issued by the UTS CA (the PAdES
 * chain). The CA certifies a customer-held public key from a CSR — UTS never sees
 * the signing private key — so this log records only public material: who it was
 * issued to, the subject CN, the cert serial + sha256 fingerprint, and validity.
 */
export interface X509CertDoc {
  /** Account the cert was issued for. */
  account: string;
  /** Subject common name on the leaf (the KYC-verified legal entity). */
  commonName: string;
  /** Decimal serial number of the issued cert. */
  serial: string;
  /** sha256 hex fingerprint of the leaf cert DER. */
  fingerprint: string;
  /** ISO notBefore / notAfter of the leaf. */
  notBefore: string;
  notAfter: string;
  createdAt: Date;
}

export interface Collections {
  accounts: Collection<AccountDoc>;
  apiKeys: Collection<ApiKeyDoc>;
  certifications: Collection<CertificationDoc>;
  authorityKeys: Collection<AuthorityKeyDoc>;
  revocations: Collection<RevocationDoc>;
  audit: Collection<AuditDoc>;
  x509Certs: Collection<X509CertDoc>;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let collections: Collections | null = null;

/**
 * Connect to MongoDB and ensure collections + indexes exist. Idempotent: safe to
 * call once at startup. Returns the typed collection handles.
 */
export async function connectDb(): Promise<Collections> {
  if (collections) return collections;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Point the service at your MongoDB, e.g. " +
        'MONGODB_URI="mongodb://localhost:27017" (see .env.example).',
    );
  }
  const dbName = process.env.DB_NAME ?? "uts";

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  const accounts = db.collection<AccountDoc>("uts_accounts");
  const apiKeys = db.collection<ApiKeyDoc>("uts_api_keys");
  const certifications = db.collection<CertificationDoc>("uts_certifications");
  const authorityKeys = db.collection<AuthorityKeyDoc>("uts_authority_keys");
  const revocations = db.collection<RevocationDoc>("uts_revocations");
  const audit = db.collection<AuditDoc>("uts_audit");
  const x509Certs = db.collection<X509CertDoc>("uts_x509_certs");

  await Promise.all([
    accounts.createIndex({ account: 1 }, { unique: true }),
    apiKeys.createIndex({ keyHash: 1 }, { unique: true }),
    apiKeys.createIndex({ prefix: 1 }),
    certifications.createIndex({ account: 1, createdAt: -1 }),
    authorityKeys.createIndex({ active: 1 }),
    revocations.createIndex({ kind: 1, value: 1 }, { unique: true }),
    audit.createIndex({ at: -1 }),
    x509Certs.createIndex({ account: 1, createdAt: -1 }),
    x509Certs.createIndex({ fingerprint: 1 }),
  ]);

  collections = { accounts, apiKeys, certifications, authorityKeys, revocations, audit, x509Certs };
  return collections;
}

/** True once connectDb has succeeded (used by /health). */
export function isConnected(): boolean {
  return collections !== null;
}

/** Get the connected collections, or throw if connectDb hasn't run. */
export function getCollections(): Collections {
  if (!collections) throw new Error("Database not connected — call connectDb() first.");
  return collections;
}

/** Close the connection (tests / graceful shutdown). */
export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
  collections = null;
}
