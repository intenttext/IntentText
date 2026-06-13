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

/** Select the active provider. Swap here to move to KMS in production. */
export function getKeyProvider(): KeyProvider {
  // const mode = process.env.UTS_KEY_PROVIDER; // "env" | "kms"
  // if (mode === "kms") return new KmsKeyProvider({ keyId: process.env.UTS_KMS_KEY_ID! });
  return new EnvKeyProvider();
}

export const KEY_FILE_PATH = KEY_FILE;
