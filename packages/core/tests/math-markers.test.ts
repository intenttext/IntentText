import { describe, it, expect } from "vitest";
import { renderHTML, parseIntentText } from "../src/index";

const html = (s: string) => renderHTML(parseIntentText(s));

describe("core emits math placeholders (rendering is @dotit/math's job)", () => {
  it("a math: block becomes an it-math-block placeholder carrying the TeX", () => {
    const out = html("math: E = mc^2");
    expect(out).toContain('class="it-math-block" data-tex="E = mc^2"');
    // not rendered as an unknown block (the CSS rule .intent-unknown still exists)
    expect(out).not.toContain('class="intent-unknown"');
  });

  it("inline [tex]{math: …} becomes an it-math placeholder", () => {
    const out = html("text: mass-energy [E = mc^2]{math: tex} is famous.");
    expect(out).toContain('<span class="it-math" data-tex="E = mc^2">');
  });

  it("escapes TeX in the data-tex attribute", () => {
    const out = html("math: a < b");
    expect(out).toContain('data-tex="a &lt; b"');
  });
});
