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
import { certifyDocument, verifyCertifications } from "@dotit/sign";
import { getKeyProvider, type KeyProvider } from "./keys.js";
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

// Resolve the authority key up-front (fatal in prod if UTS_PRIVATE_KEY missing).
const keys: KeyProvider = getKeyProvider();

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
const pubkeyPayload = {
  issuer: ISSUER,
  publicKey: keys.getPublicKey(),
  algorithm: "ed25519" as const,
};
app.get("/.well-known/uts-pubkey", (_req, res) => res.json(pubkeyPayload));
app.get("/pubkey", (_req, res) => res.json(pubkeyPayload));

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
    const result = certifyDocument(source, {
      issuer: ISSUER,
      account: account.account,
      entity,
      issuerPrivateKey: keys.getPrivateKey(), // signed in-process; never leaves
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
  const checks = verifyCertifications(source, { [ISSUER]: keys.getPublicKey() });
  res.json({ issuer: ISSUER, publicKey: keys.getPublicKey(), certifications: checks });
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

// JSON error guard (e.g. malformed body) — don't leak internals.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: "bad_request", detail: "Invalid request." });
});

export { app, ISSUER, keys };

/** Start the HTTP server after the DB is connected. */
export async function start(): Promise<void> {
  await connectDb();
  app.listen(PORT, () => {
    console.log(`\n  UTS certification service (reference impl for api.uts.qa)`);
    console.log(`  Listening on http://localhost:${PORT}`);
    console.log(`  Issuer:      ${ISSUER}`);
    console.log(`  Public key:  ${keys.getPublicKey()}`);
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
