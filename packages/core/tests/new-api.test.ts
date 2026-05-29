import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseIntentTextSafe,
  _resetIdCounter,
} from "../src/parser";
import { documentToSource } from "../src/source";
import { validateDocumentSemantic } from "../src/validate";
import { queryDocument } from "../src/query";
import { diffDocuments } from "../src/diff";

// ─── parseIntentTextSafe ────────────────────────────────────────────────────

describe("parseIntentTextSafe", () => {
  it("returns ParseResult with empty warnings on valid input", () => {
    const result = parseIntentTextSafe("title: Hello\nnote: World");
    expect(result.document.blocks.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("never throws on null input", () => {
    const result = parseIntentTextSafe(null as unknown as string);
    expect(result.document.blocks).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("never throws on undefined input", () => {
    const result = parseIntentTextSafe(undefined as unknown as string);
    expect(result.document.blocks).toEqual([]);
  });

  it("never throws on empty string", () => {
    const result = parseIntentTextSafe("");
    expect(result.document.blocks).toEqual([]);
  });

  it("never throws on random garbage", () => {
    const garbage = "!@#$%^&*(){}[]|\\<>\n\0\x01\x02";
    const result = parseIntentTextSafe(garbage);
    expect(result).toBeDefined();
    expect(result.errors).toEqual([]);
  });

  it("truncates lines over maxLineLength and adds LINE_TRUNCATED warning", () => {
    const longLine = "note: " + "x".repeat(200);
    const result = parseIntentTextSafe(longLine, { maxLineLength: 50 });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].code).toBe("LINE_TRUNCATED");
    expect(result.warnings[0].line).toBe(1);
  });

  it("unknown keyword with 'note' option: treated as note, warning added", () => {
    const result = parseIntentTextSafe("banana: Some text", {
      unknownKeyword: "note",
    });
    expect(result.warnings.some((w) => w.code === "UNKNOWN_KEYWORD")).toBe(
      true,
    );
    // The block should exist since it was rewritten as a note
    expect(result.document.blocks.length).toBeGreaterThan(0);
  });

  it("unknown keyword with 'skip' option: line skipped, warning added", () => {
    const result = parseIntentTextSafe(
      "title: Hello\nbanana: Skip me\nnote: Keep me",
      { unknownKeyword: "skip" },
    );
    expect(result.warnings.some((w) => w.code === "UNKNOWN_KEYWORD")).toBe(
      true,
    );
    // banana line should not appear as a block
    const types = result.document.blocks.map((b) => b.type);
    expect(types).not.toContain("banana");
  });

  it("unknown keyword with 'throw' option adds to errors array", () => {
    const result = parseIntentTextSafe("banana: Bad keyword", {
      unknownKeyword: "throw",
    });
    expect(result.errors.some((e) => e.code === "UNKNOWN_KEYWORD")).toBe(true);
  });

  it("strict mode adds unknown keywords to errors", () => {
    const result = parseIntentTextSafe("zebra: Strict check", {
      strict: true,
    });
    expect(result.errors.some((e) => e.code === "UNKNOWN_KEYWORD")).toBe(true);
  });

  it("respects maxBlocks limit, adds MAX_BLOCKS_REACHED warning", () => {
    const source = Array.from(
      { length: 20 },
      (_, i) => `note: Block ${i}`,
    ).join("\n");
    const result = parseIntentTextSafe(source, { maxBlocks: 5 });
    expect(result.document.blocks.length).toBeLessThanOrEqual(5);
    expect(result.warnings.some((w) => w.code === "MAX_BLOCKS_REACHED")).toBe(
      true,
    );
  });

  it("does not throw in strict mode — returns errors in array", () => {
    const result = parseIntentTextSafe("fakekw: test", {
      strict: true,
      unknownKeyword: "throw",
    });
    expect(result.errors.length).toBeGreaterThan(0);
    // Returned a result, did not throw
    expect(result.document).toBeDefined();
  });

  it("handles number input gracefully", () => {
    const result = parseIntentTextSafe(42 as unknown as string);
    expect(result.document.blocks).toEqual([]);
  });
});

// ─── documentToSource ───────────────────────────────────────────────────────

describe("documentToSource", () => {
  it("round-trips a simple document", () => {
    const source = "title: My Document\nnote: Hello world";
    const doc = parseIntentText(source);
    const roundTripped = parseIntentText(documentToSource(doc));
    expect(roundTripped.blocks.map((b) => b.type)).toEqual(
      doc.blocks.map((b) => b.type),
    );
    expect(roundTripped.blocks.map((b) => b.content)).toEqual(
      doc.blocks.map((b) => b.content),
    );
  });

  it("round-trips every basic block type", () => {
    const source = [
      "title: Title",
      "summary: Summary text",
      "section: Section One",
      "sub: Sub heading",
      "note: A note",
      "info: Info block",
      "warning: Be careful",
      "tip: A tip",
      "success: All good",
      "ask: A question?",
      "quote: Famous words | by: Author",
      "image: Alt text | at: /photo.jpg",
      "link: Click | to: https://example.com",
    ].join("\n");
    const doc = parseIntentText(source);
    const rt = parseIntentText(documentToSource(doc));
    expect(rt.blocks.map((b) => b.type)).toEqual(doc.blocks.map((b) => b.type));
  });

  it("round-trips agentic blocks with properties", () => {
    const source = [
      "title: Workflow",
      "step: Verify user | tool: auth | status: running",
      "decision: Check role | if: admin | then: show-admin | else: show-user",
      "gate: Deployment approval | approver: CTO",
    ].join("\n");
    const doc = parseIntentText(source);
    const rt = parseIntentText(documentToSource(doc));
    for (let i = 0; i < doc.blocks.length; i++) {
      // Flatten: blocks may be in children of sections
      expect(rt.blocks[i]?.type || "").toBe(doc.blocks[i]?.type || "");
    }
  });

  it("serialises properties in canonical order for step blocks", () => {
    const source = "step: Do thing | status: running | tool: api | input: data";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    const propPart = output
      .split(" | ")
      .slice(1)
      .map((p) => p.split(":")[0].trim());
    // tool should come before input, input before status
    const toolIdx = propPart.indexOf("tool");
    const inputIdx = propPart.indexOf("input");
    expect(toolIdx).toBeLessThan(inputIdx);
  });

  it("round-trips divider correctly", () => {
    const source = "title: Doc\n---\nnote: After divider";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("---");
    const rt = parseIntentText(output);
    expect(rt.blocks.some((b) => b.type === "divider")).toBe(true);
  });

  it("round-trips break correctly", () => {
    const source = "note: Before\nbreak:\nnote: After";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("break:");
  });

  it("preserves inline formatting via originalContent", () => {
    const source = "note: This is *bold* and _italic_";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("*bold*");
    expect(output).toContain("_italic_");
  });

  it("round-trips code blocks correctly", () => {
    const source = "```\nconsole.log('hello');\n```";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("```");
    expect(output).toContain("console.log('hello');");
  });

  it("round-trips pipe tables correctly", () => {
    const source = "headers: Name | Age\nrow: Alice | 30\nrow: Bob | 25";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("headers:");
    expect(output).toContain("row:");
    const rt = parseIntentText(output);
    const table = rt.blocks.find((b) => b.type === "table");
    expect(table?.table?.rows.length).toBe(2);
  });

  it("handles null/empty document gracefully", () => {
    expect(documentToSource(null as unknown as any)).toBe("");
    expect(documentToSource({ blocks: [] } as any)).toBe("");
  });

  it("round-trips task with properties", () => {
    const source = "task: Buy groceries | owner: Ahmed | due: 2026-03-15";
    const doc = parseIntentText(source);
    const rt = parseIntentText(documentToSource(doc));
    const task = rt.blocks[0];
    expect(task.type).toBe("task");
    expect(task.content).toContain("Buy groceries");
    expect(task.properties?.owner).toBe("Ahmed");
  });

  it("skips default-valued status property (pending)", () => {
    const source = "step: Check API | tool: http | status: pending";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).not.toContain("status: pending");
  });

  it("includes non-default status property", () => {
    const source = "step: Check API | tool: http | status: running";
    const doc = parseIntentText(source);
    const output = documentToSource(doc);
    expect(output).toContain("status: running");
  });
});

// ─── validateDocumentSemantic ───────────────────────────────────────────────

describe("validateDocumentSemantic", () => {
  it("valid document with no issues returns valid: true, empty issues", () => {
    const doc = parseIntentText(
      "title: Valid Doc\nsection: Intro\nnote: Content here",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.type === "error")).toHaveLength(0);
  });

  it("decision with missing then step ID returns STEP_REF_MISSING", () => {
    const doc = parseIntentText(
      "title: Test\ndecision: Check role | if: admin | then: nonexistent | else: show-user",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "STEP_REF_MISSING")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("step with missing depends target returns DEPENDS_REF_MISSING", () => {
    const doc = parseIntentText(
      "title: Test\nstep: Do thing | tool: api | depends: missing-step",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "DEPENDS_REF_MISSING")).toBe(
      true,
    );
    expect(result.valid).toBe(false);
  });

  it("duplicate id properties returns DUPLICATE_STEP_ID", () => {
    const doc = parseIntentText(
      "step: First | tool: a | id: step-1\nstep: Second | tool: b | id: step-1",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "DUPLICATE_STEP_ID")).toBe(
      true,
    );
    expect(result.valid).toBe(false);
  });

  it("gate without approver returns GATE_NO_APPROVER warning", () => {
    const doc = parseIntentText("title: Test\ngate: Deployment approval");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "GATE_NO_APPROVER")).toBe(true);
    expect(result.valid).toBe(true); // warnings don't make it invalid
  });

  it("step without tool returns STEP_NO_TOOL warning", () => {
    const doc = parseIntentText("title: Test\nstep: Do something");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "STEP_NO_TOOL")).toBe(true);
    expect(result.valid).toBe(true);
  });

  it("{{unresolved}} variable returns UNRESOLVED_VARIABLE warning", () => {
    const doc = parseIntentText("title: Test\nnote: Hello {{name}}");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "UNRESOLVED_VARIABLE")).toBe(
      true,
    );
  });

  it("document with only warnings is still valid: true", () => {
    const doc = parseIntentText("title: Test\nstep: Something\ngate: Approval");
    const result = validateDocumentSemantic(doc);
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.type === "warning")).toBe(true);
  });

  it("empty section returns EMPTY_SECTION warning", () => {
    const doc = parseIntentText(
      "title: Test\nsection: Empty One\nsection: Another",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "EMPTY_SECTION")).toBe(true);
  });

  it("handoff without to returns HANDOFF_NO_TO warning", () => {
    const doc = parseIntentText("title: Test\nhandoff: Done with this");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "HANDOFF_NO_TO")).toBe(true);
  });

  it("retry without max returns RETRY_NO_MAX warning", () => {
    const doc = parseIntentText("title: Test\nretry: Call the API");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "RETRY_NO_MAX")).toBe(true);
  });

  it("document with no title returns DOCUMENT_NO_TITLE info", () => {
    const doc = parseIntentText("note: Just a note");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "DOCUMENT_NO_TITLE")).toBe(
      true,
    );
  });

  it("template with {{variables}} returns TEMPLATE_HAS_UNRESOLVED info", () => {
    const doc = parseIntentText("title: {{docTitle}}\nnote: Hello {{name}}");
    const result = validateDocumentSemantic(doc);
    expect(
      result.issues.some((i) => i.code === "TEMPLATE_HAS_UNRESOLVED"),
    ).toBe(true);
  });

  it("parallel with missing step references returns PARALLEL_REF_MISSING", () => {
    const doc = parseIntentText(
      "title: Test\nparallel: Run tasks | steps: missing-a,missing-b",
    );
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "PARALLEL_REF_MISSING")).toBe(
      true,
    );
    expect(result.valid).toBe(false);
  });

  it("call referencing own title returns CALL_LOOP", () => {
    const doc = parseIntentText("title: My Workflow\ncall: My Workflow");
    const result = validateDocumentSemantic(doc);
    expect(result.issues.some((i) => i.code === "CALL_LOOP")).toBe(true);
    expect(result.valid).toBe(false);
  });

  it("handles null document gracefully", () => {
    const result = validateDocumentSemantic(null as unknown as any);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("context variables are not flagged as unresolved", () => {
    const doc = parseIntentText("context: name=World\nnote: Hello {{name}}");
    const result = validateDocumentSemantic(doc);
    const unresolvedName = result.issues.filter(
      (i) => i.code === "UNRESOLVED_VARIABLE" && i.message.includes("name"),
    );
    expect(unresolvedName).toHaveLength(0);
  });
});

