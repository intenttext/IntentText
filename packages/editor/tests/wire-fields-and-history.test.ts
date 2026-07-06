import { describe, it, expect } from "vitest";
import {
  sourceToDoc,
  docToSource,
  reconcileSavePreservingHistory,
} from "../src/bridge";
import { reconcileEdit } from "@dotit/core";

// The editor's naive save pipeline (pre-C-4).
const editorSaveNaive = (base: string, modelSource: string) =>
  reconcileEdit(base, docToSource(sourceToDoc(modelSource)));

// The editor's ACTUAL save pipeline (post-C-4): history-preserving.
const editorSave = (base: string, modelSource: string) =>
  reconcileSavePreservingHistory(base, docToSource(sourceToDoc(modelSource)));

// ─── C-3 ─────────────────────────────────────────────────────────────────────
// Single-word-label lines (IBAN:, SWIFT:, Beneficiary:) parse to custom blocks. The
// bridge compared the source keyword against block.type ("custom") not the keyword, so
// they were never consumed and got duplicated + lowercased on the first edit —
// corrupting wire data (and sign: lines) the moment a user touched the document.
describe("C-3: single-word-label wire fields survive editing", () => {
  const DOC = `title: Payment Instruction

IBAN: DE89 3704 0044 0532 0130 00
SWIFT: DEUTDEDBFRA
Beneficiary: ACME Corp

Please process the transfer.`;

  it("a no-op save does not duplicate or lowercase the label lines", () => {
    expect(editorSaveNaive(DOC, DOC)).toBe(DOC);
  });

  it("editing the prose leaves each wire field byte-exact (one each, casing kept)", () => {
    const edited = DOC.replace(
      "Please process the transfer.",
      "Please process the transfer today.",
    );
    const saved = editorSaveNaive(DOC, edited);
    expect(saved.match(/IBAN: DE89 3704 0044 0532 0130 00/g)?.length).toBe(1);
    expect(saved).toContain("SWIFT: DEUTDEDBFRA");
    expect(saved).toContain("Beneficiary: ACME Corp");
    expect(saved).not.toMatch(/^iban:/m); // case-sensitive: no lowercased duplicate
    expect(saved).not.toMatch(/^beneficiary:/m);
    expect(saved).toContain("Please process the transfer today.");
  });
});

// ─── C-4 ─────────────────────────────────────────────────────────────────────
// reconcileEdit alone re-serializes via documentToSource, which drops the `history:`
// audit section — so editing a document with an approval trail silently DESTROYED the
// whole trail. The save now splits at the history boundary and re-appends the tail.
describe("C-4: editing never destroys the history/audit trail", () => {
  const DOC = `title: Wire Approval

text: Release USD 500k to account 999.

approve: Ops Lead | by: Ops Lead | at: 2026-01-01

history:

approval: 1 | by: Ops Lead | at: 2026-01-01 | hash: sha256:aaa
approval: 2 | by: Director | at: 2026-01-02 | hash: sha256:bbb`;

  it("REGRESSION: the naive save destroyed the audit trail (documents the bug)", () => {
    expect(editorSaveNaive(DOC, DOC)).not.toContain("approval: 2 | by: Director");
  });

  it("a no-op save keeps the full document byte-identical, history included", () => {
    expect(editorSave(DOC, DOC)).toBe(DOC);
  });

  it("editing the body preserves the entire history tail verbatim", () => {
    const edited = DOC.replace(
      "Release USD 500k to account 999.",
      "Release USD 500k to account 999 (approved).",
    );
    const saved = editorSave(DOC, edited);
    expect(saved).toContain("Release USD 500k to account 999 (approved).");
    expect(saved).toContain("approval: 1 | by: Ops Lead | at: 2026-01-01 | hash: sha256:aaa");
    expect(saved).toContain("approval: 2 | by: Director | at: 2026-01-02 | hash: sha256:bbb");
  });

  it("a document with no history still round-trips (no regression)", () => {
    const plain = `title: Note\n\ntext: Just a plain body, no history.`;
    expect(editorSave(plain, plain)).toBe(plain);
  });
});
