/**
 * server.ts — production-shaped UTS certification service (backend for api.uts.qa).
 *
 * An API consumer POSTs a .it document; the service authenticates the caller's
 * API key (sha256 → uts_api_keys), resolves the account it belongs to, and issues
 * a UTS Ed25519 certification — a signed timestamp over the document's content
 * hash. If the account is KYC-verified (Phase 3b), the verified legal `entity` is
 * folded into the signature, so the certification attests *who* and not just
 * *when*. The returned source carries a `certify:` line anyone can verify offline.
 *
 * Storage:  MongoDB (src/db.ts) — accounts, hashed API keys, an audit log.
 * Custody:  the authority PRIVATE key comes from a KeyProvider (src/keys.ts),
 *           sourced from an env secret / KMS — never from the DB or a tracked file.
 *
 * Deferred: Phase 3c (self-serve billing/dashboard, Stripe) and the public deploy
 *           to api.uts.qa.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import {
  certifyDocument,
  verifyCertifications,
  parseIntermediateCert,
  verifyIntermediateCert,
} from "@dotit/sign";
import { createKeyProvider, MongoKeyProvider, type KeyProvider } from "./keys.js";
import { createX509CaProvider, type X509CaProvider } from "./x509ca.js";
import { connectDb, isConnected, getCollections, type AccountDoc } from "./db.js";
import {
  createAccount,
  getAccount,
  verifyAccountEntity,
  mintApiKey,
  revokeKeyByPrefix,
  resolveKeyToAccount,
  isValidSlug,
} from "./accounts.js";
import {
  securityHeaders,
  requireHttps,
  createRateLimiter,
  validateEntity,
  validateCr,
  clampString,
} from "./security.js";
import {
  revoke,
  isHashRevoked,
  isKeyRevoked,
  listRevocations,
} from "./revocations.js";
import { writeAudit } from "./audit.js";

const PORT = Number(process.env.PORT ?? 8787);
const ISSUER = process.env.ISSUER ?? "UTS";
const ADMIN_TOKEN = process.env.UTS_ADMIN_TOKEN?.trim();

/**
 * The ROOT public key — the trust anchor verifiers pin (baked into trust stores).
 * When set, certifications chain to it via the intermediate cert, and /verify
 * validates that chain against the root. When unset, the service runs in legacy
 * single-key mode: the signing key is itself the trust anchor. Generated OFFLINE
 * by scripts/root-ca.mjs; its private half NEVER touches this service.
 */
const ROOT_PUBLIC_KEY = process.env.UTS_ROOT_PUBLIC_KEY?.trim() || undefined;

/**
 * The key verifiers should pin: the ROOT when configured, else the current
 * signing key (legacy single-key). With a root, certs carry an `ica:` chain that
 * verifyCertifications validates against this key.
 */
function trustAnchorKey(): string {
  return ROOT_PUBLIC_KEY ?? keys.getPublicKey();
}

// The authority key provider is initialized in start(), AFTER connectDb(), so
// the default MongoKeyProvider can load/create the envelope-encrypted key from
// MongoDB. Handlers only run after app.listen() (post-init), so `keys` is always
// set by the time a request arrives.
let keys!: KeyProvider;

// The X.509 CA provider for the PAdES chain (separate from the Ed25519 authority).
// null when X.509 issuance is disabled (UTS_X509=off) — the /certify/x509 +
// /.well-known/uts-ca.pem routes then report 503, the rest of the service runs on.
let x509: X509CaProvider | null = null;

const app = express();
// Behind a TLS-terminating proxy in production, so x-forwarded-* is trustworthy
// (needed for requireHttps + real client IPs in rate limiting / audit). Opt out
// with TRUST_PROXY=false.
app.set("trust proxy", process.env.TRUST_PROXY === "false" ? false : 1);
// Conservative headers + (in prod) HTTPS-only, on every route.
app.use(securityHeaders);
app.use(requireHttps);
// .it documents are plain text but can be large; cap the body sensibly.
app.use(express.json({ limit: "2mb" }));

