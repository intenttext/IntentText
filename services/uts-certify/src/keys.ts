/**
 * keys.ts — UTS authority key custody.
 *
 * The authority's Ed25519 PRIVATE key is the root of trust for every UTS
 * certification. It is NEVER stored in the database and NEVER returned by any
 * HTTP route — only the PUBLIC key is published (GET /pubkey,
 * /.well-known/uts-pubkey) so anyone can verify a `certify:` line offline.
 *
 * Custody is pluggable behind the `KeyProvider` interface:
 *
 *   - `EnvKeyProvider` (default): the raw private key is supplied out-of-band via
 *     the `UTS_PRIVATE_KEY` env var (sourced from a secret manager in prod). The
 *     public key is derived from it. In production a missing key is fatal; in dev
 *     an ephemeral key is generated and written to `.keys/uts.json` (gitignored)
 *     with a LOUD warning.
 *
 *   - `KmsKeyProvider` (seam, not implemented): for production deployments where
 *     the raw private key must NEVER enter the process — signing happens inside a
 *     KMS / HSM / Vault and only the public key is exposed here. See the stub
 *     below.
 *
 * In all cases the private key is handed only to @dotit/sign's signer; it is
 * never logged, persisted to Mongo, or served.
 */
import { generateSigningKey, publicKeyFor } from "@dotit/sign";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Collection } from "mongodb";
import type { AuthorityKeyDoc } from "./db.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_DIR = resolve(HERE, "..", ".keys");
const KEY_FILE = resolve(KEY_DIR, "uts.json");

/**
 * The custody seam. Everything in the service that needs to sign or publish the
 * authority key goes through this interface, so swapping env → KMS is a one-line
 * change in `getKeyProvider()`.
 */
export interface KeyProvider {
  /** The base64url Ed25519 private key, for handing to @dotit/sign's signer. */
  getPrivateKey(): string;
  /** The base64url Ed25519 public key, safe to publish. */
  getPublicKey(): string;
}

/**
 * Default provider: private key from `UTS_PRIVATE_KEY` (a secret-manager value in
 * production). The public key is always re-derived from the private key, so the
 * two can never drift.
 *
 * Behaviour when `UTS_PRIVATE_KEY` is absent:
 *   - production (`NODE_ENV === "production"`)  → FATAL throw with instructions.
 *   - anything else (dev/test)                  → generate an ephemeral key,
 *     persist to `.keys/uts.json` (gitignored, chmod 0600), and warn loudly.
 */
export class EnvKeyProvider implements KeyProvider {
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor() {
    const fromEnv = process.env.UTS_PRIVATE_KEY?.trim();
    if (fromEnv) {
      this.privateKey = fromEnv;
      this.publicKey = publicKeyFor(fromEnv);
      return;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        [
          "FATAL: UTS_PRIVATE_KEY is not set and NODE_ENV=production.",
          "The UTS authority private key must be supplied as a secret — it is the",
          "root of trust for every certification and must never be a committed file.",
          "",
          "  1. Generate a keypair:   pnpm --filter @dotit/uts-certify gen-key",
          "  2. Store the private key in your secret manager (AWS Secrets Manager,",
          "     GCP Secret Manager, Vault, ...) and inject it as UTS_PRIVATE_KEY.",
          "  3. Publish the PUBLIC key (GET /.well-known/uts-pubkey) to verifiers.",
          "",
          "For KMS-backed signing (private key never in the process), implement and",
          "select KmsKeyProvider in src/keys.ts.",
        ].join("\n"),
      );
    }

    // Dev/test fallback: ephemeral key, persisted so restarts are stable.
    const key = this.loadOrCreateDevKey();
    this.privateKey = key.privateKey;
    this.publicKey = key.publicKey;
    this.warnDevKey(this.publicKey);
  }

  private loadOrCreateDevKey(): { privateKey: string; publicKey: string } {
    if (existsSync(KEY_FILE)) {
      const raw = JSON.parse(readFileSync(KEY_FILE, "utf8")) as { privateKey?: string };
      if (!raw.privateKey) {
        throw new Error(`${KEY_FILE} exists but has no privateKey — refusing to overwrite.`);
      }
      return { privateKey: raw.privateKey, publicKey: publicKeyFor(raw.privateKey) };
    }
    const key = generateSigningKey();
    mkdirSync(KEY_DIR, { recursive: true });
    writeFileSync(KEY_FILE, JSON.stringify(key, null, 2));
    try {
      chmodSync(KEY_FILE, 0o600);
    } catch {
      /* best-effort on platforms without POSIX perms */
    }
    return key;
  }

  private warnDevKey(publicKey: string): void {
    console.warn(
      [
        "",
        "  ************************************************************************",
        "  *  DEV-ONLY UTS KEY — generated/loaded from .keys/uts.json             *",
        "  *  UTS_PRIVATE_KEY was not set, so an EPHEMERAL key is in use.          *",
        "  *  DO NOT use this in production. In production the private key MUST    *",
        "  *  come from a secret manager (UTS_PRIVATE_KEY) or a KMS provider —     *",
        "  *  never a file in the repo.                                           *",
        "  ************************************************************************",
        `  Public key: ${publicKey}`,
        "",
      ].join("\n"),
    );
  }

  getPrivateKey(): string {
    return this.privateKey;
  }
  getPublicKey(): string {
    return this.publicKey;
  }
}

