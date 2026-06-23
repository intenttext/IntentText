/**
 * reserved-routing.test.ts — FORMAT-REVIEW T-02.
 *
 * `certify`, `route`, `require` were load-bearing keywords the core read (the
 * sign/seal stack reads `certify:` from source; workflowState reads route:/require:)
 * yet they were absent from the registry and parsed as generic `custom` blocks. They
 * are now reserved. These tests pin: (1) they parse as their own block types;
 * (2) byte-identical round-trip (no seal drift); (3) route/require render as the
 * single Approval-route panel with live state — never as raw [custom] junk — and
 * certify renders nothing inline (consolidated into the trust band like sign/freeze);
 * (4) workflowState still derives; (5) route/require stay IN the content hash while
 * certify stays excluded.
 */
import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  documentToSource,
  renderHTML,
  workflowState,
  computeDocumentHash,
  CANONICAL_KEYWORDS,
} from "../src/index";

const PO = `title: Purchase Order PO-9001
route: sequential
require: manager
require: finance | when: amount > 100000
require: legal
metric: Amount | value: 250000 | unit: USD
section: Approvals
approve: Within budget | by: Sarah Chen | role: manager | at: 2026-03-20
approve: Funds confirmed | by: James Miller | role: finance | at: 2026-03-21
certify: UTS | account: acme | hash: sha256:abc123
`;

describe("T-02: route/require/certify are reserved keywords", () => {
  it("are in the canonical set", () => {
    expect(CANONICAL_KEYWORDS).toContain("route");
    expect(CANONICAL_KEYWORDS).toContain("require");
    expect(CANONICAL_KEYWORDS).toContain("certify");
  });

  it("parse as their own block types (not custom)", () => {
    const d = parseIntentText("certify: UTS | hash: sha256:x\nroute: parallel\nrequire: legal\n");
    expect(d.blocks.map((b) => b.type)).toEqual(["certify", "route", "require"]);
  });

  it("round-trip byte-identically (idempotent — no seal drift)", () => {
    const once = documentToSource(parseIntentText(PO));
    const twice = documentToSource(parseIntentText(once));
    expect(twice).toBe(once);
    expect(once).toContain("route: sequential");
    expect(once).toContain("require: finance | when: amount > 100000");
    expect(once).toContain("certify: UTS");
  });
});

describe("T-02: rendering", () => {
  const html = renderHTML(parseIntentText(PO));

  it("renders ONE approval-route panel, not raw [custom]/[route] junk", () => {
    expect(html).toContain("it-approval-route");
    // the real 'unknown block' marker — must be absent from the body
    expect(html).not.toContain("intent-unknown-type");
    expect(html).not.toContain("[route]");
    expect(html).not.toContain("[require]");
  });

  it("shows live state: approved approvers + the next pending one", () => {
    expect(html).toContain("is-approved"); // manager, finance
    expect(html).toContain("is-next"); // legal is next
    expect(html).toContain("manager");
    expect(html).toContain("legal");
  });

  it("certify renders nothing inline (it belongs to the trust band)", () => {
    const certHtml = renderHTML(parseIntentText("text: body\ncertify: UTS | hash: sha256:z\n"));
    expect(certHtml).not.toContain("UTS");
  });

  it("renders the panel even when route/require sit under a section", () => {
    const nested = renderHTML(
      parseIntentText("section: Approvals\n  route: sequential\n  require: manager\n"),
    );
    expect(nested).toContain("it-approval-route");
  });
});

describe("T-02: workflow + hash behaviour", () => {
  it("workflowState still derives next/complete", () => {
    const wf = workflowState(PO);
    expect(wf.next).toBe("legal");
    expect(wf.complete).toBe(false);
    expect(wf.fulfilled).toEqual(expect.arrayContaining(["manager", "finance"]));
  });

  it("route/require are part of the content hash (real policy content)", () => {
    const base = "title: X\ntext: hi\n";
    expect(computeDocumentHash(base + "route: parallel\n")).not.toBe(
      computeDocumentHash(base),
    );
    expect(computeDocumentHash(base + "require: legal\n")).not.toBe(
      computeDocumentHash(base),
    );
  });

  it("certify stays EXCLUDED from the content hash (authority, above the hash)", () => {
    const base = "title: X\ntext: hi\n";
    expect(computeDocumentHash(base + "certify: UTS | hash: sha256:z\n")).toBe(
      computeDocumentHash(base),
    );
  });
});
