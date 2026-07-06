import { describe, it, expect } from "vitest";
import {
  sealDocument,
  verifyDocument,
  verifyTrust,
  renderHTML,
  renderTrustBand,
  parseIntentText,
  parseColor,
  colorAlpha,
  colorsMatch,
  sizeIsInvisible,
  styleHidesContent,
  findHiddenContent,
} from "../src/index";

// The content hash proves the TEXT is unchanged; it says nothing about whether that
// text is VISIBLE. Styling can hide a signed clause (color: transparent, white text
// on the white page, size: 0) so a reviewer sees a clean document, verify reports
// "intact", and a hidden waiver is still enforceable. These are the red-team cases
// for the invisibility defense — the promise "what you see is what was signed".

function seal(src: string): string {
  return sealDocument(src, { signer: "Nadia Rahman", role: "Compliance" }).source;
}

const clean = `title: Facility Agreement

The Bank agrees to provide a facility of 5,000,000 QAR.

The Borrower agrees to the standard covenants.`;

// A hidden waiver smuggled into an otherwise clean-looking contract. Standalone block
// (blank-line separated) so the per-clause styling is retained rather than merged away.
const hiddenWaiver = (style: string) => `title: Facility Agreement

The Bank agrees to provide a facility of 5,000,000 QAR.

text: Borrower irrevocably waives all claims and consents to offshore arbitration. | ${style}

The Borrower agrees to the standard covenants.`;

