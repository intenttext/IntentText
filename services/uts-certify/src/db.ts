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
  createdAt: Date;
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
}

export interface Collections {
  accounts: Collection<AccountDoc>;
  apiKeys: Collection<ApiKeyDoc>;
  certifications: Collection<CertificationDoc>;
  authorityKeys: Collection<AuthorityKeyDoc>;
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

  await Promise.all([
    accounts.createIndex({ account: 1 }, { unique: true }),
    apiKeys.createIndex({ keyHash: 1 }, { unique: true }),
    apiKeys.createIndex({ prefix: 1 }),
    certifications.createIndex({ account: 1, createdAt: -1 }),
    authorityKeys.createIndex({ active: 1 }),
  ]);

  collections = { accounts, apiKeys, certifications, authorityKeys };
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
