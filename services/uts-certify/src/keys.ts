/**
 * keys.ts — UTS authority key custody.
 *
 * The authority's Ed25519 PRIVATE key is the root of trust for every UTS
 * certification. It is generated once, on first run, and persisted to
 * `.keys/uts.json` (gitignored, chmod 0600). It is NEVER returned by any HTTP
 * route — only the PUBLIC key is published (GET /pubkey, /.well-known/uts-pubkey)
 * so anyone can verify a `certify:` line offline.
 *
 * Rotation: to rotate, move/delete `.keys/uts.json`, restart (a new keypair is
 * generated), and republish the new public key. Documents certified under the
 * old key keep verifying only for clients that still trust the old key — so in
 * production you publish a key history, not a single key. (Out of scope for the
 * reference impl.)
 */
import { generateSigningKey, publicKeyFor } from "@dotit/sign";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_DIR = resolve(HERE, "..", ".keys");
const KEY_FILE = resolve(KEY_DIR, "uts.json");

export interface AuthorityKey {
  privateKey: string;
  publicKey: string;
}

/**
 * Load the authority keypair, generating + persisting one on first run.
 * The private key never leaves this process except to @dotit/sign's signer.
 */
export function loadOrCreateAuthorityKey(): AuthorityKey {
  if (existsSync(KEY_FILE)) {
    const raw = JSON.parse(readFileSync(KEY_FILE, "utf8")) as Partial<AuthorityKey>;
    if (!raw.privateKey) {
      throw new Error(`${KEY_FILE} exists but has no privateKey — refusing to overwrite.`);
    }
    // Always re-derive the public key from the private key (single source of truth).
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

export const KEY_FILE_PATH = KEY_FILE;
