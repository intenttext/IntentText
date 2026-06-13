/**
 * @dotit/sign — Ed25519 cryptographic signatures for IntentText (.it).
 *
 * This is the **identity** layer (Phase 2), opt-in on top of @dotit/core's
 * **integrity** seal:
 *
 *   @dotit/core  →  "has the content changed?"   (SHA-256, zero-dependency)
 *   @dotit/sign  →  "who signed it?"             (Ed25519, audited crypto)
 *
 * A cryptographic signature is **self-verifying and offline**: each `sign:` line
 * embeds both the Ed25519 signature and the signer's public key, so a `.it` file
 * carries everything needed to verify it — no server, no key lookup, no network.
 * What it proves: "the holder of public key K signed this exact content." What it
 * does NOT prove on its own: that K belongs to a particular real-world person —
 * binding a key to a verified identity is the job of UTS certification (Phase 3).
 *
 * Crypto is @noble/curves (audited, constant-time, sync, runs in Node + browser);
 * we never hand-roll signature math.
 */

import { ed25519 } from "@noble/curves/ed25519";
import { computeDocumentHash } from "@dotit/core";

// ─── Encoding helpers (base64url, dependency-free) ───────────────────────────

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin =
    typeof atob !== "undefined"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

// ─── Keys ────────────────────────────────────────────────────────────────────

export interface SigningKey {
  /** Ed25519 private key (keep secret), base64url, 32 bytes. */
  privateKey: string;
  /** Ed25519 public key (share / embed), base64url, 32 bytes. */
  publicKey: string;
}

/** Generate a fresh Ed25519 signing keypair. */
export function generateSigningKey(): SigningKey {
  const secretKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  return { privateKey: toB64url(secretKey), publicKey: toB64url(publicKey) };
}

/** Derive the public key from a base64url private key. */
export function publicKeyFor(privateKey: string): string {
  return toB64url(ed25519.getPublicKey(fromB64url(privateKey)));
}

// ─── What gets signed ────────────────────────────────────────────────────────

/**
 * The signing payload binds the signature to the exact document content AND to
 * the signer's stated identity at a stated time — so a signature can't be lifted
 * onto a different name/role or replayed with a different timestamp.
 */
function signingPayload(
  hash: string,
  signer: string,
  role: string,
  at: string,
): Uint8Array {
  return enc(`${hash}\n${signer}\n${role}\n${at}`);
}

// ─── Sign ────────────────────────────────────────────────────────────────────

export interface CryptoSignResult {
  success: boolean;
  source: string;
  at: string;
  publicKey: string;
  /** "already-signed" when this public key already signed (no-op). */
  note?: string;
}

/**
 * Add a cryptographic signature line to a document. Idempotent per public key:
 * signing again with the same key is a no-op (no duplicate lines). The resulting
 * `sign:` line carries `key:` (public key) and `sig:` (signature) fields, so the
 * document self-verifies.
 *
 * Signs over the current content hash, the signer name, role, and timestamp.
 */
export function signDocumentCrypto(
  source: string,
  options: { signer: string; role?: string; privateKey: string },
): CryptoSignResult {
  const at = new Date().toISOString();
  const role = options.role ?? "";
  const publicKey = publicKeyFor(options.privateKey);

  // Idempotent: skip if this public key already signed.
  const already = source
    .split("\n")
    .some((l) => l.trimStart().startsWith("sign:") && l.includes(publicKey));
  if (already) {
    return { success: true, source, at, publicKey, note: "already-signed" };
  }

  const hash = computeDocumentHash(source);
  const sig = ed25519.sign(
    signingPayload(hash, options.signer, role, at),
    fromB64url(options.privateKey),
  );

  const parts = [
    `sign: ${options.signer}`,
    role ? `role: ${role}` : null,
    `at: ${at}`,
    `hash: ${hash}`,
    `key: ed25519:${publicKey}`,
    `sig: ${toB64url(sig)}`,
  ].filter(Boolean);
  const signLine = parts.join(" | ");

  // Insert above freeze: if sealed, else above history:, else at end.
  const lines = source.replace(/\n+$/, "").split("\n");
  const freezeIdx = lines.findIndex((l) => l.trimStart().startsWith("freeze:"));
  const histIdx = lines.findIndex((l) => l.trim() === "history:");
  const insertAt =
    freezeIdx !== -1 ? freezeIdx : histIdx !== -1 ? histIdx : lines.length;
  lines.splice(insertAt, 0, signLine);
  return { success: true, source: lines.join("\n") + "\n", at, publicKey };
}

