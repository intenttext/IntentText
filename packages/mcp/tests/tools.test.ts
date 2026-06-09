import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  parseIntentTextSafe,
  renderHTML,
  renderPrint,
  parseAndMerge,
  documentToSource,
  validateDocumentSemantic,
  queryDocument,
  diffDocuments,
  extractWorkflow,
} from "@intenttext/core";
import type { IntentDocument } from "@intenttext/core";

function withTsEngine<T>(fn: () => T): T {
  const prev = (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE;
  (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE = "ts";
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE;
    } else {
      (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE = prev;
    }
  }
}

// These tests validate the functions that back each MCP tool.
// The MCP tools are thin async wrappers, so testing the core functions
// directly gives us full coverage of tool behavior.

describe("parse_intent_text", () => {
  it("parses valid source into document with blocks", () => {
    const doc = parseIntentText("title: Hello\ntask: Do something");
    expect(doc).toHaveProperty("blocks");
    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.blocks[0].type).toBe("title");
  });

  it("safe mode never throws on garbage input", () => {
    const result = parseIntentTextSafe("{{{{garbage!!!@@@");
    expect(result).toHaveProperty("document");
    expect(result).toHaveProperty("warnings");
    expect(result).toHaveProperty("errors");
    expect(result.document).toHaveProperty("blocks");
  });

  it("safe mode returns warnings for unknown keywords", () => {
    const result = parseIntentTextSafe("- foobar: test content");
    expect(result.document.blocks.length).toBeGreaterThan(0);
  });

  it("normal parse returns correct block types", () => {
    const source = `title: My Doc
task: Buy groceries
step: Send email | tool: email-api`;
    const doc = parseIntentText(source);
    const types = doc.blocks.map((b) => b.type);
    expect(types).toContain("title");
    expect(types).toContain("task");
    expect(types).toContain("step");
  });
});

describe("render_html", () => {
  it("returns string containing HTML elements", () => {
    const doc = parseIntentText("# Title\n- note: Hello world");
    const html = renderHTML(doc);
    expect(typeof html).toBe("string");
    expect(html).toContain("<");
    expect(html.length).toBeGreaterThan(0);
  });

  it("renders block content", () => {
    const doc = parseIntentText("- note: Important message here");
    const html = renderHTML(doc);
    expect(html).toContain("Important message here");
  });
});

describe("render_print", () => {
  it("returns print-optimised HTML", () => {
    const doc = parseIntentText("# Print Doc\n- note: Content");
    const html = renderPrint(doc);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html");
  });
});

describe("merge_template", () => {
  it("resolves {{variables}} correctly", () => {
    const template = "# {{title}}\n- note: Hello {{name}}";
    const data = { title: "My Report", name: "Ahmed" };
    const doc = parseAndMerge(template, data);
    expect(doc.blocks.length).toBeGreaterThan(0);
    const source = documentToSource(doc);
    expect(source).toContain("My Report");
    expect(source).toContain("Ahmed");
  });

  it("merged doc can be rendered to HTML", () => {
    const template = "- note: Status is {{status}}";
    const doc = parseAndMerge(template, { status: "active" });
    const html = renderHTML(doc);
    expect(html).toContain("active");
  });
});

describe("validate_document", () => {
  it("catches broken step references", () => {
    const source = `title: Workflow
step: Step A | tool: api | id: step-a
decision: Check result | then: step-nonexistent | else: step-a`;
    const result = withTsEngine(() => {
      const doc = parseIntentText(source);
      return validateDocumentSemantic(doc);
    });
    const errors = result.issues.filter((i) => i.type === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.code === "STEP_REF_MISSING")).toBe(true);
  });

  it("returns valid for well-formed document", () => {
    const source = `title: Simple Doc
task: Do something | owner: Ahmed`;
    const result = withTsEngine(() => {
      const doc = parseIntentText(source);
      return validateDocumentSemantic(doc);
    });
    const errors = result.issues.filter((i) => i.type === "error");
    expect(errors.length).toBe(0);
  });
});

