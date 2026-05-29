import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  _resetIdCounter,
  detectHistoryBoundary,
} from "../src/parser";
import {
  computeDocumentHash,
  findHistoryBoundaryInSource,
  sealDocument,
  verifyDocument,
  generateBlockId,
  blockFingerprint,
  matchBlocksToRegistry,
  computeTrustDiff,
  incrementVersion,
} from "../src/trust";
import { updateHistory, parseHistorySection } from "../src/history";
import { validateDocumentSemantic } from "../src/validate";
import { documentToSource } from "../src/source";

beforeEach(() => {
  _resetIdCounter();
});

// ─── Sample Documents ────────────────────────────────────────────────────────

const trackedDoc = `title: Service Agreement
summary: Consulting services
track: | version: 1.0 | by: Ahmed

section: Scope
note: Consulting services March–June 2026
note: Value: USD 24,000`;

const signedDoc = `title: Service Agreement
summary: Consulting services
track: | version: 1.0 | by: Ahmed

section: Scope
note: Consulting services March–June 2026

section: Signatures
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:abc123`;

const frozenDoc = `title: Service Agreement
summary: Consulting services
track: | version: 1.0 | by: Ahmed

section: Scope
note: Consulting services March–June 2026

section: Signatures
sign: Ahmed Al-Rashid | role: CEO | at: 2026-03-06T14:32:00Z | hash: sha256:abc123
freeze: | at: 2026-03-06T15:14:00Z | hash: sha256:abc123 | status: locked`;

const docWithHistory = `title: Service Agreement
track: | version: 1.0 | by: Ahmed

section: Scope
note: Payment within 15 days.

history:

// registry
b7f3a | note | Scope | payment within 15 days.

// revisions
revision: | version: 1.0 | at: 2026-03-01T09:00:00Z | by: Ahmed | change: added | id: b7f3a | block: note | section: Scope | now: Payment within 30 days.
revision: | version: 1.1 | at: 2026-03-06T10:14:00Z | by: Ahmed | change: modified | id: b7f3a | block: note | section: Scope | was: Payment within 30 days. | now: Payment within 15 days.`;

// ─── Parser Tests ────────────────────────────────────────────────────────────

