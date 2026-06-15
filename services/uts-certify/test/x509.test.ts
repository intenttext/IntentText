/**
 * x509.test.ts — UTS-as-X.509-CA: the PAdES issuance flow, end to end.
 *
 * Proves the full chain a customer relies on to make an exported `.it` PDF legally
 * defensible: a KYC-verified account sends a CSR (keeping its private key), UTS
 * issues a leaf signing cert under the verified entity, the customer PAdES-signs a
 * PDF with that cert + its own key, and a verifier holding ONLY the UTS CA cert
 * confirms the signature chains to UTS.
 *
 * DB path mirrors roundtrip.test.ts: in-memory MongoDB if available, else skip the
 * DB-backed cases (the gate/disable cases still run without a DB).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { generateSigningKey } from "@dotit/sign";
import {
  createCsr,
  signerFromPem,
  signPdf,
  verifyPdfSignature,
  parseCertificatePem,
} from "@dotit/pades";

const ADMIN = "test-admin-token";
const PRIV = generateSigningKey().privateKey;

process.env.UTS_ADMIN_TOKEN = ADMIN;
process.env.UTS_PRIVATE_KEY = PRIV;
process.env.DB_NAME = "uts_x509_test";
process.env.ISSUER = "UTS";
process.env.UTS_KEY_PROVIDER = "env";
// Force the dev X.509 CA path (generate a CA into a throwaway .keys file).
delete process.env.UTS_X509_CA_CERT;
delete process.env.UTS_X509_CA_KEY;
delete process.env.UTS_X509;

let memServer: { getUri(): string; stop(): Promise<void> } | null = null;
let dbAvailable = false;

async function tryStartDb(): Promise<void> {
  try {
    const mod = await import("mongodb-memory-server");
    memServer = await mod.MongoMemoryServer.create();
    process.env.MONGODB_URI = memServer.getUri();
    dbAvailable = true;
    return;
  } catch {
    /* fall through */
  }
  if (process.env.MONGODB_URI) {
    try {
      const { MongoClient } = await import("mongodb");
      const c = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 1500 });
      await c.connect();
      await c.close();
      dbAvailable = true;
    } catch {
      /* not reachable */
    }
  }
}

await tryStartDb();

const server = await import("../src/server.js");
const app: import("express").Express = server.app;
const db = await import("../src/db.js");

/** A correct minimal 1-page PDF (mirrors @dotit/pades' test helper). */
function minimalPdf(): Uint8Array {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefStart = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    body += String(off).padStart(10, "0") + " 00000 n \n";
  });
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

beforeAll(async () => {
  if (dbAvailable) await db.connectDb();
  await server.initKeys();
  await server.initX509(); // generates the dev CA in .keys/
}, 60_000);

afterAll(async () => {
  if (dbAvailable) await db.closeDb();
  if (memServer) await memServer.stop();
});

describe("X.509 CA publication + gating", () => {
  it("publishes the CA certificate as PEM", async () => {
    const pem = await supertest(app).get("/.well-known/uts-ca.pem").expect(200);
    expect(pem.text).toContain("BEGIN CERTIFICATE");
    const ca = await supertest(app).get("/ca").expect(200);
    expect(ca.body.algorithm).toBe("ecdsa-p256");
    expect(ca.body.caCertPem).toContain("BEGIN CERTIFICATE");
  });

  it("rejects an unauthenticated /certify/x509", async () => {
    await supertest(app).post("/certify/x509").send({ csr: "x" }).expect(401);
  });
});

describe.skipIf(!dbAvailable)("UTS-as-CA issuance round-trip (DB-backed)", () => {
  const ACCOUNT = "dalil-tech";
  const ENTITY = "Dalil Technology LLC";
  let apiKey = "";

  it("KYC-unverified account is refused a signing cert (403)", async () => {
    const req = supertest(app);
    await req
      .post("/admin/accounts")
      .set("Authorization", `Bearer ${ADMIN}`)
      .send({ account: ACCOUNT, label: "Dalil" })
      .expect(201);
    const mint = await req
      .post("/admin/keys")
      .set("Authorization", `Bearer ${ADMIN}`)
      .send({ account: ACCOUNT, label: "ci" })
      .expect(201);
    apiKey = mint.body.apiKey;

    const csr = await createCsr({ commonName: "ignored" });
    const res = await req
      .post("/certify/x509")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ csr: csr.csrPem })
      .expect(403);
    expect(res.body.error).toBe("kyc_required");
  });

  it("verified account: CSR → leaf cert → PAdES-sign → chains to the UTS CA", async () => {
    const req = supertest(app);
    await req
      .post(`/admin/accounts/${ACCOUNT}/verify`)
      .set("Authorization", `Bearer ${ADMIN}`)
      .send({ entity: ENTITY, cr: "CR-99001" })
      .expect(200);

    // CLIENT: generate keypair + CSR. The private key never leaves here.
    const csr = await createCsr({ commonName: "self-claim-ignored", organization: "Dalil" });

    const issued = await req
      .post("/certify/x509")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ csr: csr.csrPem })
      .expect(201);
    expect(issued.body.commonName).toBe(ENTITY);
    expect(issued.body.certPem).toContain("BEGIN CERTIFICATE");
    expect(issued.body.fingerprint).toMatch(/^[0-9a-f]{64}$/);

    // CLIENT signs a PDF with the UTS-issued cert + its OWN private key.
    const signer = await signerFromPem(issued.body.certPem, csr.privateKeyPem);
    const caCert = parseCertificatePem(issued.body.chainPem);
    const signed = await signPdf(minimalPdf(), {
      certificate: signer.certificate,
      privateKey: signer.privateKey,
      chain: [caCert],
    });

    // A verifier holding ONLY the UTS CA cert confirms the chain + the entity.
    const v = await verifyPdfSignature(signed, { trustedRoots: [caCert] });
    expect(v.valid).toBe(true);
    expect(v.chainValid).toBe(true);
    expect(v.signerCommonName).toBe(ENTITY);

    // And the issuance was logged (public material only).
    const log = await db.getCollections().x509Certs.findOne({ account: ACCOUNT });
    expect(log?.commonName).toBe(ENTITY);
    expect(log?.fingerprint).toBe(issued.body.fingerprint);
  });

  it("rejects a malformed CSR (400 bad_csr)", async () => {
    await supertest(app)
      .post("/certify/x509")
      .set("Authorization", `Bearer ${apiKey}`)
      .send({ csr: "-----BEGIN CERTIFICATE REQUEST-----\nnonsense\n-----END CERTIFICATE REQUEST-----\n" })
      .expect(400);
  });
});
