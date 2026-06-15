// identity.ts — the desktop's cryptographic signing identity.
//
// A signing identity is an Ed25519 keypair plus a display name/role. The PRIVATE
// key lives only in the OS keychain (see src-tauri/src/commands/identity.rs); the
// rest of the app deals with this typed object. Signing a document with the
// identity produces a real `sign: … | key: ed25519:… | sig: …` line that
// verifies — unlike the legacy plaintext "on record" sign.

import { generateSigningKey, signDocumentCrypto } from "@dotit/sign";
import { identityGet, identitySet, identityClear, isTauri } from "./backend";

export interface SigningIdentity {
  name: string;
  role?: string;
  /** Ed25519 private key (base64url) — kept in the OS keychain, never in a doc. */
  privateKey: string;
  /** Ed25519 public key (base64url) — the shareable identity. */
  publicKey: string;
  createdAt: string;
}

/** Load the stored signing identity, or null if none exists / not in Tauri. */
export async function loadIdentity(): Promise<SigningIdentity | null> {
  if (!isTauri) return null;
  try {
    const raw = await identityGet();
    if (!raw) return null;
    const id = JSON.parse(raw) as SigningIdentity;
    if (!id.privateKey || !id.publicKey) return null;
    return id;
  } catch {
    return null;
  }
}

/** Create + persist a new signing identity (fresh keypair). */
export async function createIdentity(
  name: string,
  role?: string,
): Promise<SigningIdentity> {
  const kp = generateSigningKey();
  const id: SigningIdentity = {
    name: name.trim(),
    role: role?.trim() || undefined,
    privateKey: kp.privateKey,
    publicKey: kp.publicKey,
    createdAt: new Date().toISOString(),
  };
  await identitySet(JSON.stringify(id));
  return id;
}

/** Update the display name/role on the existing identity (keeps the keypair). */
export async function updateIdentityProfile(
  id: SigningIdentity,
  name: string,
  role?: string,
): Promise<SigningIdentity> {
  const next: SigningIdentity = {
    ...id,
    name: name.trim(),
    role: role?.trim() || undefined,
  };
  await identitySet(JSON.stringify(next));
  return next;
}

/** Forget the signing identity (removes the private key from the keychain). */
export async function resetIdentity(): Promise<void> {
  if (!isTauri) return;
  await identityClear();
}

/**
 * Cryptographically sign `source` with the identity — returns the new source
 * carrying a verifiable Ed25519 `sign:` line. Idempotent per key (signing twice
 * with the same identity is a no-op in @dotit/sign).
 */
export function signWithIdentity(
  source: string,
  id: SigningIdentity,
): string {
  const r = signDocumentCrypto(source, {
    signer: id.name,
    role: id.role,
    privateKey: id.privateKey,
  });
  return r.source;
}