// ── Rate limiters (in-memory, per-instance) ────────────────────────────────────
// /certify is the expensive, authenticated path → throttle per API key.
const certifyLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_CERTIFY_PER_MIN ?? 60),
});
// /verify + /revocations are public → throttle per IP, more generously.
const publicLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_PUBLIC_PER_MIN ?? 120),
});
// Admin actions → tight per-token cap.
const adminLimiter = createRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.RATE_ADMIN_PER_MIN ?? 30),
});

/** Extract a Bearer token from the Authorization header. */
function bearer(req: Request): string | undefined {
  const h = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : undefined;
}

/** Best-effort client IP for audit/throttle (trust-proxy resolves x-forwarded-for). */
function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

/** A short, non-secret identifier for the admin actor (token prefix) for audit. */
function adminActor(req: Request): string {
  const t = bearer(req) ?? "";
  return t ? `admin:${t.slice(0, 6)}…` : "admin:?";
}

type AuthedRequest = Request & { account: AccountDoc };

/** API-key auth: resolve the key → account, or 401. */
async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await resolveKeyToAccount(bearer(req));
    if (!account) {
      res.status(401).json({ error: "unauthorized", detail: "Missing or unknown API key." });
      return;
    }
    (req as AuthedRequest).account = account;
    next();
  } catch {
    res.status(500).json({ error: "internal_error" });
  }
}