describe("Parser — Trust Keywords", () => {
  it("parses track: block to metadata.tracking", () => {
    const doc = parseIntentText(trackedDoc);
    expect(doc.metadata?.tracking).toEqual({
      version: "1.0",
      by: "Ahmed",
      active: true,
    });
  });

  it("track: block is not emitted as a regular block", () => {
    const doc = parseIntentText(trackedDoc);
    const trackBlocks = doc.blocks.filter((b) => b.type === "track");
    expect(trackBlocks).toHaveLength(0);
  });

  it("parses sign: blocks to metadata.signatures array", () => {
    const doc = parseIntentText(signedDoc);
    expect(doc.metadata?.signatures).toBeDefined();
    expect(doc.metadata?.signatures).toHaveLength(1);
    expect(doc.metadata?.signatures?.[0].signer).toBe("Ahmed Al-Rashid");
    expect(doc.metadata?.signatures?.[0].role).toBe("CEO");
    expect(doc.metadata?.signatures?.[0].hash).toBe("sha256:abc123");
  });

  it("sign: blocks are still emitted for rendering", () => {
    const doc = parseIntentText(signedDoc);
    const signBlocks = doc.blocks
      .flatMap(function collect(b): typeof doc.blocks {
        return [b, ...(b.children ?? []).flatMap(collect)];
      })
      .filter((b) => b.type === "sign");
    expect(signBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it("parses freeze: block to metadata.freeze", () => {
    const doc = parseIntentText(frozenDoc);
    expect(doc.metadata?.freeze).toEqual({
      at: "2026-03-06T15:14:00Z",
      hash: "sha256:abc123",
      status: "locked",
    });
  });

  it("detects v2.8 when trust blocks present", () => {
    const doc = parseIntentText(trackedDoc);
    expect(doc.version).toBe("2.8");
  });

  it("parses approve: block as normal block with by property", () => {
    const source = `title: Contract\napprove: Reviewed by legal | by: Sarah | role: Legal Counsel | at: 2026-03-05T11:00:00Z`;
    const doc = parseIntentText(source);
    const approveBlocks = doc.blocks.filter((b) => b.type === "approve");
    expect(approveBlocks).toHaveLength(1);
    expect(approveBlocks[0].content).toBe("Reviewed by legal");
    expect(approveBlocks[0].properties?.by).toBe("Sarah");
    expect(approveBlocks[0].properties?.role).toBe("Legal Counsel");
  });
});

describe("Parser — History Boundary", () => {
  it("finds correct position of history boundary", () => {
    const lines = docWithHistory.split(/\r?\n/);
    const idx = detectHistoryBoundary(lines);
    expect(idx).toBeGreaterThan(0);
    expect(lines[idx].trim()).toBe("history:");
  });

  it("returns -1 when no history boundary", () => {
    const lines = trackedDoc.split(/\r?\n/);
    const idx = detectHistoryBoundary(lines);
    expect(idx).toBe(-1);
  });

  it("parser skips history section for block output", () => {
    const doc = parseIntentText(docWithHistory);
    // Should not have any revision: blocks in blocks array
    const allBlocks = doc.blocks.flatMap(
      function collect(b): typeof doc.blocks {
        return [b, ...(b.children ?? []).flatMap(collect)];
      },
    );
    const revisionBlocks = allBlocks.filter((b) => b.type === "revision");
    expect(revisionBlocks).toHaveLength(0);
  });

  it("parser with includeHistorySection returns history data", () => {
    const doc = parseIntentText(docWithHistory, {
      includeHistorySection: true,
    });
    expect(doc.history).toBeDefined();
    expect(doc.history?.registry).toHaveLength(1);
    expect(doc.history?.revisions).toHaveLength(2);
    expect(doc.history?.revisions[0].by).toBe("Ahmed");
    expect(doc.history?.revisions[1].change).toBe("modified");
  });

  it("divider before history boundary is not emitted as a divider block", () => {
    const doc = parseIntentText(docWithHistory);
    const dividerBlocks = doc.blocks.filter((b) => b.type === "divider");
    // The --- before // history should not be a divider block
    expect(dividerBlocks).toHaveLength(0);
  });
});

// ─── Trust Engine Tests ──────────────────────────────────────────────────────

describe("Trust Engine — Hash", () => {
  it("computeDocumentHash: same input always same output", () => {
    const h1 = computeDocumentHash(trackedDoc);
    const h2 = computeDocumentHash(trackedDoc);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("computeDocumentHash: hash changes when content changes", () => {
    const h1 = computeDocumentHash(trackedDoc);
    const h2 = computeDocumentHash(trackedDoc + "\nnote: extra");
    expect(h1).not.toBe(h2);
  });

  it("computeDocumentHash: excludes history section", () => {
    const withoutHistory = `title: Test\nnote: Hello`;
    const withHistory = `title: Test\nnote: Hello\n\n---\n// history\n\n// registry\na1b2c | note | root | hello\n`;
    const h1 = computeDocumentHash(withoutHistory);
    const h2 = computeDocumentHash(withHistory);
    expect(h1).toBe(h2);
  });
});

describe("Trust Engine — Seal", () => {
  it("sealDocument adds sign: and freeze: blocks", () => {
    const result = sealDocument(trackedDoc, {
      signer: "Ahmed Al-Rashid",
      role: "CEO",
    });
    expect(result.success).toBe(true);
    expect(result.source).toContain("sign: Ahmed Al-Rashid");
    expect(result.source).toContain("role: CEO");
    expect(result.source).toContain("freeze:");
    expect(result.source).toContain("status: locked");
    expect(result.hash).toMatch(/^sha256:/);
  });

  it("sealDocument with skipSign omits sign: block", () => {
    const result = sealDocument(trackedDoc, {
      signer: "",
      skipSign: true,
    });
    expect(result.source).not.toContain("sign:");
    expect(result.source).toContain("freeze:");
  });

  it("sealed document passes verify", () => {
    const sealed = sealDocument(trackedDoc, {
      signer: "Ahmed",
      role: "CEO",
    });
    const verifyResult = verifyDocument(sealed.source);
    expect(verifyResult.frozen).toBe(true);
    expect(verifyResult.intact).toBe(true);
    expect(verifyResult.signers).toHaveLength(1);
    expect(verifyResult.signers?.[0].valid).toBe(true);
  });
});

describe("Trust Engine — Verify", () => {
  it("returns not frozen for document without freeze:", () => {
    const result = verifyDocument(trackedDoc);
    expect(result.frozen).toBe(false);
    expect(result.intact).toBe(false);
    expect(result.warning).toContain("not sealed");
  });

  it("returns not intact for modified document", () => {
    const sealed = sealDocument(trackedDoc, {
      signer: "Ahmed",
      role: "CEO",
    });
    // Tamper with the document
    const tampered = sealed.source.replace("USD 24,000", "USD 50,000");
    const result = verifyDocument(tampered);
    expect(result.frozen).toBe(true);
    expect(result.intact).toBe(false);
    expect(result.error).toContain("modified");
  });

  it("returns intact for unmodified document", () => {
    const sealed = sealDocument(trackedDoc, {
      signer: "Test",
    });
    const result = verifyDocument(sealed.source);
    expect(result.intact).toBe(true);
  });
});

describe("Trust Engine — Utilities", () => {
  it("generateBlockId returns 5-char lowercase hex", () => {
    const id = generateBlockId();
    expect(id).toMatch(/^[a-f0-9]{5}$/);
  });

  it("blockFingerprint normalizes content", () => {
    expect(blockFingerprint("  Hello   World  ")).toBe("hello world");
    expect(blockFingerprint("TEST")).toBe("test");
  });

  it("incrementVersion bumps minor correctly", () => {
    expect(incrementVersion("1.0", "minor")).toBe("1.1");
    expect(incrementVersion("2.3", "minor")).toBe("2.4");
  });

  it("incrementVersion bumps major correctly", () => {
    expect(incrementVersion("1.3", "major")).toBe("2.0");
  });

  it("matchBlocksToRegistry matches exact fingerprints", () => {
    const blocks = [
      { type: "note", content: "Hello", section: "root" },
      { type: "note", content: "World", section: "root" },
    ];
    const registry = [
      { id: "a1b2c", blockType: "note", section: "root", fingerprint: "hello" },
      { id: "d3e4f", blockType: "note", section: "root", fingerprint: "world" },
    ];
    const map = matchBlocksToRegistry(blocks, registry);
    expect(map.get(0)).toBe("a1b2c");
    expect(map.get(1)).toBe("d3e4f");
  });

  it("computeTrustDiff detects added blocks", () => {
    const before = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "root",
        properties: {},
      },
    ];
    const after = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "root",
        properties: {},
      },
      {
        id: "b",
        type: "note",
        content: "World",
        section: "root",
        properties: {},
      },
    ];
    const diff = computeTrustDiff(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe("b");
  });

  it("computeTrustDiff detects removed blocks", () => {
    const before = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "root",
        properties: {},
      },
      {
        id: "b",
        type: "note",
        content: "World",
        section: "root",
        properties: {},
      },
    ];
    const after = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "root",
        properties: {},
      },
    ];
    const diff = computeTrustDiff(before, after);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe("b");
  });

  it("computeTrustDiff detects modified blocks", () => {
    const before = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "root",
        properties: {},
      },
    ];
    const after = [
      {
        id: "a",
        type: "note",
        content: "Hello World",
        section: "root",
        properties: {},
      },
    ];
    const diff = computeTrustDiff(before, after);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].was.content).toBe("Hello");
    expect(diff.modified[0].now.content).toBe("Hello World");
  });

  it("computeTrustDiff detects moved blocks", () => {
    const before = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "Scope",
        properties: {},
      },
    ];
    const after = [
      {
        id: "a",
        type: "note",
        content: "Hello",
        section: "Payment",
        properties: {},
      },
    ];
    const diff = computeTrustDiff(before, after);
    expect(diff.moved).toHaveLength(1);
    expect(diff.moved[0].wasSection).toBe("Scope");
    expect(diff.moved[0].nowSection).toBe("Payment");
  });
});

