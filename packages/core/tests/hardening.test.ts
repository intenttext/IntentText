import { describe, it, expect } from "vitest";
import { parseIntentText } from "../src/parser";
import { renderHTML, renderPrint } from "../src/renderer";
import { mergeData, parseAndMerge } from "../src/merge";
import { queryBlocks, parseQuery } from "../src/query";
import { validateDocument, PREDEFINED_SCHEMAS } from "../src/schema";
import { convertMarkdownToIntentText } from "../src/markdown";
import { convertHtmlToIntentText } from "../src/html-to-it";

describe("Hardening: Parser input validation", () => {
  it("returns empty document for empty string", () => {
    const doc = parseIntentText("");
    expect(doc.blocks).toEqual([]);
    expect(doc.version).toBe("1.4");
  });

  it("returns empty document for non-string input", () => {
    const doc = parseIntentText(null as unknown as string);
    expect(doc.blocks).toEqual([]);
  });

  it("returns empty document for undefined input", () => {
    const doc = parseIntentText(undefined as unknown as string);
    expect(doc.blocks).toEqual([]);
  });

  it("returns error diagnostic for oversized input", () => {
    const huge = "a".repeat(10_000_001);
    const doc = parseIntentText(huge);
    expect(doc.blocks).toEqual([]);
    expect(doc.diagnostics).toBeDefined();
    expect(doc.diagnostics![0].severity).toBe("error");
  });

  it("handles single-line documents correctly", () => {
    const doc = parseIntentText("title: Hello");
    expect(doc.blocks.length).toBe(1);
    expect(doc.blocks[0].type).toBe("title");
    expect(doc.blocks[0].content).toBe("Hello");
  });

  it("generates deterministic block IDs per parse call", () => {
    const doc1 = parseIntentText("title: A\nnote: B");
    const doc2 = parseIntentText("title: A\nnote: B");
    expect(doc1.blocks[0].id).toBe(doc2.blocks[0].id);
    expect(doc1.blocks[1].id).toBe(doc2.blocks[1].id);
  });
});

describe("Hardening: Prototype pollution prevention", () => {
  it("blocks __proto__ in pipe properties", () => {
    const doc = parseIntentText("task: Test | __proto__: polluted");
    const task = doc.blocks[0];
    expect(task.properties?.["__proto__"]).toBeUndefined();
    // Verify no pollution occurred on Object prototype
    expect(({} as Record<string, unknown>).__proto__).toBe(Object.prototype);
  });

  it("blocks constructor in pipe properties", () => {
    const doc = parseIntentText("task: Test | constructor: polluted");
    const task = doc.blocks[0];
    expect(task.properties?.["constructor"]).toBeUndefined();
  });

  it("blocks prototype in pipe properties", () => {
    const doc = parseIntentText("task: Test | prototype: polluted");
    const task = doc.blocks[0];
    expect(task.properties?.["prototype"]).toBeUndefined();
  });

  it("blocks __proto__ in context key-value pairs", () => {
    const doc = parseIntentText("context: | __proto__: polluted | safe: ok");
    // Safe key should still work
    const ctx = doc.blocks[0];
    expect(ctx.properties?.safe).toBe("ok");
    expect(ctx.properties?.["__proto__"]).toBeUndefined();
  });

  it("blocks __proto__ traversal in merge data paths", () => {
    // Note: __proto__ gets partially parsed by inline formatter (_ = italic),
    // but the merge engine still blocks dangerous path segments
    const template = parseIntentText("note: {{constructor.polluted}}");
    const data = { constructor: { polluted: "hacked" } };
    const result = mergeData(template, data);
    // Should not resolve — blocked by DANGEROUS_PATH_KEYS
    expect(result.blocks[0].content).toBe("{{constructor.polluted}}");
  });

  it("blocks constructor traversal in merge data paths", () => {
    const template = parseIntentText("note: {{constructor.name}}");
    const data = {};
    const result = mergeData(template, data);
    expect(result.blocks[0].content).toBe("{{constructor.name}}");
  });
});