/**
 * SEAM — KMS / HSM / Vault provider (NOT implemented).
 *
 * In production you typically do NOT want the raw private key in the Node
 * process at all. Instead the key lives inside a KMS (AWS KMS asymmetric key,
 * GCP KMS, HashiCorp Vault transit, a PKCS#11 HSM, ...) and signing is a remote
 * call: the process sends the payload, the KMS returns a signature.
 *
 * Wiring this up requires @dotit/sign to accept a `sign(payload) => signature`
 * callback (a `signer` seam) rather than a raw private key. That is a small,
 * deliberate extension point — when it lands, implement `getPrivateKey()` to
 * throw (the raw key is unavailable by design) and have certifyDocument route
 * through the KMS signer instead. Until then this stub documents the intent.
 *
 *   export class KmsKeyProvider implements KeyProvider {
 *     constructor(private readonly cfg: { keyId: string; region?: string }) {}
 *     getPublicKey(): string {
 *       // Fetch the public key once from the KMS and cache it.
 *       throw new Error("KmsKeyProvider not implemented");
 *     }
 *     getPrivateKey(): string {
 *       // By design the raw private key never leaves the KMS.
 *       throw new Error("KMS keys cannot be exported; sign via the KMS signer seam");
 *     }
 *   }
 */

/**
 * MongoKeyProvider — the authority keypair lives IN MongoDB, with the private
 * key sealed by AES-256-GCM **envelope encryption**: the database stores only
 * the ciphertext; the key-encryption-key (KEK) is the `UTS_KEK` env secret. So
 * "all keys live in MongoDB" (one DB to operate/back up) while staying secure —
 * a database dump alone cannot recover the signing key or forge certifications;
 * an attacker also needs the KEK, which never touches the DB. This is the same
 * envelope pattern a KMS uses (a data key wrapped by a master key); swapping to
 * a real KMS later leaves the Mongo wire format unchanged.
 *
 * Async by nature (reads/writes Mongo) — build via createKeyProvider() AFTER
 * connectDb(), then use the sync getPrivateKey/getPublicKey.
 */
function loadKek(): Buffer {
  const raw = process.env.UTS_KEK?.trim();
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) {
      throw new Error(
        "UTS_KEK must be 32 bytes, base64-encoded (a 256-bit AES key). Generate: " +
          "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
      );
    }
    return buf;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: UTS_KEK is not set and NODE_ENV=production. The KEK encrypts the " +
        "authority private key at rest in MongoDB; inject it from your secret " +
        "manager as UTS_KEK (32 bytes, base64).",
    );
  }
  const kekFile = resolve(KEY_DIR, "kek");
  if (existsSync(kekFile))
    return Buffer.from(readFileSync(kekFile, "utf8").trim(), "base64");
  const kek = randomBytes(32);
  mkdirSync(KEY_DIR, { recursive: true });
  writeFileSync(kekFile, kek.toString("base64"));
  try {
    chmodSync(kekFile, 0o600);
  } catch {
    /* best-effort */
  }
  console.warn(
    "  [dev] UTS_KEK not set — generated an ephemeral KEK in .keys/kek (gitignored). " +
      "Set UTS_KEK from a secret manager in production.",
  );
  return kek;
}

function sealPrivateKey(privateKey: string, kek: Buffer): AuthorityKeyDoc["enc"] {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kek, iv);
  const ct = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function openPrivateKey(enc: AuthorityKeyDoc["enc"], kek: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    kek,
    Buffer.from(enc.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  return (
    decipher.update(Buffer.from(enc.ct, "base64")).toString("utf8") +
    decipher.final("utf8")
  );
}

export class MongoKeyProvider implements KeyProvider {
  private constructor(
    private readonly privateKey: string,
    private readonly publicKey: string,
  ) {}

  static async create(
    coll: Collection<AuthorityKeyDoc>,
  ): Promise<MongoKeyProvider> {
    const kek = loadKek();
    const existing = await coll.findOne({ active: true });
    if (existing) {
      const privateKey = openPrivateKey(existing.enc, kek);
      // Re-derive the public key so it can't drift from / be tampered vs the
      // private key.
      return new MongoKeyProvider(privateKey, publicKeyFor(privateKey));
    }
    const key = generateSigningKey();
    const doc: AuthorityKeyDoc = {
      publicKey: key.publicKey,
      alg: "ed25519",
      enc: sealPrivateKey(key.privateKey, kek),
      active: true,
      createdAt: new Date(),
    };
    await coll.insertOne(doc);
    console.log(
      `  UTS authority key created in MongoDB (envelope-encrypted). Public key: ${key.publicKey}`,
    );
    return new MongoKeyProvider(key.privateKey, key.publicKey);
  }

  getPrivateKey(): string {
    return this.privateKey;
  }
  getPublicKey(): string {
    return this.publicKey;
  }
}

/**
 * Select the active provider.
 *   - "mongo" (default when a DB collection is supplied): key in Mongo,
 *     envelope-encrypted with UTS_KEK.
 *   - "env":  raw key from UTS_PRIVATE_KEY (EnvKeyProvider).
 *   - (future) "kms": KmsKeyProvider.
 * Override with UTS_KEY_PROVIDER.
 */
export async function createKeyProvider(
  authorityKeys?: Collection<AuthorityKeyDoc>,
): Promise<KeyProvider> {
  const mode = process.env.UTS_KEY_PROVIDER ?? (authorityKeys ? "mongo" : "env");
  if (mode === "mongo") {
    if (!authorityKeys) {
      throw new Error(
        "UTS_KEY_PROVIDER=mongo requires a connected DB (pass the authorityKeys collection).",
      );
    }
    return MongoKeyProvider.create(authorityKeys);
  }
  return new EnvKeyProvider();
}

/** Sync env-only provider (back-compat for env mode / tests). */
export function getKeyProvider(): KeyProvider {
  return new EnvKeyProvider();
}

export const KEY_FILE_PATH = KEY_FILE;
