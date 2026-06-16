import { describe, it, expect } from "vitest";
import { documentToSource } from "../src/source";
import { parseIntentText } from "../src/parser";

describe("documentToSource — round-trip guarantee", () => {
  it("preserves break: properties", () => {
    const src = "break: | before: true";
    const doc = parseIntentText(src);
    const result = documentToSource(doc);
    expect(result).toBe(src);
  });

  it("preserves code block language", () => {
    const src = "```js\nconsole.log('hello');\n```";
    const doc = parseIntentText(src);
    const result = documentToSource(doc);
    expect(result).toBe(src);
  });

  it("round-trips unordered list items as `- ` bullets", () => {
    const src = "- Buy milk\n- Call dentist";
    const doc = parseIntentText(src);
    expect(doc.blocks.length).toBe(2);
    expect(doc.blocks[0].type).toBe("list-item");
    expect(doc.blocks[0].content).toBe("Buy milk");
    const result = documentToSource(doc);
    expect(result).toContain("- Buy milk");
    expect(result).toContain("- Call dentist");
    // Real round-trip: reparse yields the same block types.
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks.map((b) => b.type)).toEqual([
      "list-item",
      "list-item",
    ]);
  });

  it("round-trips ordered list items as `1.` bullets", () => {
    const src = "1. First step\n2. Second step";
    const doc = parseIntentText(src);
    expect(doc.blocks.length).toBe(2);
    expect(doc.blocks[0].type).toBe("step-item");
    expect(doc.blocks[0].content).toBe("First step");
    const result = documentToSource(doc);
    expect(result).toContain("1. First step");
    expect(result).toContain("Second step");
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks.map((b) => b.type)).toEqual([
      "step-item",
      "step-item",
    ]);
  });

  it("round-trips a list bullet that wraps a keyword (`- task:`)", () => {
    const src = "- task: Buy groceries";
    const doc = parseIntentText(src);
    const result = documentToSource(doc);
    expect(result).toContain("- task: Buy groceries");
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks.length).toBe(doc.blocks.length);
    expect(reparsed.blocks[0].type).toBe("list-item");
    expect(reparsed.blocks[0].children?.[0].type).toBe("task");
  });

  it("serializes empty-content blocks with props as `type: | props` (no double space)", () => {
    const src = "font: | family: Inter | size: 11pt";
    const doc = parseIntentText(src);
    const result = documentToSource(doc);
    expect(result).not.toContain("font:  |");
    expect(result).toContain("font: | ");
    // Round-trips.
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks[0].type).toBe("font");
    expect(reparsed.blocks[0].properties?.family).toBe("Inter");
  });

  it("round-trips a custom keyword block with its original keyword", () => {
    const src = "computer: MacBook | cpu: M3 | ram: 64GB";
    const doc = parseIntentText(src);
    expect(doc.blocks[0].type).toBe("custom");
    const result = documentToSource(doc);
    // Exact line — must NOT duplicate the keyword (regression: was using
    // originalContent, which already includes the `computer:` prefix).
    expect(result).toBe("computer: MacBook | cpu: M3 | ram: 64GB");
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks[0].type).toBe("custom");
    expect(reparsed.blocks[0].content).toBe("MacBook");
    expect(reparsed.blocks[0].properties?.keyword).toBe("computer");
  });

  it("round-trips a bullet that wraps a custom keyword without duplicating it", () => {
    const src = "- Ahmed: Index builder + Query optimizations";
    const doc = parseIntentText(src);
    const result = documentToSource(doc);
    // The bullet's child is a custom block; the line must not become
    // `- ahmed: Ahmed: …` (keyword duplicated).
    expect(result).not.toMatch(/Ahmed: Ahmed/i);
    const reparsed = parseIntentText(result);
    expect(reparsed.blocks[0].type).toBe("list-item");
    expect(reparsed.blocks[0].children?.[0].content).toBe(
      "Index builder + Query optimizations",
    );
  });

  it("round-trips bare prose without adding a text: prefix", () => {
    // Bare prose (a line with no keyword) is an implicit text block and must
    // re-emit bare — so a natural hand-written document round-trips byte-for-byte
    // and keeps its content hash (a re-save can't break a seal).
    const src = "Hello world";
    const doc = parseIntentText(src);
    expect(doc.blocks[0].type).toBe("text");
    expect(doc.blocks[0].content).toBe("Hello world");
    expect(documentToSource(doc)).toBe("Hello world");
  });

  it("preserves an explicit text: prefix when one was written", () => {
    const src = "text: Hello world";
    expect(documentToSource(parseIntentText(src))).toBe("text: Hello world");
  });

  it("keeps text: when bare content would be misread (e.g. starts like a keyword)", () => {
    const src = "text: note: this colon-prose must stay a paragraph";
    expect(documentToSource(parseIntentText(src))).toBe(src);
  });
});
