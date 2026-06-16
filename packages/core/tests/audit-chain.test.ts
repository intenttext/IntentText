import { describe, it, expect } from "vitest";
import {
  appendApproval,
  verifyAuditChain,
  auditTrail,
  sealDocument,
  verifyDocument,
  workflowState,
} from "../src/index";

/**
 * Hash-chained audit trail: the approval SEQUENCE is tamper-evident. Each chained
 * approval carries prev: = hash of the prior audit event (or the body hash for the
 * first), so insert/delete/reorder breaks the chain.
 */

const BASE = `title: Purchase Order PO-9001
route: sequential
require: manager
require: finance
metric: Amount | value: 250000`;

describe("audit-chain — tamper-evident approval sequence", () => {
  it("appendApproval builds a valid hash chain", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager", note: "ok" });
    doc = appendApproval(doc, { by: "James", role: "finance", note: "funds ok" });

    const events = auditTrail(doc);
    expect(events.length).toBe(2);
    expect(events.every((e) => e.prev)).toBe(true);

    const res = verifyAuditChain(doc);
    expect(res.valid).toBe(true);
    expect(res.chained).toBe(2);
  });

  it("detects a DELETED approval (chain break)", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager" });
    doc = appendApproval(doc, { by: "James", role: "finance" });
    doc = appendApproval(doc, { by: "Lara", role: "legal" });
    expect(verifyAuditChain(doc).valid).toBe(true);

    // Remove the MIDDLE approval — the third link's prev no longer matches.
    const tampered = doc
      .split("\n")
      .filter((l) => !l.includes("role: finance"))
      .join("\n");
    const res = verifyAuditChain(tampered);
    expect(res.valid).toBe(false);
    expect(res.brokenAt).toBeGreaterThanOrEqual(1);
  });

  it("detects a REORDERED approval", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager" });
    doc = appendApproval(doc, { by: "James", role: "finance" });
    const lines = doc.split("\n");
    const i = lines.findIndex((l) => l.includes("role: manager"));
    const j = lines.findIndex((l) => l.includes("role: finance"));
    [lines[i], lines[j]] = [lines[j], lines[i]]; // swap order
    expect(verifyAuditChain(lines.join("\n")).valid).toBe(false);
  });

  it("detects an EDITED approval (content tamper inside the chain)", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager" });
    doc = appendApproval(doc, { by: "James", role: "finance" });
    // Forge the first approver's name — breaks the second link's prev.
    const tampered = doc.replace("by: Sarah", "by: Mallory");
    expect(verifyAuditChain(tampered).valid).toBe(false);
  });

  it("plain (un-chained) approve: lines are not failures, just unchained", () => {
    const doc = BASE + `\napprove: ok | by: A | role: manager | at: 2026-03-20`;
    const res = verifyAuditChain(doc);
    expect(res.valid).toBe(true);
    expect(res.chained).toBe(0);
    expect(res.length).toBe(1);
  });

  it("chained approvals also drive workflowState (role/by recognised)", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager" });
    const s = workflowState(doc);
    expect(s.fulfilled).toContain("manager");
    expect(s.next).toBe("finance");
  });

  it("a chained, then SEALED document verifies and the chain holds", () => {
    let doc = appendApproval(BASE, { by: "Sarah", role: "manager" });
    doc = appendApproval(doc, { by: "James", role: "finance" });
    const sealed = sealDocument(doc, { signer: "Notary", role: "notary" });
    expect(sealed.success).toBe(true);
    expect(verifyDocument(sealed.source).intact).toBe(true);
    expect(verifyAuditChain(sealed.source).valid).toBe(true);
  });
});