/**
 * Admin auth: a single shared `UTS_ADMIN_TOKEN` (separate from API keys). 403 if
 * the server has no admin token configured (so admin routes can't be hit by
 * accident); 401 on a missing/mismatched token.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(403).json({ error: "admin_disabled", detail: "UTS_ADMIN_TOKEN is not configured." });
    return;
  }
  const token = bearer(req);
  if (!token || token !== ADMIN_TOKEN) {
    res.status(401).json({ error: "unauthorized", detail: "Missing or invalid admin token." });
    return;
  }
  next();
}

// ── Public key publication (no auth) ───────────────────────────────────────
// Verifiers (e.g. verify.uts.qa) fetch this to populate trustedIssuers, or bake
// it at build time. The private key is NEVER served.
// Built per request (the key provider is initialized in start(), after this
// module loads), so it always reflects the active authority key.
// `publicKey` is the PINNABLE trust anchor (root when configured, else the
// signing key in legacy mode); `trustAnchor` says which. `intermediate` is the
// current online signing key, and `intermediateCert` the root's vouch for it (the
// ICA token) when provisioned — exposed for transparency / chain inspection.
const pubkeyPayload = () => {
  const intermediateCert = keys.getIntermediateCert();
  return {
    issuer: ISSUER,
    publicKey: trustAnchorKey(),
    trustAnchor: ROOT_PUBLIC_KEY ? ("root" as const) : ("key" as const),
    intermediate: keys.getPublicKey(),
    ...(intermediateCert ? { intermediateCert } : {}),
    algorithm: "ed25519" as const,
  };
};
app.get("/.well-known/uts-pubkey", publicLimiter, (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(pubkeyPayload());
});
app.get("/pubkey", publicLimiter, (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(pubkeyPayload());
});

// ── X.509 CA certificate publication (no auth) ───────────────────────────────
// The PAdES trust anchor: verifiers (and Adobe trust stores) add this CA cert so
// signatures on PDFs exported from UTS-issued certs validate. PEM at
// /.well-known/uts-ca.pem; JSON metadata at /ca.
app.get("/.well-known/uts-ca.pem", publicLimiter, (_req, res) => {
  if (!x509) {
    res.status(503).json({ error: "x509_disabled", detail: "X.509 issuance is not enabled on this instance." });
    return;
  }
  res.setHeader("Content-Type", "application/x-pem-file");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(x509.getCaCertPem());
});
app.get("/ca", publicLimiter, (_req, res) => {
  if (!x509) {
    res.status(503).json({ error: "x509_disabled", detail: "X.509 issuance is not enabled on this instance." });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json({ issuer: ISSUER, algorithm: "ecdsa-p256", caCertPem: x509.getCaCertPem() });
});

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, issuer: ISSUER, db: isConnected() }));

// ── POST /certify (API-key auth) ──────────────────────────────────────────────
// body: { source: string }. The account is taken from the API key. If the
// account is KYC-verified, its verified entity is embedded + signed.
app.post("/certify", certifyLimiter, authenticate, async (req: Request, res: Response) => {
  const account = (req as AuthedRequest).account;
  const { source } = (req.body ?? {}) as { source?: unknown };

  if (typeof source !== "string" || source.trim() === "") {
    res.status(400).json({ error: "bad_request", detail: "Body must include a non-empty `source` string." });
    return;
  }

  try {
    const entity = account.entityVerified && account.entity ? account.entity : undefined;
    // When provisioned with an ICA, chain every cert to the root; otherwise this
    // is undefined and certifyDocument behaves exactly as legacy single-key mode.
    const intermediateCert = keys.getIntermediateCert();
    const result = certifyDocument(source, {
      issuer: ISSUER,
      account: account.account,
      entity,
      issuerPrivateKey: keys.getPrivateKey(), // signed in-process; never leaves
      ...(intermediateCert ? { intermediateCert } : {}),
    });

    // Audit log (skip if it was an idempotent no-op re-certify).
    if (result.note !== "already-certified") {
      const hash = computeHashFromSource(result.source);
      const { certifications } = getCollections();
      await certifications.insertOne({
        account: result.account,
        entity: result.entity ?? null,
        hash,
        issuer: result.issuer,
        at: result.at,
        issuerKey: keys.getPublicKey(),
        createdAt: new Date(),
      });
      void writeAudit({
        action: "cert.issue",
        actor: `key:${account.account}`,
        subject: hash,
        meta: { entity: result.entity ?? null, issuer: result.issuer },
        ip: clientIp(req),
      });
    }

    res.json({
      source: result.source,
      at: result.at,
      account: result.account,
      entity: result.entity ?? null,
      issuer: result.issuer,
      note: result.note,
    });
  } catch {
    res.status(500).json({ error: "certify_failed", detail: "Could not issue certification." });
  }
});

// ── POST /certify/x509 (API-key auth, KYC-gated) ──────────────────────────────
// body: { csr: <PEM CSR> }. Issues an X.509 leaf SIGNING certificate for the
// account's verified legal entity, signed by the UTS X.509 CA. The customer holds
// the private key (CSR custody) and uses cert+chain to PAdES-sign exported PDFs —
// the signature then chains to UTS as a real CA. Only KYC-verified accounts may
// obtain a cert: the cert ASSERTS the entity's identity, so it must be verified.
const X509_LEAF_DAYS = Number(process.env.UTS_X509_LEAF_DAYS ?? 825);

app.post("/certify/x509", certifyLimiter, authenticate, async (req: Request, res: Response) => {
  if (!x509) {
    res.status(503).json({ error: "x509_disabled", detail: "X.509 issuance is not enabled on this instance." });
    return;
  }
  const account = (req as AuthedRequest).account;
  const { csr } = (req.body ?? {}) as { csr?: unknown };

  if (typeof csr !== "string" || !/-----BEGIN CERTIFICATE REQUEST-----/.test(csr)) {
    res.status(400).json({ error: "bad_request", detail: "Body must include a PEM `csr` (PKCS#10 certificate request)." });
    return;
  }
  if (csr.length > 8192) {
    res.status(400).json({ error: "bad_request", detail: "CSR is too large." });
    return;
  }
  // The leaf asserts the legal entity, so the account MUST be KYC-verified.
  if (!account.entityVerified || !account.entity) {
    res.status(403).json({
      error: "kyc_required",
      detail: "A verified legal entity is required before a signing certificate can be issued. Complete KYC first.",
    });
    return;
  }

  try {
    const issued = await x509.issueLeaf({
      csrPem: csr,
      commonName: account.entity,
      organization: account.entity,
      days: X509_LEAF_DAYS,
    });

    if (isConnected()) {
      const { x509Certs } = getCollections();
      await x509Certs.insertOne({
        account: account.account,
        commonName: account.entity,
        serial: issued.serial,
        fingerprint: issued.fingerprint,
        notBefore: issued.notBefore,
        notAfter: issued.notAfter,
        createdAt: new Date(),
      });
      void writeAudit({
        action: "x509.issue",
        actor: `key:${account.account}`,
        subject: issued.fingerprint,
        meta: { commonName: account.entity, serial: issued.serial, notAfter: issued.notAfter },
        ip: clientIp(req),
      });
    }

    res.status(201).json({
      issuer: ISSUER,
      account: account.account,
      commonName: account.entity,
      certPem: issued.certPem,
      chainPem: issued.chainPem,
      serial: issued.serial,
      fingerprint: issued.fingerprint,
      notBefore: issued.notBefore,
      notAfter: issued.notAfter,
    });
  } catch (e) {
    // A bad CSR (proof-of-possession failure / malformed) is a client error.
    const msg = e instanceof Error ? e.message : "";
    if (/proof-of-possession|valid DER|CSR/i.test(msg)) {
      res.status(400).json({ error: "bad_csr", detail: "The CSR is invalid or failed proof-of-possession." });
      return;
    }
    res.status(500).json({ error: "x509_failed", detail: "Could not issue the certificate." });
  }
});

/** Pull the sha256:… token out of the freshly-issued certify: line for the log. */
function computeHashFromSource(source: string): string {
  for (const raw of source.split("\n")) {
    const line = raw.trimStart();
    if (line.startsWith("certify:")) {
      const m = /hash:\s*(sha256:[0-9a-f]+)/.exec(line);
      if (m) return m[1];
    }
  }
  return "";
}