// ─── Verify ──────────────────────────────────────────────────────────────────

export interface SignatureCheck {
  signer: string;
  role?: string;
  at?: string;
  /** The embedded public key (ed25519:… stripped), base64url. */
  publicKey?: string;
  /** true only if the Ed25519 signature verifies against the CURRENT content. */
  valid: boolean;
  /** Present when this line carries crypto fields (key:+sig:). */
  cryptographic: boolean;
  /** Why it failed, when valid is false. */
  reason?: string;
}

/** Parse a `key: value | …` segment list from a sign: line body. */
function parseProps(line: string): Record<string, string> {
  const props: Record<string, string> = {};
  // Skip the keyword+content head (up to first " | "), then split props.
  const firstPipe = line.indexOf(" | ");
  const head = firstPipe === -1 ? line : line.slice(0, firstPipe);
  const rest = firstPipe === -1 ? "" : line.slice(firstPipe + 3);
  // content after "sign:" is the signer name
  props.__signer = head.replace(/^sign:\s*/, "").trim();
  for (const seg of rest.split(" | ")) {
    const i = seg.indexOf(":");
    if (i > 0) props[seg.slice(0, i).trim()] = seg.slice(i + 1).trim();
  }
  return props;
}

/**
 * Verify every cryptographic signature in a document against the CURRENT content.
 * Returns one entry per `sign:` line. Lines without `key:`+`sig:` are reported
 * with cryptographic:false (they are plain text approvals, integrity-only).
 *
 * A signature is `valid` only if the Ed25519 check passes over the current hash —
 * so editing the document after signing flips its signatures to invalid, exactly
 * as it should.
 */
export function verifyCryptoSignatures(source: string): SignatureCheck[] {
  const currentHash = computeDocumentHash(source);
  const out: SignatureCheck[] = [];

  for (const raw of source.split("\n")) {
    const line = raw.trimStart();
    if (!line.startsWith("sign:")) continue;
    const p = parseProps(line);
    const signer = p.__signer || "(unknown)";
    const role = p.role;
    const at = p.at;
    const keyField = p.key;
    const sigField = p.sig;

    if (!keyField || !sigField) {
      out.push({
        signer,
        role,
        at,
        valid: false,
        cryptographic: false,
        reason: "no cryptographic signature (text approval only)",
      });
      continue;
    }

    const publicKey = keyField.replace(/^ed25519:/, "");
    try {
      const ok = ed25519.verify(
        fromB64url(sigField),
        signingPayload(currentHash, signer, role ?? "", at ?? ""),
        fromB64url(publicKey),
      );
      out.push({
        signer,
        role,
        at,
        publicKey,
        cryptographic: true,
        valid: ok,
        reason: ok ? undefined : "signature does not match current content",
      });
    } catch (e) {
      out.push({
        signer,
        role,
        at,
        publicKey,
        cryptographic: true,
        valid: false,
        reason: `malformed signature: ${(e as Error).message}`,
      });
    }
  }
  return out;
}

export interface FullVerifyResult {
  /** Content integrity (from @dotit/core's seal), if the doc is sealed. */
  hash: string;
  /** Per-signature cryptographic checks. */
  signatures: SignatureCheck[];
  /** true if there is ≥1 cryptographic signature and ALL of them are valid. */
  allSignaturesValid: boolean;
  /** Count of valid cryptographic signatures. */
  validCount: number;
}

/** Convenience: hash + all signature checks in one call. */
export function verifyDocumentSignatures(source: string): FullVerifyResult {
  const signatures = verifyCryptoSignatures(source);
  const crypto = signatures.filter((s) => s.cryptographic);
  const validCount = crypto.filter((s) => s.valid).length;
  return {
    hash: computeDocumentHash(source),
    signatures,
    validCount,
    allSignaturesValid: crypto.length > 0 && validCount === crypto.length,
  };
}
