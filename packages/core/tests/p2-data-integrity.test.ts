import { describe, it, expect } from "vitest";
import { parseIntentText, documentToSource } from "../src/index";
import { escapeXml } from "../src/ooxml-util";

// #48: a segment whose key trims to empty (`| : value`) was stored as properties[""]
// and then silently dropped on round-trip — losing the value. It's now kept as literal
// text instead.
describe("#48: empty property key does not discard data", () => {
  it("keeps the value on round-trip (never stored under an empty key)", () => {
    const doc = parseIntentText("text: Balance | : 5,000,000 QAR");
    const block = doc.blocks.find((b) => (b.content ?? "").includes("Balance"));
    expect(block?.properties?.[""]).toBeUndefined();
    expect(documentToSource(doc)).toContain("5,000,000 QAR");
  });
});

// #54: escapeXml never stripped XML-1.0-forbidden control characters, so a control byte
// in a cell produced a DOCX/XLSX that isn't well-formed XML and won't open.
describe("#54: escapeXml emits well-formed XML (valid DOCX/XLSX)", () => {
  it("strips XML-1.0-forbidden control characters", () => {
    expect(escapeXml("cell\x00value\x1F")).toBe("cellvalue");
    expect(escapeXml("A\x0BB\x0CC")).toBe("ABC");
  });

  it("keeps tab / newline / CR and the five entity escapes", () => {
    expect(escapeXml("a\tb\nc\rd")).toBe("a\tb\nc\rd");
    expect(escapeXml("<x>&\"'")).toBe("&lt;x&gt;&amp;&quot;&apos;");
  });

  it("keeps valid surrogate pairs (emoji) but drops unpaired surrogates", () => {
    expect(escapeXml("ok😀")).toBe("ok😀");
    expect(escapeXml("bad\uD800end")).toBe("badend"); // lone high surrogate removed
    expect(escapeXml("bad\uDC00end")).toBe("badend"); // lone low surrogate removed
  });
});