// ── POST /verify (no auth, convenience) ──────────────────────────────────────
app.post("/verify", publicLimiter, async (req: Request, res: Response) => {
  const { source } = (req.body ?? {}) as { source?: unknown };
  if (typeof source !== "string") {
    res.status(400).json({ error: "bad_request", detail: "Body must include a `source` string." });
    return;
  }
  // Trust the ROOT when configured (chained certs verify against it via `ica:`),
  // else the signing key (legacy certs). One map covers both, since the lib picks
  // the trust model per-line based on whether the certify: line carries `ica:`.
  const anchor = trustAnchorKey();
  const checks = verifyCertifications(source, { [ISSUER]: anchor });

  // Cross-check revocation. checks[i] corresponds to the i-th `certify:` line in
  // document order, so we pair each with its line to read the certified hash + key.
  const certLines = source
    .split("\n")
    .map((l) => l.trimStart())
    .filter((l) => l.startsWith("certify:"));
  const certifications = await Promise.all(
    checks.map(async (c, i) => {
      const line = certLines[i] ?? "";
      const hash = /hash:\s*(sha256:[0-9a-f]+)/.exec(line)?.[1] ?? "";
      const key = /key:\s*ed25519:([A-Za-z0-9_-]+)/.exec(line)?.[1] ?? "";
      if (isConnected()) {
        try {
          if (hash && (await isHashRevoked(hash))) {
            return { ...c, valid: false, trusted: false, revoked: true, reason: "certified hash has been revoked" };
          }
          if (key && (await isKeyRevoked(key))) {
            return { ...c, valid: false, trusted: false, revoked: true, reason: "signing key has been revoked" };
          }
        } catch {
          // Revocation store unavailable — fall through (do not weaken the signature result).
        }
      }
      return { ...c, revoked: false };
    }),
  );

  res.json({
    issuer: ISSUER,
    publicKey: anchor,
    trustAnchor: ROOT_PUBLIC_KEY ? "root" : "key",
    certifications,
  });
});

// ── GET /revocations (public) — the published revocation list ─────────────────
// Verifiers can pin this to reject revoked certs offline. Served over TLS from the
// authority; signing the list for offline tamper-evidence is a planned follow-up.
app.get("/revocations", publicLimiter, async (_req: Request, res: Response) => {
  if (!isConnected()) {
    res.json({ issuer: ISSUER, revocations: [] });
    return;
  }
  try {
    const revocations = await listRevocations();
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ issuer: ISSUER, revocations });
  } catch {
    res.status(500).json({ error: "internal_error" });
  }
});

// ── Admin (UTS_ADMIN_TOKEN) ───────────────────────────────────────────────────

