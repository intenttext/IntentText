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

// ─── UTS Certification (Phase 3 — the authority layer) ───────────────────────
//
// A signature (above) proves "the holder of key K signed this." A CERTIFICATION
// is issued by a trust authority (UTS) and proves "authority A attests that this
// exact content existed at time T, from account N." Timestamp-first: it gives
// provable TIME (and, once the authority does KYC at onboarding, a vouched
// identity for the account). It is the same Ed25519 machinery — the difference
// is custody: the authority's private key lives only on the authority's server,
// and its PUBLIC key is published so anyone can verify offline.
//
// Embedded as a `certify:` line:
//   certify: UTS | account: acme-corp | entity: Acme Corp WLL | at: <iso> | hash: sha256:… | key: ed25519:<utsPub> | sig: <sig>
// The authority signs over (hash, issuer, account, entity, at), so a token can't
// be lifted to a different document, account, identity, or time. `entity` is the
// KYC-verified legal name (Phase 3b) — empty when the account isn't identity-
// verified yet (timestamp-only certification).

function certPayload(
  hash: string,
  issuer: string,
  account: string,
  entity: string,
  at: string,
): Uint8Array {
  return enc(`certify\n${hash}\n${issuer}\n${account}\n${entity}\n${at}`);
}

export interface CertifyResult {
  source: string;
  at: string;
  issuer: string;
  account: string;
  entity?: string;
  /** "already-certified" when this issuer already certified the current hash. */
  note?: string;
}

/**
 * Issue a certification over a document's current content hash. Run by the
 * AUTHORITY (UTS) with its private key — never by the document author. Idempotent
 * per (issuer, current hash): re-certifying unchanged content by the same issuer
 * is a no-op.
 */
export function certifyDocument(
  source: string,
  options: {
    issuer: string;
    account: string;
    /** KYC-verified legal name (Phase 3b). Omit for timestamp-only. */
    entity?: string;
    issuerPrivateKey: string;
    /** Override the timestamp (testing/determinism); defaults to now. */
    at?: string;
  },
): CertifyResult {
  const hash = computeDocumentHash(source);
  const issuerKey = publicKeyFor(options.issuerPrivateKey);
  const entity = options.entity ?? "";
  const already = source.split("\n").some((l) => {
    const t = l.trimStart();
    return (
      t.startsWith("certify:") && l.includes(options.issuer) && l.includes(hash)
    );
  });
  if (already) {
    return {
      source,
      at: "",
      issuer: options.issuer,
      account: options.account,
      entity: options.entity,
      note: "already-certified",
    };
  }
  const at = options.at ?? new Date().toISOString();
  const sig = ed25519.sign(
    certPayload(hash, options.issuer, options.account, entity, at),
    fromB64url(options.issuerPrivateKey),
  );
  const line = [
    `certify: ${options.issuer}`,
    `account: ${options.account}`,
    entity ? `entity: ${entity}` : null,
    `at: ${at}`,
    `hash: ${hash}`,
    `key: ed25519:${issuerKey}`,
    `sig: ${toB64url(sig)}`,
  ]
    .filter(Boolean)
    .join(" | ");

  // Certifications sit just above the freeze: line if sealed, else above
  // history:, else at the end — alongside the seal metadata.
  const lines = source.replace(/\n+$/, "").split("\n");
  const freezeIdx = lines.findIndex((l) => l.trimStart().startsWith("freeze:"));
  const histIdx = lines.findIndex((l) => l.trim() === "history:");
  const insertAt =
    freezeIdx !== -1 ? freezeIdx : histIdx !== -1 ? histIdx : lines.length;
  lines.splice(insertAt, 0, line);
  return {
    source: lines.join("\n") + "\n",
    at,
    issuer: options.issuer,
    account: options.account,
    entity: options.entity,
  };
}

export interface CertificationCheck {
  issuer: string;
  account?: string;
  /** KYC-verified legal name, when the account is identity-verified (Phase 3b). */
  entity?: string;
  at?: string;
  /** The embedded issuer public key (ed25519:… stripped). */
  publicKey?: string;
  /** true only if the issuer's signature verifies AND its key is trusted. */
  valid: boolean;
  /** true if the signature is cryptographically valid (regardless of trust). */
  signatureValid: boolean;
  /** true if the embedded key matches a key in trustedIssuers. */
  trusted: boolean;
  reason?: string;
}

/**
 * Verify every `certify:` line against the CURRENT content. `trustedIssuers`
 * maps an issuer name → its published public key (base64url). A certification is
 * `valid` only if the signature verifies AND the embedded key matches the
 * trusted key for that issuer — so a forged "UTS" line with a different key is
 * rejected. With no trustedIssuers, signatureValid is still reported but
 * trusted/valid are false (you can't trust a key you don't know).
 */
export function verifyCertifications(
  source: string,
  trustedIssuers: Record<string, string> = {},
): CertificationCheck[] {
  const currentHash = computeDocumentHash(source);
  const out: CertificationCheck[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trimStart();
    if (!line.startsWith("certify:")) continue;
    const p = parseProps(line);
    const issuer = (line.match(/^certify:\s*([^|]*)/)?.[1] || "").trim();
    const account = p.account;
    const entity = p.entity;
    const at = p.at;
    const keyField = p.key;
    const sigField = p.sig;
    if (!keyField || !sigField) {
      out.push({
        issuer,
        account,
        entity,
        at,
        valid: false,
        signatureValid: false,
        trusted: false,
        reason: "certification missing key/sig",
      });
      continue;
    }
    const publicKey = keyField.replace(/^ed25519:/, "");
    let signatureValid = false;
    try {
      signatureValid = ed25519.verify(
        fromB64url(sigField),
        certPayload(currentHash, issuer, account ?? "", entity ?? "", at ?? ""),
        fromB64url(publicKey),
      );
    } catch {
      signatureValid = false;
    }
    const trustedKey = trustedIssuers[issuer];
    const trusted = !!trustedKey && trustedKey === publicKey;
    out.push({
      issuer,
      account,
      entity,
      at,
      publicKey,
      signatureValid,
      trusted,
      valid: signatureValid && trusted,
      reason: !signatureValid
        ? "signature does not match current content"
        : !trusted
          ? trustedKey
            ? "issuer key does not match the trusted key (possible forgery)"
            : "issuer not in trusted set"
          : undefined,
    });
  }
  return out;
}
