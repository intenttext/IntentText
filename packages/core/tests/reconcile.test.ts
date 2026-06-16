import { describe, it, expect } from "vitest";
import {
  reconcileEdit,
  documentToSource,
  parseIntentText,
  computeDocumentHash,
} from "../src/index";

/**
 * Source-preserving edit reconciliation: an edit must change ONLY the bytes that
 * actually changed; unchanged blocks keep their exact original source (so a sealed
 * document keeps its hash and hand-authored formatting survives).
 */

// A hand-authored document with comments, blank lines, and bare prose — the kind
// of formatting a model serializer would normalize away.
const ORIGINAL = `// vendor agreement — hand-authored
title: Vendor Agreement

section: 1. Term
Either party may terminate with 30 days written notice.

section: 2. Payment
Net 30 from invoice date.`;

/** Simulate what an editor would emit: re-serialize the parsed model (canonical). */
const reserialize = (src: string) => documentToSource(parseIntentText(src));

describe("reconcileEdit — source-preserving edits", () => {
  it("no-op edit round-trips byte-for-byte", () => {
    // Editor opened and saved with no change → canonical re-serialization …
    const editorOutput = reserialize(ORIGINAL);
    // … but reconcile against the original restores the exact bytes.
    expect(reconcileEdit(ORIGINAL, editorOutput)).toBe(ORIGINAL);
  });

  it("keeps the original hash on a no-op edit (seal-safe)", () => {
    const editorOutput = reserialize(ORIGINAL);
    const reconciled = reconcileEdit(ORIGINAL, editorOutput);
    expect(computeDocumentHash(reconciled)).toBe(computeDocumentHash(ORIGINAL));
  });

  it("a single changed block touches only that block; the rest stays verbatim", () => {
    // Edit only the payment line.
    const editedModel = ORIGINAL.replace("Net 30 from invoice date.", "Net 45 from invoice date.");
    const editorOutput = reserialize(editedModel);
    const reconciled = reconcileEdit(ORIGINAL, editorOutput);

    // The change is present …
    expect(reconciled).toContain("Net 45 from invoice date.");
    expect(reconciled).not.toContain("Net 30 from invoice date.");
    // … and the untouched parts kept their exact original bytes.
    expect(reconciled).toContain("// vendor agreement — hand-authored");
    expect(reconciled).toContain("Either party may terminate with 30 days written notice.");
    // The Term section block is identical to the original's.
    expect(reconciled).toContain("section: 1. Term\nEither party may terminate");
  });

  it("preserves bare prose (does not re-add text:) on a no-op edit", () => {
    const editorOutput = reserialize(ORIGINAL);
    const reconciled = reconcileEdit(ORIGINAL, editorOutput);
    expect(reconciled).not.toMatch(/^text:/m);
  });

  it("is idempotent (reconciling an already-reconciled doc is stable)", () => {
    const once = reconcileEdit(ORIGINAL, reserialize(ORIGINAL));
    const twice = reconcileEdit(ORIGINAL, reserialize(once));
    expect(twice).toBe(once);
  });
});
