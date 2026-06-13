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

const app = express();
// .it documents are plain text but can be large; cap the body sensibly.
app.use(express.json({ limit: "2mb" }));

/** Extract a Bearer token from the Authorization header. */
function bearer(req: Request): string | undefined {
  const h = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : undefined;
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
app.get("/.well-known/uts-pubkey", (_req, res) => res.json(pubkeyPayload()));
app.get("/pubkey", (_req, res) => res.json(pubkeyPayload()));

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, issuer: ISSUER, db: isConnected() }));

// ── POST /certify (API-key auth) ──────────────────────────────────────────────
// body: { source: string }. The account is taken from the API key. If the
// account is KYC-verified, its verified entity is embedded + signed.
app.post("/certify", authenticate, async (req: Request, res: Response) => {
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
      const { certifications } = getCollections();
      await certifications.insertOne({
        account: result.account,
        entity: result.entity ?? null,
        hash: computeHashFromSource(result.source),
        issuer: result.issuer,
        at: result.at,
        createdAt: new Date(),
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
app.post("/verify", (req: Request, res: Response) => {
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
  res.json({
    issuer: ISSUER,
    publicKey: anchor,
    trustAnchor: ROOT_PUBLIC_KEY ? "root" : "key",
    certifications: checks,
  });
});

// ── Admin (UTS_ADMIN_TOKEN) ───────────────────────────────────────────────────

// Create an account (entityVerified defaults false).
app.post("/admin/accounts", requireAdmin, async (req: Request, res: Response) => {
  const { account, label, entity, cr, plan } = (req.body ?? {}) as Record<string, unknown>;
  if (!isValidSlug(account)) {
    res.status(400).json({ error: "bad_request", detail: "`account` must be a lowercase slug." });
    return;
  }
  if (typeof label !== "string" || label.trim() === "") {
    res.status(400).json({ error: "bad_request", detail: "`label` is required." });
    return;
  }
  if (await getAccount(account)) {
    res.status(409).json({ error: "conflict", detail: "Account already exists." });
    return;
  }
  const doc = await createAccount({
    account,
    label: label.trim(),
    entity: typeof entity === "string" ? entity : undefined,
    cr: typeof cr === "string" ? cr : undefined,
    plan: typeof plan === "string" ? plan : undefined,
  });
  res.status(201).json({ account: doc.account, label: doc.label, entityVerified: doc.entityVerified, plan: doc.plan });
});

// KYC onboarding (Phase 3b): bind a verified legal entity to an account.
app.post("/admin/accounts/:account/verify", requireAdmin, async (req: Request, res: Response) => {
  const { account } = req.params;
  const { entity, cr } = (req.body ?? {}) as Record<string, unknown>;
  if (typeof entity !== "string" || entity.trim() === "") {
    res.status(400).json({ error: "bad_request", detail: "`entity` (verified legal name) is required." });
    return;
  }
  const updated = await verifyAccountEntity(account, entity.trim(), typeof cr === "string" ? cr : undefined);
  if (!updated) {
    res.status(404).json({ error: "not_found", detail: "Account not found." });
    return;
  }
  res.json({ account: updated.account, entity: updated.entity, entityVerified: updated.entityVerified, cr: updated.cr });
});

// Mint an API key for an account — returns the PLAINTEXT key once.
app.post("/admin/keys", requireAdmin, async (req: Request, res: Response) => {
  const { account, label } = (req.body ?? {}) as Record<string, unknown>;
  if (!isValidSlug(account)) {
    res.status(400).json({ error: "bad_request", detail: "`account` must be a lowercase slug." });
    return;
  }
  if (!(await getAccount(account))) {
    res.status(404).json({ error: "not_found", detail: "Account not found." });
    return;
  }
  const { apiKey, doc } = await mintApiKey(account, typeof label === "string" ? label : "");
  res.status(201).json({ apiKey, prefix: doc.prefix, account: doc.account, label: doc.label });
});

// Revoke an API key by its display prefix.
app.post("/admin/keys/:prefix/revoke", requireAdmin, async (req: Request, res: Response) => {
  const ok = await revokeKeyByPrefix(req.params.prefix);
  if (!ok) {
    res.status(404).json({ error: "not_found", detail: "No active key with that prefix." });
    return;
  }
  res.json({ revoked: true, prefix: req.params.prefix });
});

// ── Root → intermediate provisioning (admin) ──────────────────────────────────

// Read the current intermediate PUBLIC key — carry it to the offline root machine
// (`root:issue --intermediate-pub <this>`) to mint an ICA token for it.
app.get("/admin/intermediate-pubkey", requireAdmin, (_req: Request, res: Response) => {
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
app.post("/admin/intermediate-cert", requireAdmin, async (req: Request, res: Response) => {
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

export async function start(): Promise<void> {
  await connectDb();
  await initKeys();
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
