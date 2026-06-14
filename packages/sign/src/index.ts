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
import {
  computeDocumentHash,
  computeDocumentHashLegacy,
  assertNotTemplate,
} from "@dotit/core";

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
  // Validate before decoding: a malformed key/signature must raise a clear error
  // (callers treat a throw as "invalid"), not silently produce garbage bytes that
  // could make a verification quietly fail or, worse, appear to pass.
  if (typeof s !== "string" || s.length === 0) {
    throw new Error("invalid base64url: empty");
  }
  if (!/^[A-Za-z0-9_-]+$/.test(s)) {
    throw new Error("invalid base64url: unexpected characters");
  }
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  let bin: string;
  try {
    bin =
      typeof atob !== "undefined"
        ? atob(b64)
        : Buffer.from(b64, "base64").toString("binary");
  } catch {
    throw new Error("invalid base64url: decode failed");
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Decode a base64url Ed25519 key and assert its length. Ed25519 public/private
// keys are exactly 32 bytes; anything else is rejected rather than handed to the
// curve implementation.
function decodeEd25519Key(b64: string, label: string): Uint8Array {
  const k = fromB64url(b64);
  if (k.length !== 32) {
    throw new Error(`invalid ${label}: expected 32 bytes, got ${k.length}`);
  }
  return k;
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
  // Templates are outside the trust workflow — a signature over placeholder
  // content would break the moment the template is merged.
  assertNotTemplate(source, "signed");
  const at = new Date().toISOString();
  const role = options.role ?? "";
  const publicKey = publicKeyFor(options.privateKey);

  // Idempotent: skip if this public key already signed. Parse the key: field
  // rather than a substring match — otherwise the public key merely *appearing*
  // anywhere in the document body (e.g. quoted in content) would block signing.
  const already = source.split("\n").some((l) => {
    const line = l.trimStart();
    if (!line.startsWith("sign:")) return false;
    const k = (parseProps(line).key || "").replace(/^ed25519:/, "");
    return k === publicKey;
  });
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
  // Accept the legacy (pre-NFC-normalization) hash too, so signatures made before
  // Unicode normalization still verify against unchanged content.
  const legacyHash = computeDocumentHashLegacy(source);
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
      const pub = decodeEd25519Key(publicKey, "public key");
      const sig = fromB64url(sigField);
      const payloadFor = (h: string) =>
        signingPayload(h, signer, role ?? "", at ?? "");
      const ok =
        ed25519.verify(sig, payloadFor(currentHash), pub) ||
        ed25519.verify(sig, payloadFor(legacyHash), pub);
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
    /**
     * The intermediate certificate (ICA token) issued OFFLINE by the root,
     * vouching for this signing key (see issueIntermediate). When present, the
     * certify line chains to the root: verifiers trust the ROOT public key, and
     * `issuerPrivateKey` here is the INTERMEDIATE key. Omit for the legacy
     * single-key model (the signing key is trusted directly).
     */
    intermediateCert?: string;
  },
): CertifyResult {
  // Templates are outside the trust workflow — never certify a blueprint.
  assertNotTemplate(source, "certified");
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
    options.intermediateCert ? `ica: ${options.intermediateCert}` : null,
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
  /**
   * Present when the certification chains to a root via an intermediate cert
   * (the `ica:` field). Reports the root that anchors trust and the validity
   * window of the intermediate that actually signed.
   */
  chain?: {
    rootPublicKey: string;
    notBefore?: string;
    notAfter?: string;
  };
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
    // Trust decision — two models, chosen by whether the line carries `ica:`.
    //  (a) CHAINED (preferred): an `ica:` intermediate certificate is present.
    //      The signing key is an INTERMEDIATE vouched-for by the root. We trust
    //      the ROOT (trustedIssuers[issuer] = root public key), verify the root's
    //      signature over the intermediate, that the intermediate IS the signing
    //      key, and that `at` falls inside the intermediate's validity window.
    //      Self-contained and fully offline — the doc carries the whole chain.
    //  (b) LEGACY: no `ica:`; the signing key must itself be the trusted key.
    let trusted = false;
    let chain: CertificationCheck["chain"];
    let reason: string | undefined;
    if (p.ica) {
      const vr = verifyIntermediateCert(p.ica, trustedIssuers, at);
      const keyMatches = vr.intermediatePublicKey === publicKey;
      trusted = vr.valid && keyMatches;
      if (vr.valid) {
        chain = {
          rootPublicKey: vr.rootPublicKey!,
          notBefore: vr.notBefore,
          notAfter: vr.notAfter,
        };
      }
      reason = !signatureValid
        ? "signature does not match current content"
        : !vr.valid
          ? `intermediate certificate not trusted: ${vr.reason}`
          : !keyMatches
            ? "signing key is not the key vouched for by the intermediate certificate"
            : undefined;
    } else {
      const trustedKey = trustedIssuers[issuer];
      trusted = !!trustedKey && trustedKey === publicKey;
      reason = !signatureValid
        ? "signature does not match current content"
        : !trusted
          ? trustedKey
            ? "issuer key does not match the trusted key (possible forgery)"
            : "issuer not in trusted set"
          : undefined;
    }

    out.push({
      issuer,
      account,
      entity,
      at,
      publicKey,
      signatureValid,
      trusted,
      valid: signatureValid && trusted,
      chain,
      reason,
    });
  }
  return out;
}