// Create an account (entityVerified defaults false).
app.post("/admin/accounts", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const { account, label, entity, cr, plan } = (req.body ?? {}) as Record<string, unknown>;
  if (!isValidSlug(account)) {
    res.status(400).json({ error: "bad_request", detail: "`account` must be a lowercase slug." });
    return;
  }
  const cleanLabel = clampString(label, 120);
  if (!cleanLabel) {
    res.status(400).json({ error: "bad_request", detail: "`label` is required." });
    return;
  }
  // entity/cr are optional here but still validated when present.
  let cleanEntity: string | undefined;
  if (entity !== undefined && entity !== null && entity !== "") {
    const ev = validateEntity(entity);
    if (!ev.ok) {
      res.status(400).json({ error: "bad_request", detail: ev.reason });
      return;
    }
    cleanEntity = ev.value;
  }
  const cv = validateCr(cr);
  if (!cv.ok) {
    res.status(400).json({ error: "bad_request", detail: cv.reason });
    return;
  }
  if (await getAccount(account)) {
    res.status(409).json({ error: "conflict", detail: "Account already exists." });
    return;
  }
  const doc = await createAccount({
    account,
    label: cleanLabel,
    entity: cleanEntity,
    cr: cv.value,
    plan: clampString(plan, 40) ?? undefined,
  });
  void writeAudit({
    action: "account.create",
    actor: adminActor(req),
    subject: doc.account,
    meta: { label: doc.label, plan: doc.plan, entityProvided: !!cleanEntity },
    ip: clientIp(req),
  });
  res.status(201).json({ account: doc.account, label: doc.label, entityVerified: doc.entityVerified, plan: doc.plan });
});

// KYC onboarding (Phase 3b): bind a verified legal entity to an account.
app.post("/admin/accounts/:account/verify", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const { account } = req.params;
  const { entity, cr } = (req.body ?? {}) as Record<string, unknown>;
  const ev = validateEntity(entity);
  if (!ev.ok) {
    res.status(400).json({ error: "bad_request", detail: ev.reason });
    return;
  }
  const cv = validateCr(cr);
  if (!cv.ok) {
    res.status(400).json({ error: "bad_request", detail: cv.reason });
    return;
  }
  const updated = await verifyAccountEntity(account, ev.value, cv.value);
  if (!updated) {
    res.status(404).json({ error: "not_found", detail: "Account not found." });
    return;
  }
  void writeAudit({
    action: "account.verify",
    actor: adminActor(req),
    subject: account,
    meta: { entity: updated.entity, cr: updated.cr ?? null },
    ip: clientIp(req),
  });
  res.json({ account: updated.account, entity: updated.entity, entityVerified: updated.entityVerified, cr: updated.cr });
});

// Mint an API key for an account — returns the PLAINTEXT key once.
app.post("/admin/keys", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const { account, label } = (req.body ?? {}) as Record<string, unknown>;
  if (!isValidSlug(account)) {
    res.status(400).json({ error: "bad_request", detail: "`account` must be a lowercase slug." });
    return;
  }
  if (!(await getAccount(account))) {
    res.status(404).json({ error: "not_found", detail: "Account not found." });
    return;
  }
  const { apiKey, doc } = await mintApiKey(account, clampString(label, 120) ?? "");
  void writeAudit({
    action: "key.mint",
    actor: adminActor(req),
    subject: doc.prefix,
    meta: { account: doc.account, label: doc.label },
    ip: clientIp(req),
  });
  res.status(201).json({ apiKey, prefix: doc.prefix, account: doc.account, label: doc.label });
});

// Revoke an API key by its display prefix.
app.post("/admin/keys/:prefix/revoke", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const ok = await revokeKeyByPrefix(req.params.prefix);
  if (!ok) {
    res.status(404).json({ error: "not_found", detail: "No active key with that prefix." });
    return;
  }
  void writeAudit({
    action: "key.revoke",
    actor: adminActor(req),
    subject: req.params.prefix,
    ip: clientIp(req),
  });
  res.json({ revoked: true, prefix: req.params.prefix });
});