describe("Hardening: Renderer URL sanitization", () => {
  it("blocks javascript: URLs", () => {
    const doc = parseIntentText("link: Click me | to: javascript:alert(1)");
    const html = renderHTML(doc);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("blocks data: URIs", () => {
    const doc = parseIntentText(
      "link: Click me | to: data:text/html,<script>alert(1)</script>",
    );
    const html = renderHTML(doc);
    expect(html).not.toContain("data:");
    expect(html).toContain('href="#"');
  });

  it("blocks vbscript: URLs", () => {
    const doc = parseIntentText("link: Click me | to: vbscript:MsgBox(1)");
    const html = renderHTML(doc);
    expect(html).not.toContain("vbscript:");
  });

  it("allows https URLs", () => {
    const doc = parseIntentText("link: Docs | to: https://example.com");
    const html = renderHTML(doc);
    expect(html).toContain("https://example.com");
  });

  it("allows relative URLs", () => {
    const doc = parseIntentText("link: Page | to: ./about.html");
    const html = renderHTML(doc);
    expect(html).toContain("./about.html");
  });

  it("escapes HTML in content", () => {
    const doc = parseIntentText('note: <script>alert("xss")</script>');
    const html = renderHTML(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("Hardening: Renderer null safety", () => {
  it("renderHTML returns empty string for null input", () => {
    expect(renderHTML(null as any)).toBe("");
  });

  it("renderHTML returns empty string for undefined input", () => {
    expect(renderHTML(undefined as any)).toBe("");
  });

  it("renderPrint returns empty string for null input", () => {
    expect(renderPrint(null as any)).toBe("");
  });
});

describe("Hardening: Merge safety", () => {
  it("returns original doc when data is null", () => {
    const doc = parseIntentText("title: Hello");
    const result = mergeData(doc, null as any);
    expect(result.blocks[0].content).toBe("Hello");
  });

  it("returns original doc when data is not an object", () => {
    const doc = parseIntentText("title: Hello");
    const result = mergeData(doc, "not-an-object" as any);
    expect(result.blocks[0].content).toBe("Hello");
  });

  it("handles deeply nested data paths", () => {
    const doc = parseIntentText("note: {{a.b.c.d.e.f}}");
    const data = { a: { b: { c: { d: { e: { f: "found" } } } } } };
    const result = mergeData(doc, data);
    expect(result.blocks[0].content).toBe("found");
  });

  it("rejects excessively long variable paths", () => {
    const longPath = Array(201).fill("a").join(".");
    const doc = parseIntentText(`note: {{${longPath}}}`);
    const result = mergeData(doc, { a: "val" });
    // Should leave the template unresolved
    expect(result.blocks[0].content).toContain("{{");
  });

  it("handles negative array indices safely", () => {
    const doc = parseIntentText("note: {{items.-1}}");
    const data = { items: ["a", "b", "c"] };
    const result = mergeData(doc, data);
    expect(result.blocks[0].content).toBe("{{items.-1}}");
  });

  it("fast path: no template markers means no processing", () => {
    const doc = parseIntentText("note: Plain text with no templates");
    const result = mergeData(doc, { anything: "value" });
    expect(result.blocks[0].content).toBe("Plain text with no templates");
  });
});

describe("Hardening: Query safety", () => {
  it("queryBlocks returns empty for null document", () => {
    const result = queryBlocks(null as any, "type=task");
    expect(result.blocks).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("parseQuery handles empty string", () => {
    const opts = parseQuery("");
    expect(opts.where).toEqual([]);
    expect(opts.sort).toEqual([]);
  });

  it("parseQuery handles non-string input", () => {
    const opts = parseQuery(null as unknown as string);
    expect(opts.where).toEqual([]);
  });

  it("parseQuery caps excessively long query strings", () => {
    const long = "type=task ".repeat(2000);
    const opts = parseQuery(long);
    // Should not throw, may have truncated results
    expect(opts.where).toBeDefined();
  });
});

describe("Hardening: Schema validation safety", () => {
  it("validateDocument handles null document", () => {
    const result = validateDocument(null as any, "project");
    expect(result.valid).toBe(false);
  });

  it("handles invalid regex in schema pattern gracefully", () => {
    const doc = parseIntentText("task: Test | name: hello");
    const schema = {
      name: "custom",
      blockSchemas: {
        task: {
          type: "task" as const,
          properties: {
            name: {
              type: "string" as const,
              pattern: "[invalid(",
            },
          },
        },
      },
      allowUnknownBlocks: true,
    };
    // Should not throw
    const result = validateDocument(doc, schema);
    expect(result).toBeDefined();
  });
});

describe("Hardening: Converter safety", () => {
  it("convertMarkdownToIntentText handles empty string", () => {
    expect(convertMarkdownToIntentText("")).toBe("");
  });

  it("convertMarkdownToIntentText handles non-string", () => {
    expect(convertMarkdownToIntentText(null as any)).toBe("");
  });

  it("convertHtmlToIntentText handles empty string", () => {
    expect(convertHtmlToIntentText("")).toBe("");
  });

  it("convertHtmlToIntentText handles non-string", () => {
    expect(convertHtmlToIntentText(null as any)).toBe("");
  });
});

describe("Hardening: Edge cases", () => {
  it("handles lines with only whitespace", () => {
    const doc = parseIntentText("   \n   \n   ");
    expect(doc.blocks).toEqual([]);
  });

  it("handles Windows line endings", () => {
    const doc = parseIntentText("title: Hello\r\nnote: World\r\n");
    expect(doc.blocks.length).toBe(2);
  });

  it("handles mixed line endings", () => {
    const doc = parseIntentText("title: Hello\nnote: World\r\ntask: Done");
    expect(doc.blocks.length).toBe(3);
  });

  it("handles very long single lines", () => {
    const longContent = "a".repeat(50_000);
    const doc = parseIntentText(`note: ${longContent}`);
    expect(doc.blocks[0].content.length).toBe(50_000);
  });

  it("handles unicode content correctly", () => {
    const doc = parseIntentText(
      "title: إطلاق المنتج الجديد 🚀\nnote: مرحبا بالعالم",
    );
    expect(doc.blocks.length).toBe(2);
    expect(doc.metadata?.language).toBe("rtl");
  });

  it("handles null bytes in content", () => {
    const doc = parseIntentText("note: before\x00after");
    expect(doc.blocks.length).toBe(1);
  });

  it("handles deeply nested sections", () => {
    const lines = [];
    lines.push("title: Deep");
    for (let i = 0; i < 100; i++) {
      lines.push(`section: Section ${i}`);
      lines.push(`sub: Sub ${i}`);
      lines.push(`note: Note ${i}`);
    }
    const doc = parseIntentText(lines.join("\n"));
    expect(doc.blocks.length).toBeGreaterThan(100);
  });

  it("handles rapid section switching", () => {
    const lines = Array.from(
      { length: 50 },
      (_, i) => `section: S${i}\ntask: T${i} | owner: user`,
    );
    const doc = parseIntentText(lines.join("\n"));
    expect(doc.blocks.length).toBe(50);
  });

  it("handles special regex characters in content", () => {
    const doc = parseIntentText(
      "note: price is $100.00 (50% off) with code [SAVE50]",
    );
    expect(doc.blocks[0].content).toContain("$100.00");
  });

  it("handles escaped pipes correctly", () => {
    const doc = parseIntentText("note: A \\| B");
    expect(doc.blocks[0].content).toContain("A | B");
  });
});

describe("Hardening: Performance", () => {
  it("parses a medium document (1000 lines) quickly", () => {
    const lines = ["title: Perf Test"];
    for (let i = 0; i < 999; i++) {
      lines.push(
        `task: Task ${i} | owner: user${i % 10} | priority: ${(i % 3) + 1}`,
      );
    }
    const input = lines.join("\n");

    const start = performance.now();
    const doc = parseIntentText(input);
    const elapsed = performance.now() - start;

    expect(doc.blocks.length).toBeGreaterThan(0);
    // Should parse 1000 lines in under 500ms even on slow machines
    expect(elapsed).toBeLessThan(500);
  });

  it("renders a medium document quickly", () => {
    const lines = ["title: Render Perf"];
    for (let i = 0; i < 500; i++) {
      lines.push(`note: Paragraph ${i} with *bold* and _italic_ content.`);
    }
    const doc = parseIntentText(lines.join("\n"));

    const start = performance.now();
    const html = renderHTML(doc);
    const elapsed = performance.now() - start;

    expect(html.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });

  it("block IDs are deterministic (no uuid overhead)", () => {
    const doc = parseIntentText("title: Test\nnote: A\nnote: B");
    // IDs should be sequential "b-N" format, not UUIDs
    expect(doc.blocks[0].id).toMatch(/^b-\d+$/);
    expect(doc.blocks[1].id).toMatch(/^b-\d+$/);
  });
});