// ─── Root → Intermediate hierarchy (offline root, online issuing key) ─────────
//
// A flat model trusts ONE key directly: the key that signs certifications is the
// key in every verifier's trust store. That key must therefore be online (it
// signs daily) AND irreplaceable (it's the trust anchor) — a contradiction. One
// process compromise = total compromise, and rotation means re-rooting every
// verifier.
//
// The fix is the same hierarchy a Certificate Authority (offline root CA →
// online issuing CA) and a Stellar asset (cold issuer → hot distribution) use:
//
//   ROOT key          OFFLINE (HSM / air-gapped). In every trust store. Signs
//                     ONLY intermediates, rarely. Never touches the service.
//        │  issueIntermediate()  ← run offline, output = an ICA token
//        ▼
//   INTERMEDIATE key  ONLINE. Signs the daily certifications. If it leaks, the
//                     root revokes it and issues a new one — the root (in the
//                     trust stores) never moves, so no ecosystem-wide re-root.
//
// The intermediate certificate ("ICA token") is the root's signed statement
// "I, root R, vouch for intermediate key I, valid [nb, na], as issuer X." It is
// a compact base64url blob embedded in each certify line (`ica:`), so a verifier
// holding only the ROOT public key validates the entire chain OFFLINE — no
// network, no key lookup. trustedIssuers[issuer] now holds the ROOT key.

/** The root's signed statement vouching for an intermediate key. */
export interface IntermediateCert {
  /** Issuer name this intermediate may certify under (e.g. "UTS"). */
  issuer: string;
  /** The intermediate's Ed25519 public key (base64url) — the daily signer. */
  intermediatePublicKey: string;
  /** ISO 8601 — not valid before. */
  notBefore: string;
  /** ISO 8601 — not valid after (rotate before this). */
  notAfter: string;
  /** The root's Ed25519 public key (base64url) — the trust anchor. */
  rootPublicKey: string;
  /** The root's signature over the canonical payload (base64url). */
  signature: string;
}

/** Canonical bytes the ROOT signs to vouch for an intermediate. Versioned. */
function icaPayload(
  issuer: string,
  intermediatePublicKey: string,
  notBefore: string,
  notAfter: string,
): Uint8Array {
  return enc(
    `uts-ica-v1\n${issuer}\n${intermediatePublicKey}\n${notBefore}\n${notAfter}`,
  );
}

const MS_PER_DAY = 86_400_000;

/**
 * ROOT operation — run OFFLINE on the air-gapped root machine. Signs an
 * intermediate's PUBLIC key with the root's PRIVATE key, producing an opaque
 * ICA token to provision to the online service. The root private key never
 * leaves this call site; only the token travels.
 *
 * The token is base64url(JSON) using only [A-Za-z0-9_-], so it embeds safely in
 * a pipe-delimited `certify:` line.
 */
