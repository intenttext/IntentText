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

  it("serializes unordered list items as list-item: keyword form", () => {
    const src = "- Buy milk\n- Call dentist";
    const doc = parseIntentText(src);
    expect(doc.blocks.length).toBe(2);
    expect(doc.blocks[0].type).toBe("list-item");
    expect(doc.blocks[0].content).toBe("Buy milk");
    const result = documentToSource(doc);
    expect(result).toContain("list-item: Buy milk");
    expect(result).toContain("list-item: Call dentist");
  });

  it("serializes ordered list items as step-item: keyword form", () => {
    const src = "1. First step\n2. Second step";
    const doc = parseIntentText(src);
    expect(doc.blocks.length).toBe(2);
    expect(doc.blocks[0].type).toBe("step-item");
    expect(doc.blocks[0].content).toBe("First step");
    const result = documentToSource(doc);
    expect(result).toContain("step-item: First step");
    expect(result).toContain("step-item: Second step");
  });

  it("serializes body-text blocks with body-text: prefix", () => {
    const src = "Hello world";
    const doc = parseIntentText(src);
    expect(doc.blocks[0].type).toBe("body-text");
    expect(doc.blocks[0].content).toBe("Hello world");
    const result = documentToSource(doc);
    expect(result).toBe("body-text: Hello world");
  });
});