// ─── History Engine Tests ────────────────────────────────────────────────────

describe("History Engine", () => {
  it("parseHistorySection parses registry lines", () => {
    const raw = `---
// history

// registry
b7f3a | note | Scope | payment within 15 days.
c2e8d | note | Scope | value: usd 24,000 | dead

// revisions
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: added | id: b7f3a | block: note`;

    const result = parseHistorySection(raw);
    expect(result.registry).toHaveLength(2);
    expect(result.registry[0].id).toBe("b7f3a");
    expect(result.registry[0].fingerprint).toBe("payment within 15 days.");
    expect(result.registry[1].dead).toBe(true);
    expect(result.registryIntact).toBe(true);
  });

  it("parseHistorySection parses revision lines", () => {
    const raw = `---
// history

// revisions
revision: | version: 1.0 | at: 2026-03-01 | by: Ahmed | change: added | id: b7f3a | block: note | section: Scope | now: Hello
revision: | version: 1.1 | at: 2026-03-02 | by: Sarah | change: modified | id: b7f3a | block: note | section: Scope | was: Hello | now: World`;

    const result = parseHistorySection(raw);
    expect(result.revisions).toHaveLength(2);
    expect(result.revisions[0].by).toBe("Ahmed");
    expect(result.revisions[0].change).toBe("added");
    expect(result.revisions[1].change).toBe("modified");
    expect(result.revisions[1].was).toBe("Hello");
    expect(result.revisions[1].now).toBe("World");
  });

  it("updateHistory throws on frozen document", () => {
    const frozenSource = `title: Test\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked`;
    expect(() => {
      updateHistory(frozenSource, frozenSource, { by: "test" });
    }).toThrow(/sealed and frozen/);
  });

  it("updateHistory detects added blocks", () => {
    const prev = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nsection: Scope\nnote: Hello`;
    const curr = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nsection: Scope\nnote: Hello\nnote: World`;
    const result = updateHistory(prev, curr, { by: "Ahmed" });
    expect(result).toContain("history:");
    expect(result).toContain("// revisions");
    expect(result).toContain("change: added");
  });

  it("updateHistory writes revision lines on content change", () => {
    const prev = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nsection: Items\nnote: Hello`;
    const curr = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nsection: Items\nnote: Hello World`;
    const result = updateHistory(prev, curr, { by: "Ahmed" });
    expect(result).toContain("revision:");
  });

  it("updateHistory increments version correctly", () => {
    const prev = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nnote: Hello`;
    const curr = `title: Test\ntrack: | version: 1.0 | by: Ahmed\n\nnote: Hello World`;
    const result = updateHistory(prev, curr, { by: "Ahmed" });
    expect(result).toContain("version: 1.1");
  });
});

// ─── Validation Tests ────────────────────────────────────────────────────────

describe("Validation — Trust", () => {
  it("FREEZE_NOT_LAST error raised when freeze: is not last block", () => {
    const source = `title: Test\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked\nnote: Not allowed after freeze`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "FREEZE_NOT_LAST")).toBe(true);
  });

  it("MULTIPLE_FREEZE error raised with two freeze blocks", () => {
    const source = `title: Test\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked\nfreeze: | at: 2026-03-07 | hash: sha256:def | status: locked`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "MULTIPLE_FREEZE")).toBe(true);
  });

  it("SIGN_NO_HASH error raised", () => {
    const source = `title: Test\nsign: Ahmed | at: 2026-03-06`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "SIGN_NO_HASH")).toBe(true);
  });

  it("SIGN_NO_AT error raised", () => {
    const source = `title: Test\nsign: Ahmed | hash: sha256:abc`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "SIGN_NO_AT")).toBe(true);
  });

  it("APPROVE_NO_BY error raised", () => {
    const source = `title: Test\napprove: Reviewed docs | at: 2026-03-05`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "APPROVE_NO_BY")).toBe(true);
  });

  it("TRACK_WITHOUT_TITLE warning raised", () => {
    const source = `track: | version: 1.0 | by: Ahmed\nnote: Hello`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "TRACK_WITHOUT_TITLE")).toBe(
      true,
    );
  });

  it("FREEZE_UNSIGNED warning raised", () => {
    const source = `title: Test\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked`;
    const doc = parseIntentText(source);
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "FREEZE_UNSIGNED")).toBe(true);
  });

  it("no trust issues for clean tracked document", () => {
    const doc = parseIntentText(trackedDoc);
    const result = validateDocumentSemantic(doc);
    const trustIssues = result.issues.filter(
      (i) =>
        i.code.startsWith("FREEZE") ||
        i.code.startsWith("SIGN") ||
        i.code.startsWith("APPROVE") ||
        i.code.startsWith("TRACK"),
    );
    expect(trustIssues).toHaveLength(0);
  });
});

// ─── Round-trip Tests ────────────────────────────────────────────────────────

describe("Source Round-trip — Trust Blocks", () => {
  it("sign: block round-trips with properties in canonical order", () => {
    const source = `title: Test\nsign: Ahmed | role: CEO | at: 2026-03-06 | hash: sha256:abc`;
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("sign: Ahmed");
    expect(output).toContain("role: CEO");
    expect(output).toContain("at: 2026-03-06");
    expect(output).toContain("hash: sha256:abc");
  });

  it("approve: block round-trips correctly", () => {
    const source = `title: Test\napprove: Reviewed | by: Sarah | role: Legal | at: 2026-03-05`;
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("approve: Reviewed");
    expect(output).toContain("by: Sarah");
  });

  it("freeze: block round-trips correctly", () => {
    const source = `title: Test\nfreeze: | at: 2026-03-06 | hash: sha256:abc | status: locked`;
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("freeze:");
    expect(output).toContain("status: locked");
  });
});

// ─── Nested Section History Tests ────────────────────────────────────────────

describe("updateHistory — nested section content tracking", () => {
  it("records a change to a text block inside a section", () => {
    const base = `title: Doc\ntrack: | version: 1.0 | by: test\n\nsection: Alpha\ntext: original value`;
    // First call establishes registry
    const withHistory = updateHistory(base, base, { by: "test" });
    // Now modify the text inside the section
    const modified = withHistory.replace(
      "text: original value",
      "text: updated value",
    );
    const result = updateHistory(withHistory, modified, { by: "test" });
    const doc = parseIntentText(result, { includeHistorySection: true });
    const revisions = doc.history?.revisions ?? [];
    const modRevisions = revisions.filter(
      (r) => r.change === "modified" && r.block === "text",
    );
    expect(modRevisions.length).toBeGreaterThan(0);
    expect(modRevisions[0].section).toBe("Alpha");
  });

  it("does not emit a spurious removed event for unchanged nested content", () => {
    const base = `title: Doc\ntrack: | version: 1.0 | by: test\n\nsection: Beta\ntext: stable content`;
    // First call establishes registry
    const withHistory = updateHistory(base, base, { by: "test" });
    const firstDoc = parseIntentText(withHistory, {
      includeHistorySection: true,
    });
    const firstRevCount = firstDoc.history?.revisions?.length ?? 0;
    // Second call with identical content — should add no new revisions
    const result = updateHistory(withHistory, withHistory, { by: "test" });
    const doc = parseIntentText(result, { includeHistorySection: true });
    const revisions = doc.history?.revisions ?? [];
    const newRevisions = revisions.slice(firstRevCount);
    const removals = newRevisions.filter(
      (r) => r.change === "removed" && r.block === "text",
    );
    expect(removals.length).toBe(0);
  });
});

// ─── Amendment-Aware Verification Tests ──────────────────────────────────────

describe("verifyDocument — amendment-aware verification", () => {
  it("returns intact: true on a sealed document with an amendment: block", () => {
    const base = `title: Contract\ntext: Original clause\n`;
    const sealed = sealDocument(base, { signer: "Alice", role: "Legal" });
    // Add an amendment line between the content and freeze:
    const amended = sealed.source.replace(
      /^(freeze:)/m,
      "amendment: Clause updated per board resolution | by: Alice | at: 2026-03-08T10:00:00Z\n$1",
    );
    const result = verifyDocument(amended);
    expect(result.intact).toBe(true);
    expect(result.frozen).toBe(true);
  });

  it("returns intact: false when non-amendment content is modified after sealing", () => {
    const base = `title: Contract\ntext: Original clause\n`;
    const sealed = sealDocument(base, { signer: "Alice", role: "Legal" });
    const tampered = sealed.source.replace(
      "Original clause",
      "Replaced clause",
    );
    const result = verifyDocument(tampered);
    expect(result.intact).toBe(false);
  });
});

// ─── Multi-Signer Verification Tests ─────────────────────────────────────────

describe("verifyDocument — multi-signer semantics", () => {
  it("validates signers against freeze hash, not current hash", () => {
    const base = `title: Contract\ntext: Terms and conditions\n`;
    const sealed = sealDocument(base, { signer: "Alice", role: "CEO" });
    const result = verifyDocument(sealed.source);
    expect(result.intact).toBe(true);
    expect(result.signers?.[0].valid).toBe(true);
    expect(result.signers?.[0].signedCurrentVersion).toBe(true);
  });

  it("signer who signed same version as freeze is valid even after tampering", () => {
    const base = `title: Contract\ntext: Terms and conditions\n`;
    const sealed = sealDocument(base, { signer: "Alice", role: "CEO" });
    // Tamper with content — hash changes
    const tampered = sealed.source.replace(
      "Terms and conditions",
      "Altered terms",
    );
    const result = verifyDocument(tampered);
    expect(result.intact).toBe(false);
    // Signer approved the sealed version — valid against freeze hash
    expect(result.signers?.[0].valid).toBe(true);
    // But not valid against the current (tampered) document
    expect(result.signers?.[0].signedCurrentVersion).toBe(false);
  });

  it("multi-signer same version: both valid", () => {
    const base = `title: Contract\ntext: Terms\n`;
    const hash = computeDocumentHash(base);
    const multiSigned =
      base +
      `sign: Alice | role: CEO | at: 2026-03-08T10:00:00Z | hash: ${hash}\n` +
      `sign: Bob | role: CFO | at: 2026-03-08T11:00:00Z | hash: ${hash}\n` +
      `freeze: | at: 2026-03-08T12:00:00Z | hash: ${hash} | status: locked\n`;
    const result = verifyDocument(multiSigned);
    expect(result.intact).toBe(true);
    expect(result.signers).toHaveLength(2);
    expect(result.signers?.[0].valid).toBe(true);
    expect(result.signers?.[1].valid).toBe(true);
  });

  it("signer who signed earlier version shows valid: false", () => {
    // Alice signs body V1, body changes to V2, Bob signs V2, freeze with V2 hash
    const bodyV1 = `title: Contract\ntext: Original terms\n`;
    const hashV1 = computeDocumentHash(bodyV1);
    const bodyV2 = `title: Contract\ntext: Updated terms\n`;
    const hashV2 = computeDocumentHash(bodyV2);
    const doc =
      bodyV2 +
      `sign: Alice | role: CEO | at: 2026-03-08T10:00:00Z | hash: ${hashV1}\n` +
      `sign: Bob | role: CFO | at: 2026-03-08T11:00:00Z | hash: ${hashV2}\n` +
      `freeze: | at: 2026-03-08T12:00:00Z | hash: ${hashV2} | status: locked\n`;
    const result = verifyDocument(doc);
    expect(result.intact).toBe(true);
    // Alice signed V1, freeze is V2 — she didn't approve the sealed version
    expect(result.signers?.[0].signer).toBe("Alice");
    expect(result.signers?.[0].valid).toBe(false);
    // Bob signed V2, freeze is V2 — he approved the sealed version
    expect(result.signers?.[1].signer).toBe("Bob");
    expect(result.signers?.[1].valid).toBe(true);
  });
});