export function issueIntermediate(options: {
  /** Root Ed25519 private key (base64url). OFFLINE secret. */
  rootPrivateKey: string;
  /** Intermediate Ed25519 PUBLIC key to vouch for (base64url). */
  intermediatePublicKey: string;
  /** Issuer name the intermediate may certify under. */
  issuer: string;
  /** ISO 8601 start; defaults to now. */
  notBefore?: string;
  /** ISO 8601 end; defaults to notBefore + `days`. */
  notAfter?: string;
  /** Validity length in days when notAfter is omitted (default 365). */
  days?: number;
}): string {
  const notBefore = options.notBefore ?? new Date().toISOString();
  const notAfter =
    options.notAfter ??
    new Date(
      Date.parse(notBefore) + (options.days ?? 365) * MS_PER_DAY,
    ).toISOString();
  const rootPublicKey = publicKeyFor(options.rootPrivateKey);
  const sig = ed25519.sign(
    icaPayload(
      options.issuer,
      options.intermediatePublicKey,
      notBefore,
      notAfter,
    ),
    fromB64url(options.rootPrivateKey),
  );
  const token = {
    v: 1,
    iss: options.issuer,
    pub: options.intermediatePublicKey,
    nb: notBefore,
    na: notAfter,
    root: rootPublicKey,
    sig: toB64url(sig),
  };
  return toB64url(enc(JSON.stringify(token)));
}

/** Decode an ICA token. Returns null if malformed. Does NOT verify the signature. */
export function parseIntermediateCert(token: string): IntermediateCert | null {
  try {
    const obj = JSON.parse(
      new TextDecoder().decode(fromB64url(token)),
    ) as Record<string, unknown>;
    if (
      obj.v !== 1 ||
      typeof obj.iss !== "string" ||
      typeof obj.pub !== "string" ||
      typeof obj.nb !== "string" ||
      typeof obj.na !== "string" ||
      typeof obj.root !== "string" ||
      typeof obj.sig !== "string"
    ) {
      return null;
    }
    return {
      issuer: obj.iss,
      intermediatePublicKey: obj.pub,
      notBefore: obj.nb,
      notAfter: obj.na,
      rootPublicKey: obj.root,
      signature: obj.sig,
    };
  } catch {
    return null;
  }
}

export interface IntermediateVerifyResult {
  valid: boolean;
  issuer?: string;
  intermediatePublicKey?: string;
  rootPublicKey?: string;
  notBefore?: string;
  notAfter?: string;
  reason?: string;
}

/**
 * Verify an ICA token against a set of trusted ROOT keys (issuer → root pubkey).
 * Valid only if: the token parses, the root's signature over the canonical
 * payload verifies, the embedded root matches the trusted root for that issuer
 * (so a forged token with a different root is rejected), and — when `at` is
 * given — `at` falls within [notBefore, notAfter]. ISO-8601 UTC strings compare
 * lexicographically, so string comparison is correct chronological comparison.
 */
export function verifyIntermediateCert(
  token: string,
  trustedRoots: Record<string, string> = {},
  at?: string,
): IntermediateVerifyResult {
  const cert = parseIntermediateCert(token);
  if (!cert)
    return { valid: false, reason: "malformed intermediate certificate" };

  const base = {
    issuer: cert.issuer,
    intermediatePublicKey: cert.intermediatePublicKey,
    rootPublicKey: cert.rootPublicKey,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
  };

  // Reject malformed key material before trusting the chain — an intermediate or
  // root key that isn't a well-formed 32-byte Ed25519 key is invalid outright.
  try {
    decodeEd25519Key(cert.intermediatePublicKey, "intermediate public key");
    decodeEd25519Key(cert.rootPublicKey, "root public key");
  } catch (e) {
    return { ...base, valid: false, reason: (e as Error).message };
  }

  let sigOk = false;
  try {
    sigOk = ed25519.verify(
      fromB64url(cert.signature),
      icaPayload(
        cert.issuer,
        cert.intermediatePublicKey,
        cert.notBefore,
        cert.notAfter,
      ),
      fromB64url(cert.rootPublicKey),
    );
  } catch {
    sigOk = false;
  }
  if (!sigOk) {
    return { ...base, valid: false, reason: "root signature does not verify" };
  }

  const trustedRoot = trustedRoots[cert.issuer];
  if (!trustedRoot) {
    return { ...base, valid: false, reason: "issuer root not in trusted set" };
  }
  if (trustedRoot !== cert.rootPublicKey) {
    return {
      ...base,
      valid: false,
      reason: "root key does not match the trusted root (possible forgery)",
    };
  }

  if (at) {
    if (cert.notBefore && at < cert.notBefore) {
      return {
        ...base,
        valid: false,
        reason: "intermediate not yet valid at certification time",
      };
    }
    if (cert.notAfter && at > cert.notAfter) {
      return {
        ...base,
        valid: false,
        reason: "intermediate expired at certification time",
      };
    }
  }

  return { ...base, valid: true };
}