describe("color parsing helpers", () => {
  it("resolves alpha across formats", () => {
    expect(colorAlpha("transparent")).toBe(0);
    expect(colorAlpha("rgba(0,0,0,0)")).toBe(0);
    expect(colorAlpha("#ffffff00")).toBe(0);
    expect(colorAlpha("hsla(0,0%,0%,0)")).toBe(0);
    expect(colorAlpha("#000")).toBe(1);
    expect(colorAlpha("red")).toBe(1);
    expect(colorAlpha("nonsense")).toBe(1); // unknown → opaque, never a false hide
  });

  it("matches equivalent colors across formats", () => {
    expect(colorsMatch("white", "#ffffff")).toBe(true);
    expect(colorsMatch("white", "rgb(255,255,255)")).toBe(true);
    expect(colorsMatch("#fff", "#ffffff")).toBe(true);
    expect(colorsMatch("#000", "white")).toBe(false);
    expect(colorsMatch("transparent", "transparent")).toBe(false); // alpha handled apart
    expect(parseColor("rgb(255,255,255)")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it("flags near-zero font sizes only", () => {
    expect(sizeIsInvisible("0")).toBe(true);
    expect(sizeIsInvisible("0px")).toBe(true);
    expect(sizeIsInvisible("1px")).toBe(true);
    expect(sizeIsInvisible("0.1em")).toBe(true);
    expect(sizeIsInvisible("12px")).toBe(false);
    expect(sizeIsInvisible("1em")).toBe(false);
    expect(sizeIsInvisible("large")).toBe(false);
  });
});

describe("styleHidesContent — same-block + inherited background", () => {
  it("catches transparent / same-as-bg / near-zero size & opacity", () => {
    expect(styleHidesContent({ color: "transparent" }).hidden).toBe(true);
    expect(styleHidesContent({ color: "white" }).hidden).toBe(true); // default white page
    expect(styleHidesContent({ color: "#ffffff" }).hidden).toBe(true);
    expect(styleHidesContent({ color: "black", bg: "black" }).hidden).toBe(true);
    expect(styleHidesContent({ size: "0" }).hidden).toBe(true);
    expect(styleHidesContent({ opacity: "0.02" }).hidden).toBe(true);
  });

  it("does NOT flag readable styling (no false positives)", () => {
    expect(styleHidesContent({ color: "#888888" }).hidden).toBe(false); // grey on white
    expect(styleHidesContent({ color: "black" }).hidden).toBe(false);
    expect(styleHidesContent({ size: "14px" }).hidden).toBe(false);
    // white text on a genuinely dark background is fine — own bg overrides
    expect(styleHidesContent({ color: "white", bg: "#111111" }).hidden).toBe(false);
    // white text on an inherited dark section background is fine
    expect(styleHidesContent({ color: "white" }, "#111111").hidden).toBe(false);
  });
});

describe("verify surfaces hidden content (the seal is intact, the promise is not)", () => {
  for (const style of [
    "color: transparent",
    "color: white",
    "color: #ffffff",
    "color: rgb(255,255,255)",
    "size: 0",
    "size: 1px",
    "opacity: 0.03",
  ]) {
    it(`flags a clause hidden with "${style}"`, () => {
      const sealed = seal(hiddenWaiver(style));
      const v = verifyDocument(sealed);
      // The seal itself is INTACT — the bytes are unchanged...
      expect(v.intact).toBe(true);
      // ...but the invisibility audit catches the concealed clause...
      expect(v.hiddenContent).toBe(true);
      expect(v.hiddenContentItems?.[0].snippet).toContain("waives all claims");
      // ...and the single user-facing verdict goes RED.
      expect(verifyTrust(sealed).ok).toBe(false);
    });
  }

  it("warns at SEAL time too", () => {
    const res = sealDocument(hiddenWaiver("color: transparent"), {
      signer: "Nadia Rahman",
    });
    expect(res.hiddenContentWarning).toMatch(/hides 1 content block/i);
  });

  it("catches a hide smuggled via a style: directive AT SEAL TIME (the literal exploit)", () => {
    // `style: text | color: transparent` conceals every text block document-wide,
    // without touching any content line. This must be caught at seal/verify time —
    // appearanceChanged (a before/after comparison) never would.
    const src = `title: Facility Agreement

The Bank agrees to provide a facility of 5,000,000 QAR.

text: Borrower irrevocably waives all claims and consents to offshore arbitration.

style: text | color: transparent`;
    const sealed = seal(src);
    const v = verifyDocument(sealed);
    expect(v.hiddenContent).toBe(true);
    // The style: directive line itself is NOT reported as content (it renders nothing).
    expect(v.hiddenContentItems?.every((i) => i.type !== "style")).toBe(true);
    expect(verifyTrust(sealed).ok).toBe(false);
  });

  it("a clean document verifies green with no hidden-content flag", () => {
    const sealed = seal(clean);
    const v = verifyDocument(sealed);
    expect(v.intact).toBe(true);
    expect(v.hiddenContent).toBeUndefined();
    expect(verifyTrust(sealed).ok).toBe(true);
  });

  it("does NOT flag white-on-dark when the block sets its OWN dark bg (no false positive)", () => {
    // The legitimate way to get white-on-dark in this flat format: set bg AND color
    // on the same block. (A `section: | bg:` does NOT cascade to following sibling
    // blocks, so white text after a dark heading really IS invisible — correctly flagged.)
    const src = `title: Notice

text: This clause is white on its own dark background and is meant to be read. | bg: #0b0b0b | color: white`;
    const v = verifyDocument(seal(src));
    expect(v.hiddenContent).toBeUndefined();
    expect(verifyTrust(seal(src)).ok).toBe(true);
  });
});

describe("renderer reveals unambiguous same-block hides", () => {
  // Scope assertions to the clause's own <p> element so base-stylesheet declarations
  // (which legitimately contain e.g. font-size / #fff) never cause a false match.
  const clauseEl = (html: string) =>
    html.match(/<p\b[^>]*>[\s\S]*?waives all claims[\s\S]*?<\/p>/i)?.[0] ?? "";

  for (const style of ["color: transparent", "size: 0", "opacity: 0.03"]) {
    it(`drops "${style}" but keeps the text visible`, () => {
      const el = clauseEl(renderHTML(parseIntentText(hiddenWaiver(style))));
      expect(el).toContain("waives all claims");
      // The sole styling was the hide; the guard drops it, so no inline hide remains.
      expect(el).not.toMatch(/transparent|font-size|opacity/i);
    });
  }
});

describe("trust band shows the invisibility alert", () => {
  it("adds a loud caption line when a sealed doc hides content", () => {
    const band = renderTrustBand(seal(hiddenWaiver("color: transparent")));
    expect(band).toMatch(/it-trust-band__line--alert/);
    expect(band).toMatch(/Hidden text/i);
  });

  it("shows no alert for a clean sealed doc", () => {
    const band = renderTrustBand(seal(clean));
    expect(band).not.toMatch(/Hidden text/i);
  });
});