// ─── queryDocument ──────────────────────────────────────────────────────────

describe("queryDocument", () => {
  const source = [
    "title: Project Plan",
    "section: Planning",
    "task: Design API | owner: Ahmed | priority: 1",
    "task: Build database | owner: Sara | priority: 2",
    "section: Deployment",
    "step: Deploy to staging | tool: docker",
    "gate: Production approval | approver: CTO",
    "step: Deploy to prod | tool: kubernetes",
    "section: Action Items",
    "task: Write tests | owner: Ahmed | priority: 1",
    "note: Remember to update docs",
  ].join("\n");

  const doc = parseIntentText(source);

  it("returns all blocks when no options specified", () => {
    const results = queryDocument(doc);
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns all blocks with empty options object", () => {
    const results = queryDocument(doc, {});
    expect(results.length).toBeGreaterThan(0);
  });

  it("filters by single type correctly", () => {
    const results = queryDocument(doc, { type: "task" });
    expect(results.every((b) => b.type === "task")).toBe(true);
    expect(results.length).toBe(3);
  });

  it("filters by type array (OR logic)", () => {
    const results = queryDocument(doc, { type: ["step", "gate"] });
    expect(results.every((b) => ["step", "gate"].includes(b.type))).toBe(true);
  });

  it("filters by content substring (case-insensitive)", () => {
    const results = queryDocument(doc, { content: "database" });
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("database");
  });

  it("filters by content RegExp", () => {
    const results = queryDocument(doc, { content: /deploy/i });
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by properties exact match", () => {
    const results = queryDocument(doc, {
      type: "task",
      properties: { owner: "Ahmed" },
    });
    expect(results.length).toBe(2);
    expect(results.every((b) => b.properties?.owner === "Ahmed")).toBe(true);
  });

  it("filters by properties RegExp", () => {
    const results = queryDocument(doc, {
      type: "step",
      properties: { tool: /docker|kubernetes/ },
    });
    expect(results.length).toBe(2);
  });

  it("filters by section", () => {
    const results = queryDocument(doc, { section: "Deployment" });
    expect(results.length).toBeGreaterThan(0);
    // Should contain step and gate blocks from Deployment section
    expect(results.some((b) => b.type === "step")).toBe(true);
    expect(results.some((b) => b.type === "gate")).toBe(true);
  });

  it("combined filter: type + section + properties", () => {
    const results = queryDocument(doc, {
      type: "task",
      section: "Action Items",
      properties: { priority: "1" },
    });
    expect(results.length).toBe(1);
    expect(results[0].content).toContain("Write tests");
  });

  it("respects limit option", () => {
    const results = queryDocument(doc, { type: "task", limit: 1 });
    expect(results.length).toBe(1);
  });

  it("returns empty array when no match", () => {
    const results = queryDocument(doc, { type: "emit" });
    expect(results).toEqual([]);
  });

  it("handles null document gracefully", () => {
    const results = queryDocument(null as unknown as any, { type: "task" });
    expect(results).toEqual([]);
  });

  it("multiple types query", () => {
    const results = queryDocument(doc, {
      type: ["step", "gate", "decision"],
    });
    expect(
      results.every((b) => ["step", "gate", "decision"].includes(b.type)),
    ).toBe(true);
  });

  it("section filter with RegExp", () => {
    const results = queryDocument(doc, { section: /deploy/i });
    expect(results.length).toBeGreaterThan(0);
  });
});