// ── Revoke a certification (by content hash) or a compromised signing key ──────
// body: { hash?: "sha256:…" } OR { key?: "<ed25519 pubkey>" } + optional reason.
app.post("/admin/revoke", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const { hash, key, reason } = (req.body ?? {}) as Record<string, unknown>;
  const cleanReason = clampString(reason, 200) ?? "revoked by administrator";

  let kind: "hash" | "key";
  let value: string;
  if (typeof hash === "string" && /^sha256:[0-9a-f]{16,}$/.test(hash.trim())) {
    kind = "hash";
    value = hash.trim();
  } else if (typeof key === "string" && /^[A-Za-z0-9_-]{20,}$/.test(key.trim())) {
    kind = "key";
    value = key.trim();
  } else {
    res.status(400).json({
      error: "bad_request",
      detail: "Provide a `hash` (sha256:…) or a `key` (ed25519 public key) to revoke.",
    });
    return;
  }

  try {
    const doc = await revoke({ kind, value, issuer: ISSUER, reason: cleanReason, revokedBy: adminActor(req) });
    void writeAudit({
      action: "cert.revoke",
      actor: adminActor(req),
      subject: value,
      meta: { kind, reason: cleanReason },
      ip: clientIp(req),
    });
    res.status(201).json({ revoked: true, kind: doc.kind, value: doc.value, at: doc.revokedAt, reason: doc.reason });
  } catch {
    res.status(500).json({ error: "internal_error", detail: "Could not record revocation." });
  }
});

// ── Root → intermediate provisioning (admin) ──────────────────────────────────

// Read the current intermediate PUBLIC key — carry it to the offline root machine
// (`root:issue --intermediate-pub <this>`) to mint an ICA token for it.
app.get("/admin/intermediate-pubkey", adminLimiter, requireAdmin, (_req: Request, res: Response) => {
  res.json({
    issuer: ISSUER,
    intermediate: keys.getPublicKey(),
    algorithm: "ed25519",
    provisioned: !!keys.getIntermediateCert(),
    rootConfigured: !!ROOT_PUBLIC_KEY,
  });
});

// Provision the ICA token minted offline by the root. Validates that the token
// parses, vouches for THIS signing key, and (when a root is configured) verifies
// against it — then stores it on the active AuthorityKeyDoc. From then on every
// certification chains to the root.
app.post("/admin/intermediate-cert", adminLimiter, requireAdmin, async (req: Request, res: Response) => {
  const { ica } = (req.body ?? {}) as { ica?: unknown };
  if (typeof ica !== "string" || ica.trim() === "") {
    res.status(400).json({ error: "bad_request", detail: "Body must include a non-empty `ica` token string." });
    return;
  }
  const token = ica.trim();

  const cert = parseIntermediateCert(token);
  if (!cert) {
    res.status(400).json({ error: "bad_request", detail: "`ica` is not a valid intermediate certificate token." });
    return;
  }

  const intermediate = keys.getPublicKey();
  if (cert.intermediatePublicKey !== intermediate) {
    res.status(400).json({
      error: "bad_request",
      detail: "ICA does not vouch for this service's signing key.",
      icaVouchesFor: cert.intermediatePublicKey,
      thisIntermediate: intermediate,
    });
    return;
  }

  // When a root is configured, the token must verify against it (right root,
  // valid root signature). Without a configured root we can only check the
  // self-consistency above — accept, but say so.
  if (ROOT_PUBLIC_KEY) {
    const vr = verifyIntermediateCert(token, { [ISSUER]: ROOT_PUBLIC_KEY });
    if (!vr.valid) {
      res.status(400).json({
        error: "bad_request",
        detail: `ICA does not verify against the configured root: ${vr.reason}`,
      });
      return;
    }
  }

  if (!(keys instanceof MongoKeyProvider)) {
    res.status(400).json({
      error: "unsupported",
      detail:
        "Persisting an ICA requires the Mongo key provider. In env mode, supply the token via the UTS_ICA env var instead.",
    });
    return;
  }

  const stored = await keys.setIntermediateCert(token);
  if (!stored) {
    res.status(400).json({ error: "bad_request", detail: "ICA failed validation and was not stored." });
    return;
  }
  void writeAudit({
    action: "intermediate.provision",
    actor: adminActor(req),
    subject: intermediate,
    meta: { rootPublicKey: cert.rootPublicKey, notBefore: cert.notBefore, notAfter: cert.notAfter },
    ip: clientIp(req),
  });
  res.json({
    ok: true,
    issuer: ISSUER,
    intermediate,
    rootPublicKey: cert.rootPublicKey,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    rootVerified: !!ROOT_PUBLIC_KEY,
  });
});

// JSON error guard (e.g. malformed body) — don't leak internals.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: "bad_request", detail: "Invalid request." });
});

export { app, ISSUER, ROOT_PUBLIC_KEY, keys };

