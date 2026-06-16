import { describe, it, expect } from "vitest";
import { workflowState, extractRoute, documentToSource, parseIntentText } from "../src/index";

/**
 * In-file approval routing — DERIVED, never stored. The document declares its
 * route with route:/require: and fulfills it with approve: lines; workflowState
 * derives pending/next/complete purely from the file.
 */

const BASE = `title: Purchase Order PO-9001
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
metric: Amount | value: 250000`;

describe("workflowState — derived in-file approval routing", () => {
  it("reads the route policy from route:/require: lines", () => {
    const route = extractRoute(parseIntentText(BASE));
    expect(route?.order).toBe("sequential");
    expect(route?.required.map((r) => r.match)).toEqual(["manager", "finance", "legal"]);
    expect(route?.required[1].when).toBe("amount > 100000");
  });

  it("nothing approved yet → all required pending, next is the first", () => {
    const s = workflowState(BASE);
    expect(s.hasRoute).toBe(true);
    expect(s.fulfilled).toEqual([]);
    expect(s.pending).toEqual(["manager", "finance", "legal"]);
    expect(s.next).toBe("manager");
    expect(s.complete).toBe(false);
  });

  it("derives next as manager → finance → legal as approvals arrive (sequential)", () => {
    let doc = BASE + `\napprove: ok | by: Sarah | role: manager | at: 2026-03-20`;
    expect(workflowState(doc).next).toBe("finance");
    expect(workflowState(doc).fulfilled).toEqual(["manager"]);

    doc += `\napprove: ok | by: James | role: finance | at: 2026-03-21`;
    expect(workflowState(doc).next).toBe("legal");

    doc += `\napprove: ok | by: Lara | role: legal | at: 2026-03-22`;
    const s = workflowState(doc);
    expect(s.pending).toEqual([]);
    expect(s.next).toBe(null);
    expect(s.complete).toBe(true);
  });

  it("conditional approver: finance NOT required when amount ≤ threshold", () => {
    const small = `title: PO
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
metric: Amount | value: 5000
approve: ok | by: A | role: manager | at: 2026-03-20
approve: ok | by: B | role: legal | at: 2026-03-21`;
    const s = workflowState(small);
    // finance's when: is false (5000 ≤ 100000) → not active, not pending.
    expect(s.active.map((r) => r.match)).toEqual(["manager", "legal"]);
    expect(s.pending).toEqual([]);
    expect(s.complete).toBe(true);
  });

  it("conditional approver: finance IS required when amount > threshold", () => {
    const big = BASE + `\napprove: ok | by: A | role: manager | at: 2026-03-20`;
    const s = workflowState(big);
    expect(s.active.map((r) => r.match)).toContain("finance");
    expect(s.pending).toContain("finance");
    expect(s.complete).toBe(false);
  });

  it("parallel order → no single 'next'; complete when all approved", () => {
    const par = `title: X
route: parallel
require: a
require: b
approve: ok | by: A | role: a | at: 2026-03-20`;
    const s = workflowState(par);
    expect(s.order).toBe("parallel");
    expect(s.next).toBe(null);
    expect(s.pending).toEqual(["b"]);
    expect(s.complete).toBe(false);
  });

  it("optional approver never blocks completion", () => {
    const src = `title: X
route: sequential
require: manager
require: auditor | optional: yes
approve: ok | by: A | role: manager | at: 2026-03-20`;
    const s = workflowState(src);
    expect(s.pending).toEqual([]);
    expect(s.complete).toBe(true);
  });

  it("no route policy → hasRoute false, complete (nothing outstanding)", () => {
    const s = workflowState(`title: Plain doc\ntext: no workflow here`);
    expect(s.hasRoute).toBe(false);
    expect(s.complete).toBe(true);
  });

  it("route:/require: are preserved verbatim on round-trip (custom blocks, seal-safe)", () => {
    expect(documentToSource(parseIntentText(BASE))).toBe(BASE);
  });
});
