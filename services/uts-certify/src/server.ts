/**
 * server.ts — reference UTS certification service (the backend for api.uts.qa).
 *
 * What it does (Phase 3a): an API consumer POSTs a .it document; the service
 * authenticates the caller's API key, looks up the account it belongs to, and
 * issues a UTS Ed25519 certification — a signed timestamp over the document's
 * content hash. The returned source carries a `certify:` line that anyone can
 * verify offline against UTS's published public key.
 *
 * What it does NOT do yet:
 *   - Phase 3b (identity / KYC): bind an account to a verified real-world
 *     identity. Right now /certify proves "UTS saw this content at this time on
 *     behalf of account X" — a provable timestamp, not an identity attestation.
 *   - Phase 3c (billing / dashboard): quotas, plans, self-serve signup. API keys
 *     are issued by an admin script (scripts/issue-key.mjs).
 *
 * Security model: the authority PRIVATE key lives only in this process (loaded
 * from .keys/uts.json). It is never exposed by any route. Only the PUBLIC key is
 * published, so verification is fully client-side and offline.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import { certifyDocument, verifyCertifications } from "@dotit/sign";
import { loadOrCreateAuthorityKey } from "./keys.js";
import { lookupAccount, ensureDemoAccount, type AccountRecord } from "./accounts.js";

const PORT = Number(process.env.PORT ?? 8787);
const ISSUER = "UTS";

const authority = loadOrCreateAuthorityKey();

const app = express();
// .it documents are plain text but can be large; cap the body sensibly.
app.use(express.json({ limit: "2mb" }));

/** Extract a Bearer token from the Authorization header. */
function bearer(req: Request): string | undefined {
  const h = req.header("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1] : undefined;
}

/** Auth middleware: resolve the API key → account, or 401. */
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const account = lookupAccount(bearer(req));
  if (!account) {
    res.status(401).json({ error: "unauthorized", detail: "Missing or unknown API key." });
    return;
  }
  (req as Request & { account: AccountRecord }).account = account;
  next();
}

// ── Public key publication (no auth) ───────────────────────────────────────
// Clients (e.g. verify.uts.qa) fetch this to populate trustedIssuers, or bake
// it at build time. The private key is NEVER served.
const pubkeyPayload = {
  issuer: ISSUER,
  publicKey: authority.publicKey,
  algorithm: "ed25519" as const,
};
app.get("/.well-known/uts-pubkey", (_req, res) => res.json(pubkeyPayload));
app.get("/pubkey", (_req, res) => res.json(pubkeyPayload));

// ── Health ──────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, issuer: ISSUER }));

// ── POST /certify (auth) ─────────────────────────────────────────────────────
// body: { source: string, account?: string }  — account is taken from the API
// key; an explicit body.account is rejected if it disagrees, so a key can only
// certify for its own account.
app.post("/certify", authenticate, (req: Request, res: Response) => {
  const account = (req as Request & { account: AccountRecord }).account;
  const { source } = (req.body ?? {}) as { source?: unknown };

  if (typeof source !== "string" || source.trim() === "") {
    res.status(400).json({ error: "bad_request", detail: "Body must include a non-empty `source` string." });
    return;
  }

  try {
    const result = certifyDocument(source, {
      issuer: ISSUER,
      account: account.account,
      issuerPrivateKey: authority.privateKey, // signed in-process; never leaves
    });
    res.json({
      source: result.source,
      at: result.at,
      account: result.account,
      issuer: result.issuer,
      note: result.note,
    });
  } catch (e) {
    res.status(500).json({ error: "certify_failed", detail: (e as Error).message });
  }
});

// ── POST /verify (no auth, convenience) ──────────────────────────────────────
// Verification is normally client-side and offline; this endpoint is only for
// API consumers that want the service to check a document against its own key.
app.post("/verify", (req: Request, res: Response) => {
  const { source } = (req.body ?? {}) as { source?: unknown };
  if (typeof source !== "string") {
    res.status(400).json({ error: "bad_request", detail: "Body must include a `source` string." });
    return;
  }
  const checks = verifyCertifications(source, { [ISSUER]: authority.publicKey });
  res.json({ issuer: ISSUER, publicKey: authority.publicKey, certifications: checks });
});

app.listen(PORT, () => {
  // Seed a demo account so the service is testable immediately.
  const demo = ensureDemoAccount();
  console.log(`\n  UTS certification service (reference impl for api.uts.qa)`);
  console.log(`  Listening on http://localhost:${PORT}`);
  console.log(`  Issuer:      ${ISSUER}`);
  console.log(`  Public key:  ${authority.publicKey}`);
  console.log(`  Pubkey URL:  http://localhost:${PORT}/.well-known/uts-pubkey`);
  console.log(`  Demo key:    ${demo.apiKey}  (account: ${demo.account})`);
  console.log(`\n  Try:  curl -s http://localhost:${PORT}/pubkey`);
  console.log(`        curl -s -X POST http://localhost:${PORT}/certify \\`);
  console.log(`          -H "Authorization: Bearer ${demo.apiKey}" \\`);
  console.log(`          -H "Content-Type: application/json" \\`);
  console.log(`          -d '{"source":"title: Hello\\n"}'\n`);
});