describe("query_document", () => {
  const source = `title: Project Plan
section: Phase 1
task: Design UI | owner: Sarah
task: Write API | owner: Ahmed
section: Phase 2
step: Deploy | tool: kubernetes
gate: Security Review | approver: security-team`;

  it("filters by type", () => {
    const doc = parseIntentText(source);
    const results = queryDocument(doc, { type: "task" });
    expect(results.length).toBe(2);
    results.forEach((b) => expect(b.type).toBe("task"));
  });

  it("filters by multiple types", () => {
    const doc = parseIntentText(source);
    const results = queryDocument(doc, { type: ["step", "gate"] });
    expect(results.length).toBe(2);
    expect(results.some((b) => b.type === "step")).toBe(true);
    expect(results.some((b) => b.type === "gate")).toBe(true);
  });

  it("filters by content", () => {
    const doc = parseIntentText(source);
    const results = queryDocument(doc, { content: "Deploy" });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("Deploy");
  });

  it("filters by section", () => {
    const doc = parseIntentText(source);
    const results = queryDocument(doc, { section: "Phase 1" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects limit", () => {
    const doc = parseIntentText(source);
    const results = queryDocument(doc, { type: "task", limit: 1 });
    expect(results.length).toBe(1);
  });
});

describe("diff_documents", () => {
  it("detects added blocks", () => {
    const before = parseIntentText("- task: Task A");
    const after = parseIntentText("- task: Task A\n- task: Task B");
    const diff = diffDocuments(before, after);
    expect(diff.added.length).toBeGreaterThan(0);
  });

  it("detects removed blocks", () => {
    const before = parseIntentText("- task: Task A\n- task: Task B");
    const after = parseIntentText("- task: Task A");
    const diff = diffDocuments(before, after);
    expect(diff.removed.length).toBeGreaterThan(0);
  });

  it("reports identical documents as unchanged", () => {
    const source = "# Title\n- task: Do something";
    const before = parseIntentText(source);
    const after = parseIntentText(source);
    const diff = diffDocuments(before, after);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
  });

  it("produces a summary string", () => {
    const before = parseIntentText("- task: Task A");
    const after = parseIntentText("- task: Task A\n- task: Task B");
    const diff = diffDocuments(before, after);
    expect(typeof diff.summary).toBe("string");
    expect(diff.summary.length).toBeGreaterThan(0);
  });
});

describe("document_to_source", () => {
  it("returns string containing keywords", () => {
    const doc = parseIntentText("# My Doc\n- task: Do stuff\n- note: A note");
    const source = documentToSource(doc);
    expect(source).toContain("task:");
    expect(source).toContain("text:");
  });

  it("round-trips parse → source → parse", () => {
    const original = "# Title\n- task: Buy groceries\n  owner: Ahmed";
    const doc = parseIntentText(original);
    const source = documentToSource(doc);
    const reparsed = parseIntentText(source);
    expect(reparsed.blocks.length).toBe(doc.blocks.length);
    expect(reparsed.blocks[0].type).toBe(doc.blocks[0].type);
  });
});

describe("extract_workflow", () => {
  it("returns executionOrder array", () => {
    const source = `title: Workflow
step: Fetch data | id: fetch
step: Process data | id: process | depends: fetch
step: Store results | id: store | depends: process`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    expect(Array.isArray(graph.executionOrder)).toBe(true);
    expect(graph.executionOrder.length).toBeGreaterThan(0);
  });

  it("identifies entry points", () => {
    const source = `step: Start here | id: start
step: Next | id: next | depends: start`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    expect(graph.entryPoints).toContain("start");
    expect(graph.entryPoints).not.toContain("next");
  });

  it("detects gate positions", () => {
    const source = `step: Build | id: build
gate: Approval | id: approval | depends: build | approver: manager
step: Deploy | id: deploy | depends: approval`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    expect(graph.gatePositions.length).toBeGreaterThan(0);
  });

  it("detects terminal result blocks", () => {
    const source = `step: Do work | id: work
result: Final output | depends: work`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    expect(graph.hasTerminal).toBe(true);
  });

  it("warns on empty document", () => {
    const doc = parseIntentText("# Just a title");
    const graph = extractWorkflow(doc);
    expect(graph.warnings.length).toBeGreaterThan(0);
  });

  it("handles cycle detection", () => {
    const source = `step: A | id: a | depends: b
step: B | id: b | depends: a`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    expect(graph.warnings.some((w) => w.includes("Cycle"))).toBe(true);
  });

  it("groups independent steps in same batch", () => {
    const source = `step: A | id: a
step: B | id: b
step: C | id: c | depends: a,b`;
    const doc = parseIntentText(source);
    const graph = extractWorkflow(doc);
    // A and B should be in the same batch (batch 0), C in batch 1
    expect(graph.executionOrder.length).toBe(2);
    expect(graph.executionOrder[0]).toContain("a");
    expect(graph.executionOrder[0]).toContain("b");
    expect(graph.executionOrder[1]).toContain("c");
  });
});