// ─── diffDocuments ──────────────────────────────────────────────────────────

describe("diffDocuments", () => {
  it("identical documents: all unchanged", () => {
    const doc = parseIntentText("title: Same\nnote: Unchanged");
    const diff = diffDocuments(doc, doc);
    expect(diff.unchanged.length).toBe(2);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.modified).toEqual([]);
    expect(diff.summary).toContain("unchanged");
  });

  it("one block added", () => {
    const before = parseIntentText("title: Doc");
    const after = parseIntentText("title: Doc\nnote: New block");
    const diff = diffDocuments(before, after);
    expect(diff.added.length).toBe(1);
    expect(diff.added[0].type).toBe("text");
  });

  it("one block removed", () => {
    const before = parseIntentText("title: Doc\nnote: Will be removed");
    const after = parseIntentText("title: Doc");
    const diff = diffDocuments(before, after);
    expect(diff.removed.length).toBe(1);
    expect(diff.removed[0].type).toBe("text");
  });

  it("content change: appears in modified with contentChanged: true", () => {
    const before = parseIntentText(
      "note: The original text content here in this block",
    );
    const after = parseIntentText(
      "note: The original text content here in that block",
    );
    const diff = diffDocuments(before, after);
    expect(diff.modified.length).toBe(1);
    expect(diff.modified[0].contentChanged).toBe(true);
  });

  it("property change: appears in modified with correct propertiesChanged", () => {
    const before = parseIntentText(
      "task: Do thing | owner: Ahmed | priority: 1",
    );
    const after = parseIntentText(
      "task: Do thing | owner: Ahmed | priority: 2",
    );
    const diff = diffDocuments(before, after);
    expect(diff.modified.length).toBe(1);
    expect(diff.modified[0].propertiesChanged).toContain("priority");
    expect(diff.modified[0].contentChanged).toBe(false);
  });

  it("summary string is correctly formatted", () => {
    const before = parseIntentText("title: Doc\nnote: Old");
    const after = parseIntentText("title: Doc\nnote: New");
    const diff = diffDocuments(before, after);
    expect(diff.summary).toMatch(/\d+ (added|removed|modified|unchanged)/);
  });

  it("handles empty documents", () => {
    const empty = parseIntentText("");
    const diff = diffDocuments(empty, empty);
    expect(diff.summary).toBe("no changes");
  });

  it("handles null documents gracefully", () => {
    const doc = parseIntentText("title: Test");
    const diff = diffDocuments(null as unknown as any, doc);
    expect(diff.added.length).toBeGreaterThan(0);
    expect(diff.removed).toEqual([]);
  });

  it("type change detected as modified with typeChanged: true", () => {
    const before = parseIntentText("note: Convert this to info");
    const after = parseIntentText("info: Convert this to info");
    const diff = diffDocuments(before, after);
    // Same content, different type — should be modified
    expect(diff.modified.length).toBe(1);
    expect(diff.modified[0].typeChanged).toBe(true);
  });

  it("multiple changes tracked correctly", () => {
    const before = parseIntentText(
      "title: Doc\nnote: Keep\nwarning: Remove me\ntask: Change | owner: A",
    );
    const after = parseIntentText(
      "title: Doc\nnote: Keep\ninfo: Added\ntask: Change | owner: B",
    );
    const diff = diffDocuments(before, after);
    expect(diff.added.length).toBeGreaterThanOrEqual(1);
    expect(diff.removed.length).toBeGreaterThanOrEqual(1);
    expect(diff.modified.length).toBeGreaterThanOrEqual(1);
  });
});
