import { describe, it, expect } from "vitest";
import {
  sealDocument,
  verifyDocument,
  verifyTrust,
  computeHistoryHash,
  parseIntentText,
  renderPrint,
} from "../src/index";

// A sealed contract's revision log lives BELOW the `history:` boundary, which the
// body/seal hash deliberately excludes. Before this, the log had zero integrity —
// it could be edited/reordered/truncated and everything still verified. The seal
// now commits a digest of the history section into the freeze line (seal-scope),
// so any change to the audit log breaks verification. These are the red-team cases.

const withHistory = `title: Murabaha Facility Agreement
meta: | ref: QIIB-MRB-2026-0417
The Bank agrees to provide a Murabaha facility of 5,000,000 QAR.
approve: Credit review complete | by: Layla Al-Kuwari | role: Head of Credit Risk | at: 2026-06-20

history:

// revisions
revision: | version: 1.1 | at: 2026-06-19T09:00:00Z | by: Layla | change: modified | id: a1 | block: text | was: 3,000,000 QAR | now: 5,000,000 QAR
revision: | version: 1.2 | at: 2026-06-20T09:00:00Z | by: Fahad | change: added | id: b2 | block: approve | now: Final authorization`;

function seal(src: string): string {
  return sealDocument(src, {
    signer: "Fahad Al-Thani",
    role: "Head of Corporate Banking",
  }).source;
}

describe("history integrity — committed digest", () => {
  it("seals a history digest into the freeze line", () => {
    const src = seal(withHistory);
    expect(src).toMatch(/freeze:.*\| history: sha256:[0-9a-f]{64}/);
  });

  it("verifies intact for an untampered sealed doc (seal + history + chain)", () => {
    const src = seal(withHistory);
    const r = verifyTrust(src);
    expect(r.ok).toBe(true);
    expect(r.seal.intact).toBe(true);
    expect(r.seal.historyIntact).toBe(true);
  });

  it("catches EDITING a revision value", () => {
    const src = seal(withHistory).replace("now: 5,000,000 QAR", "now: 9,000,000 QAR");
    const r = verifyDocument(src);
    expect(r.historyIntact).toBe(false);
    expect(r.intact).toBe(false);
    expect(verifyTrust(src).ok).toBe(false);
  });

  it("catches DELETING the last revision (tail truncation)", () => {
    const src = seal(withHistory)
      .split("\n")
      .filter((l) => !l.includes("Final authorization"))
      .join("\n");
    expect(verifyDocument(src).historyIntact).toBe(false);
    expect(verifyTrust(src).ok).toBe(false);
  });

  it("catches REORDERING two revisions", () => {
    const lines = seal(withHistory).split("\n");
    const i = lines.findIndex((l) => l.includes("version: 1.1"));
    const j = lines.findIndex((l) => l.includes("version: 1.2"));
    [lines[i], lines[j]] = [lines[j], lines[i]];
    expect(verifyDocument(lines.join("\n")).historyIntact).toBe(false);
  });

  it("catches INSERTING a forged revision", () => {
    const src = seal(withHistory).replace(
      "// revisions",
      "// revisions\nrevision: | version: 1.15 | at: 2026-06-19T12:00:00Z | by: Ghost | change: modified | id: x | block: text | now: FORGED",
    );
    expect(verifyDocument(src).historyIntact).toBe(false);
  });

  it("catches INJECTING a fake history: block onto a doc sealed without one", () => {
    const noHistory = `title: Simple Contract\nmeta: | ref: X\nThe parties agree to the terms herein.`;
    const src =
      seal(noHistory).replace(/\n+$/, "") +
      "\nhistory:\nrevision: | version: 99 | by: Attacker | change: modified | now: injected\n";
    const r = verifyDocument(src);
    expect(r.historyIntact).toBe(false);
    expect(r.intact).toBe(false);
  });

  it("does NOT break on cosmetic reformatting of a history comment", () => {
    const src = seal(withHistory).replace("// revisions", "//   revisions   ");
    const r = verifyDocument(src);
    expect(r.historyIntact).toBe(true);
    expect(r.intact).toBe(true);
  });

  it("a body edit is still caught by the seal (history untouched)", () => {
    const src = seal(withHistory).replace(
      "facility of 5,000,000 QAR",
      "facility of 9,000,000 QAR",
    );
    const r = verifyDocument(src);
    expect(r.intact).toBe(false);
    expect(r.historyIntact).toBe(true); // the history section itself is unchanged
  });

  it("computeHistoryHash is stable for empty vs present history", () => {
    expect(computeHistoryHash("title: X\nBody.")).toBe(computeHistoryHash("title: Y\nOther."));
    expect(computeHistoryHash(withHistory)).not.toBe(computeHistoryHash("title: X\nBody."));
  });

  // The print/HTML renderer verifies the trust stamp against a source. It receives a
  // parsed document and, without help, re-serializes it (dropping the history section,
  // since it parses without includeHistorySection) — which would paint a FALSE "SEAL
  // BROKEN" now that history is checked. RenderOptions.source fixes it.
  it("renderPrint stamp uses options.source (history-bearing sealed doc → SEALED, not broken)", () => {
    const src = seal(withHistory);
    const doc = parseIntentText(src); // parsed WITHOUT history
    const withSrc = renderPrint(doc, { source: src });
    expect(withSrc).toContain("SEALED");
    expect(withSrc).not.toContain("SEAL BROKEN");
    // Without the source hint, the re-serialization drops history → false broken.
    expect(renderPrint(doc)).toContain("SEAL BROKEN");
  });
});
