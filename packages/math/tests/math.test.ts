import { describe, it, expect } from "vitest";
import { mathToMathML, renderMath, renderMathInHtml } from "../src/index.js";

describe("lite LaTeX → MathML", () => {
  it("wraps output in a <math> element", () => {
    const m = mathToMathML("x");
    expect(m).toContain('<math xmlns="http://www.w3.org/1998/Math/MathML"');
    expect(m).toContain("<mi>x</mi>");
  });

  it("renders powers and subscripts", () => {
    expect(mathToMathML("x^2")).toContain("<msup><mi>x</mi><mn>2</mn></msup>");
    expect(mathToMathML("a_i")).toContain("<msub><mi>a</mi><mi>i</mi></msub>");
    expect(mathToMathML("x_i^2")).toContain("<msubsup>");
  });

  it("renders fractions and roots", () => {
    expect(mathToMathML("\\frac{a}{b}")).toContain("<mfrac><mi>a</mi><mi>b</mi></mfrac>");
    expect(mathToMathML("\\sqrt{x}")).toContain("<msqrt><mi>x</mi></msqrt>");
  });

  it("maps Greek letters and operators to unicode", () => {
    expect(mathToMathML("\\pi")).toContain("π");
    expect(mathToMathML("a \\leq b")).toContain("≤");
    expect(mathToMathML("\\sum")).toContain("∑");
  });

  it("handles a real formula: E = mc^2", () => {
    const m = mathToMathML("E = mc^2");
    expect(m).toContain("<mi>E</mi>");
    expect(m).toContain("<mo>=</mo>");
    expect(m).toContain("<msup><mi>c</mi><mn>2</mn></msup>");
  });

  it("display mode sets display=block", () => {
    expect(mathToMathML("x", { display: true })).toContain('display="block"');
  });

  it("escapes XML-special operators safely", () => {
    expect(mathToMathML("a < b")).toContain("<mo>&lt;</mo>");
  });
});

describe("renderMath (falls back to lite when KaTeX absent)", () => {
  it("returns MathML for the lite engine", async () => {
    const out = await renderMath("\\frac{1}{2}", { engine: "lite" });
    expect(out).toContain("<mfrac>");
  });
  it("auto engine still resolves (lite fallback) when katex isn't installed", async () => {
    const out = await renderMath("x^2", { engine: "auto" });
    expect(out).toContain("msup");
  });
});

describe("renderMathInHtml — replaces core's placeholders", () => {
  it("renders inline + block math placeholders", async () => {
    const html =
      '<p>mass: <span class="it-math" data-tex="E = mc^2">E = mc^2</span></p>' +
      '<div class="it-math-block" data-tex="\\frac{a}{b}">\\frac{a}{b}</div>';
    const out = await renderMathInHtml(html, { engine: "lite" });
    expect(out).toContain("<math");
    expect(out).toContain("<mfrac>");
    expect(out).not.toContain('data-tex="E = mc^2"'); // placeholder replaced
  });
});
