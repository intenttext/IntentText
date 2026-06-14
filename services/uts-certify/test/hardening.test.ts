/**
 * hardening.test.ts — Wave 3 hardening: input validation, rate limiting, security
 * headers, audit logging, and the certificate-revocation flow.
 *
 * Unit tests (no DB) always run. The HTTP integration + revocation E2E need a DB;
 * they use mongodb-memory-server when available and skip otherwise (logged).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";

const ADMIN = "test-admin-token-long-enough-1234567890";

process.env.UTS_ADMIN_TOKEN = ADMIN;
process.env.UTS_PRIVATE_KEY = (await import("@dotit/sign")).generateSigningKey().privateKey;
process.env.DB_NAME = "uts_hardening_test";
process.env.ISSUER = "UTS";
process.env.UTS_KEY_PROVIDER = "env";

// ── Unit tests: security helpers (no DB, no HTTP) ──────────────────────────────
describe("security helpers", () => {
  it("createRateLimiter 429s after max within the window", async () => {
    const { createRateLimiter } = await import("../src/security.js");
    const mw = createRateLimiter({ windowMs: 60_000, max: 3, key: () => "fixed" });
    const run = () => {
      let status = 200;
      const req: any = { header: () => "", ip: "1.1.1.1", socket: {} };
      const res: any = { setHeader() {}, status(s: number) { status = s; return this; }, json() { return this; } };
      let nexted = false;
      mw(req, res, () => { nexted = true; });
      return { status, nexted };
    };
    expect(run().nexted).toBe(true); // 1
    expect(run().nexted).toBe(true); // 2
    expect(run().nexted).toBe(true); // 3
    const fourth = run();
    expect(fourth.nexted).toBe(false); // 4 → blocked
    expect(fourth.status).toBe(429);
  });

  it("validateEntity accepts unicode names but rejects pipes/control chars", async () => {
    const { validateEntity } = await import("../src/security.js");
    expect(validateEntity("Acme Corporation W.L.L.").ok).toBe(true);
    expect(validateEntity("شركة المثال").ok).toBe(true); // Arabic
    expect(validateEntity("Acme | extra: forged").ok).toBe(false); // pipe (field separator)
    expect(validateEntity("bad\nname").ok).toBe(false); // newline
    expect(validateEntity("").ok).toBe(false);
    expect(validateEntity("x".repeat(500)).ok).toBe(true); // clamped, not rejected
  });

  it("validateCr rejects junk, allows registration-style strings + empty", async () => {
    const { validateCr } = await import("../src/security.js");
    expect(validateCr(undefined).ok).toBe(true);
    expect(validateCr("CR-123456/QA").ok).toBe(true);
    expect(validateCr("inject; drop").ok).toBe(false);
  });
});

// ── Integration: needs a DB ────────────────────────────────────────────────────
let memServer: { getUri(): string; stop(): Promise<void> } | null = null;
let dbAvailable = false;
try {
  const mod = await import("mongodb-memory-server");
  memServer = await mod.MongoMemoryServer.create();
  process.env.MONGODB_URI = memServer.getUri();
  dbAvailable = true;
} catch (e) {
  console.warn("[hardening] mongodb-memory-server unavailable — DB cases skipped:", (e as Error).message);
}

const server = await import("../src/server.js");
const app = server.app;
const db = await import("../src/db.js");

beforeAll(async () => {
  if (dbAvailable) await db.connectDb();
  await server.initKeys();
}, 60_000);

afterAll(async () => {
  if (dbAvailable) await db.closeDb();
  if (memServer) await memServer.stop();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("security headers", () => {
  it("sets nosniff + frame-deny on responses", async () => {
    const res = await supertest(app).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});

describe.skipIf(!dbAvailable)("admin input validation", () => {
  it("rejects an entity containing a pipe", async () => {
    const res = await supertest(app)
      .post("/admin/accounts")
      .set(auth(ADMIN))
      .send({ account: "badco", label: "Bad Co", entity: "Bad | extra: x" });
    expect(res.status).toBe(400);
  });
});

describe.skipIf(!dbAvailable)("certification revocation E2E", () => {
  let apiKey = "";
  const DOC = "title: Tender Award\n\ntext: Acme wins lot 3.\n";

  it("sets up an account + key", async () => {
    const acc = await supertest(app).post("/admin/accounts").set(auth(ADMIN)).send({ account: "acme", label: "Acme" });
    expect(acc.status).toBe(201);
    const key = await supertest(app).post("/admin/keys").set(auth(ADMIN)).send({ account: "acme", label: "ci" });
    expect(key.status).toBe(201);
    apiKey = key.body.apiKey;
    expect(apiKey).toMatch(/^uts_/);
  });

  let certified = "";
  let hash = "";
  it("certifies a document, which then verifies valid + not revoked", async () => {
    const c = await supertest(app).post("/certify").set(auth(apiKey)).send({ source: DOC });
    expect(c.status).toBe(200);
    certified = c.body.source;
    hash = /hash:\s*(sha256:[0-9a-f]+)/.exec(certified)![1];

    const v = await supertest(app).post("/verify").send({ source: certified });
    expect(v.status).toBe(200);
    expect(v.body.certifications[0].signatureValid).toBe(true);
    expect(v.body.certifications[0].revoked).toBe(false);
  });

  it("revoking the hash flips /verify to revoked + invalid and lists it", async () => {
    const r = await supertest(app).post("/admin/revoke").set(auth(ADMIN)).send({ hash, reason: "issued in error" });
    expect(r.status).toBe(201);

    const v = await supertest(app).post("/verify").send({ source: certified });
    expect(v.body.certifications[0].revoked).toBe(true);
    expect(v.body.certifications[0].valid).toBe(false);

    const list = await supertest(app).get("/revocations");
    expect(list.body.revocations.some((x: any) => x.value === hash)).toBe(true);
  });

  it("writes an append-only audit trail of the privileged actions", async () => {
    const { audit } = db.getCollections();
    const actions = (await audit.find({}).toArray()).map((a) => a.action);
    expect(actions).toContain("account.create");
    expect(actions).toContain("key.mint");
    expect(actions).toContain("cert.issue");
    expect(actions).toContain("cert.revoke");
  });
});

describe.skipIf(!dbAvailable)("admin auth", () => {
  it("rejects a wrong admin token", async () => {
    const res = await supertest(app).post("/admin/revoke").set(auth("nope")).send({ hash: "sha256:" + "a".repeat(32) });
    expect(res.status).toBe(401);
  });
});