/** Start the HTTP server after the DB is connected. */
/**
 * Initialize the authority key provider. By default the key lives in MongoDB,
 * envelope-encrypted with UTS_KEK (set UTS_KEY_PROVIDER=env to use a raw
 * UTS_PRIVATE_KEY). Call AFTER connectDb(). Exposed so tests can init without
 * starting the HTTP listener.
 */
export async function initKeys(): Promise<void> {
  keys = await createKeyProvider(
    isConnected() ? getCollections().authorityKeys : undefined,
  );
}

/**
 * Initialize the X.509 CA provider (the PAdES chain). Separate from initKeys so a
 * misconfigured/disabled X.509 CA never blocks the Ed25519 certification path:
 * on failure we log and leave x509 null (the /certify/x509 + /ca routes 503).
 * Exposed so tests can init without starting the HTTP listener.
 */
export async function initX509(): Promise<void> {
  try {
    x509 = await createX509CaProvider();
  } catch (e) {
    x509 = null;
    console.warn(`  ⚠️  X.509 CA disabled: ${(e as Error).message.split("\n")[0]}`);
  }
}

/** Test seam: inject a specific X.509 CA provider (or null to disable). */
export function setX509Provider(provider: X509CaProvider | null): void {
  x509 = provider;
}

/**
 * Production safety checks: surface foot-guns loudly at boot (weak/missing admin
 * token, raw private key in env instead of KMS/Mongo envelope, HTTPS not enforced).
 * Warnings only — they never block startup — but they make misconfiguration obvious.
 */
function productionGuards(): void {
  if (process.env.NODE_ENV !== "production") return;
  const warn = (m: string) => console.warn(`  ⚠️  ${m}`);
  if (!ADMIN_TOKEN) warn("UTS_ADMIN_TOKEN is not set — admin endpoints are disabled.");
  else if (ADMIN_TOKEN.length < 24)
    warn("UTS_ADMIN_TOKEN is short (<24 chars) — use a long random secret.");
  if (process.env.UTS_KEY_PROVIDER === "env")
    warn(
      "UTS_KEY_PROVIDER=env keeps the signing key as a plaintext env var. " +
        "In production use the Mongo envelope (UTS_KEK) or a KMS/HSM.",
    );
  if (process.env.REQUIRE_HTTPS === "false")
    warn("REQUIRE_HTTPS=false — the service will accept plaintext HTTP.");
  if (!ROOT_PUBLIC_KEY)
    warn("UTS_ROOT_PUBLIC_KEY is unset — running in legacy single-key mode (no root chain).");
}

export async function start(): Promise<void> {
  await connectDb();
  await initKeys();
  await initX509();
  productionGuards();
  app.listen(PORT, () => {
    console.log(`\n  UTS certification service (reference impl for api.uts.qa)`);
    console.log(`  Listening on http://localhost:${PORT}`);
    console.log(`  Issuer:      ${ISSUER}`);
    console.log(`  Intermediate (signing) key: ${keys.getPublicKey()}`);
    if (ROOT_PUBLIC_KEY) {
      console.log(`  Trust anchor: ROOT  ${ROOT_PUBLIC_KEY}`);
      console.log(
        `  Chain:        ${keys.getIntermediateCert() ? "PROVISIONED — certs chain to the root" : "NOT provisioned — set UTS_ICA or POST /admin/intermediate-cert"}`,
      );
    } else {
      console.log(`  Trust anchor: KEY (legacy single-key — set UTS_ROOT_PUBLIC_KEY to enable the hierarchy)`);
    }
    console.log(`  Pubkey URL:  http://localhost:${PORT}/.well-known/uts-pubkey`);
    console.log(
      `  X.509 CA:    ${x509 ? `ENABLED — PAdES certs at POST /certify/x509, CA at /.well-known/uts-ca.pem` : "disabled (set UTS_X509_CA_CERT/KEY or run x509:init)"}`,
    );
    console.log(`  Admin:       ${ADMIN_TOKEN ? "enabled" : "DISABLED (set UTS_ADMIN_TOKEN)"}`);
    console.log(`\n  curl -s http://localhost:${PORT}/pubkey\n`);
  });
}

// Only auto-start when run directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  start().catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
}
