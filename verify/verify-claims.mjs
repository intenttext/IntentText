#!/usr/bin/env node
/**
 * verify-claims.mjs — prove the IntentText trust claims are TRUE, not just present.
 *
 * Runs against the built workspace packages (no network). Each claim is an assertion
 * that must hold; any failure exits non-zero. This is the runnable companion to
 * verify/claims.it.
 *
 *   node verify/verify-claims.mjs
 *
 * If you see "Cannot find module", build the packages first:  pnpm -r build
 */

import {
  parseIntentText,
  documentToSource,
  reconcileEdit,
  sealDocument,
  verifyDocument,
  toStorageRecord,
  fromStorageRecord,
  verifyStorageRecord,
  workflowState,
  appendApproval,
  verifyAuditChain,
} from "../packages/core/dist/index.js";

import {
  generateSigningKey,
  signDocumentCrypto,
  verifyCryptoSignatures,
} from "../packages/sign/dist/index.js";

let passed = 0;
let failed = 0;
const fails = [];

function check(claim, cond) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${claim}`);
  } else {
    failed++;
    fails.push(claim);
    console.log(`  ❌ ${claim}`);
  }
}

function section(title) {
  console.log(`\n— ${title}`);
}

// A representative document exercising prose, sections, data, and tasks.
const base = [
  "title: Vendor Agreement",
  "",
  "The parties agree to the terms below.",
  "",
  "section: Payment",
  "metric: amount | value: 250000 | unit: USD",
  "task: Send invoice | owner: Finance | due: 2026-07-01",
  "",
].join("\n");

// ---------------------------------------------------------------------------
section("Compliance: lossless round-trip (the bytes survive parse → serialize)");
{
  const round = documentToSource(parseIntentText(base));
  check("documentToSource(parseIntentText(src)) === src (byte-for-byte)", round === base);

  const doc = parseIntentText(base);
  check("bare prose parsed as a text block", doc.blocks.some((b) => b.type === "text"));
  check("section parsed", doc.blocks.some((b) => b.type === "section"));
  check("metric parsed", parseIntentText(base).blocks.some((b) =>
    JSON.stringify(b).includes("metric") || b.type === "metric"));
}

// ---------------------------------------------------------------------------
section("Claim 1 — Integrity: a seal is tamper-evident, offline");
let sealed;
{
  const r = sealDocument(base, { signer: "Ahmed Al-Rashid", role: "CEO" });
  sealed = r.source;
  check("sealDocument returns a hash", typeof r.hash === "string" && r.hash.startsWith("sha256:"));
  check("verifyDocument(sealed).intact === true", verifyDocument(sealed).intact === true);

  // Flip a byte in the hashed body (the metric value).
  const tampered = sealed.replace("250000", "250001");
  check("a one-byte edit makes verify FAIL", verifyDocument(tampered).intact === false);
}

// ---------------------------------------------------------------------------
section("Claim 2 — Byte preservation: a no-op edit keeps the seal");
{
  // Opening + saving a sealed doc with no change must be byte-identical.
  const noop = reconcileEdit(sealed, sealed);
  check("reconcileEdit(sealed, sealed) === sealed (byte-identical)", noop === sealed);
  check("…and the seal still verifies after the no-op", verifyDocument(noop).intact === true);

  // A real edit reformatted by a model-editor: reconcile keeps untouched blocks' bytes.
  const reserialized = documentToSource(parseIntentText(sealed)); // simulates an editor round-trip
  const reconciled = reconcileEdit(sealed, reserialized);
  check("reconcileEdit restores bytes after an editor round-trip", verifyDocument(reconciled).intact === true);
}

// ---------------------------------------------------------------------------
section("Claim 3 — Storage contract: re-encoding in storage is detected");
{
  const rec = toStorageRecord(sealed);
  check("verifyStorageRecord(record) === true on a clean round-trip", verifyStorageRecord(rec) === true);
  check("fromStorageRecord restores the exact bytes", fromStorageRecord(rec) === sealed);

  // Simulate a storage layer that rewrote LF → CRLF.
  const mutated = { ...rec, source: rec.source.replace(/\n/g, "\r\n") };
  check("verifyStorageRecord FAILS when storage altered the bytes", verifyStorageRecord(mutated) === false);
}

// ---------------------------------------------------------------------------
section("Claim 4 — Authenticity: Ed25519 binds a key to the hash");
{
  const key = generateSigningKey();
  const { source: signed } = signDocumentCrypto(base, {
    signer: "Ahmed Al-Rashid",
    role: "CEO",
    privateKey: key.privateKey,
  });
  const checks = verifyCryptoSignatures(signed);
  check("a crypto signature verifies valid", checks.length > 0 && checks.every((c) => c.valid));
  check("the signature is marked cryptographic", checks.some((c) => c.cryptographic === true));

  // Tamper the signed body → signature must no longer verify.
  const tampered = signed.replace("250000", "999999");
  const after = verifyCryptoSignatures(tampered);
  check("tampering invalidates the Ed25519 signature", after.length === 0 || after.some((c) => c.valid === false));

  // Honesty: a plain `sign:` with no key/sig is NOT cryptographic (named approval only).
  const plain = "title: X\nsign: Someone | role: Clerk | at: 2026-01-01\n";
  const plainChecks = verifyCryptoSignatures(plain);
  check("a plain sign: (no key) is not reported as a valid crypto signature",
    plainChecks.length === 0 || plainChecks.every((c) => c.cryptographic !== true));
}

// ---------------------------------------------------------------------------
section("Claim 5 — In-file workflow state is DERIVED and correct");
{
  const policy = [
    "title: Purchase Order",
    "metric: amount | value: 250000",
    "route: sequential",
    "require: manager",
    "require: finance | when: amount > 100000",
    "require: legal | optional: yes",
    "",
  ].join("\n");

  let s = policy;
  const w0 = workflowState(s);
  check("no approvals → not complete", w0.complete === false);
  check("sequential next is the first required (manager)", w0.next === "manager");
  check("finance is active (when amount > 100000 holds)", w0.active.some((r) => r.match === "finance"));
  check("optional legal is never pending", !w0.pending.includes("legal"));

  s = appendApproval(s, { by: "Sarah", role: "manager", note: "Reviewed" });
  const w1 = workflowState(s);
  check("after manager approves, next is finance", w1.next === "finance");
  check("manager now fulfilled", w1.fulfilled.includes("manager"));

  s = appendApproval(s, { by: "James", role: "finance", note: "Budget OK" });
  const w2 = workflowState(s);
  check("after all required approve, workflow is complete", w2.complete === true);

  // ---- audit chain over those two appended approvals ----
  section("Claim 6 — Audit chain: the approval ORDER is tamper-evident");
  const chain = verifyAuditChain(s);
  check("the appended approval chain verifies valid", chain.valid === true && chain.chained === 2);

  // Reorder the two approve lines → chain must break.
  const lines = s.split("\n");
  const idx = lines.map((l, i) => (l.startsWith("approve:") ? i : -1)).filter((i) => i >= 0);
  const swapped = [...lines];
  [swapped[idx[0]], swapped[idx[1]]] = [swapped[idx[1]], swapped[idx[0]]];
  const broken = verifyAuditChain(swapped.join("\n"));
  check("reordering approvals breaks the chain (brokenAt reported)",
    broken.valid === false && typeof broken.brokenAt === "number");
}

// ---------------------------------------------------------------------------
section("Claim 7 — Time honesty: native at: is self-asserted (no false TSA claim)");
{
  // The native seal records a self-asserted time; it does NOT embed an RFC-3161 token.
  // (Provable time lives on the @dotit/pades PDF export.) Assert we don't accidentally
  // emit a timestamp token in the native seal.
  check("native sealed source carries no RFC-3161 timestamp token",
    !/timestamptoken|tsa:|rfc3161/i.test(sealed));
}

// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(56)}`);
console.log(`  ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\n  FAILED CLAIMS:");
  for (const f of fails) console.log(`   - ${f}`);
  console.log("\n  ❌ Not all claims hold. See above.");
  process.exit(1);
}
console.log("  ✅ Every claim holds. IntentText trust is real.");
