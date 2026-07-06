import { describe, it, expect } from "vitest";
import { parseIntentText, renderPrint, printFontFaceCSS } from "../src/index";

/**
 * #27/#28 — PDF/A font embedding. PDF/A forbids referencing a font that isn't
 * embedded. Our PDFs are rendered by Chrome from renderPrint's HTML, whose default
 * body stack is system serif (Georgia/Times) — not present on a headless Linux box,
 * so Chrome substitutes and may NOT embed. `embedFonts` serves open Noto subsets as
 * @font-face data URIs and forces every surface onto them.
 *
 * These are the CI-safe (no-Chrome) proofs: the print HTML carries the embedded
 * faces and the no-fallback overrides, and only when asked. The real embedding
 * (Chrome → PDF → every font embedded) is proven in @dotit/pdf's render test.
 */
const DOC = parseIntentText(
  `title: Agreement — اتفاقية
section: Terms
text: The parties agree for €1,250.
text: تلتزم الأطراف بالشروط.
task: Countersign
code: const x = 1;`,
);

describe("renderPrint embedFonts (#27/#28)", () => {
  it("RED-TEAM: default print has NO embedded fonts (opt-in, no bloat)", () => {
    const html = renderPrint(DOC, { theme: "corporate" });
    expect(html).not.toContain("@font-face");
    expect(html).not.toContain("data:font/woff2");
  });

  it("embedFonts injects all six Noto faces as woff2 data URIs", () => {
    const html = renderPrint(DOC, { theme: "corporate", embedFonts: true });
    const faces = html.match(/@font-face\{/g) ?? [];
    expect(faces.length).toBe(6);
    // Each face is a self-contained woff2 data URI (no external host — CSP/offline safe).
    expect(html).toContain("src:url(data:font/woff2;base64,");
    expect(html).not.toMatch(/@font-face[^}]*src:url\(https?:/);
  });

  it("forces every surface onto an embedded face (no system-font fallback)", () => {
    const css = printFontFaceCSS();
    // Body/headings → embedded serif+arabic+symbols, with !important so a theme's
    // own heading font can't leave a non-embedded glyph.
    expect(css).toContain("'IT Serif'");
    expect(css).toContain("'IT Naskh'");
    expect(css).toMatch(/\*:not\(code\)[^{]*\{font-family:'IT Serif'[^}]*!important/);
    // Code keeps an embedded monospace; SVG seal text is remapped to embedded serif.
    expect(css).toMatch(/code[^{]*\{font-family:'IT Mono'[^}]*!important/);
    expect(css).toMatch(/svg text\{font-family:'IT Serif'[^}]*!important/);
  });

  it("bare (as-signed) mode suppresses embedded fonts — styling is stripped there", () => {
    const html = renderPrint(DOC, { embedFonts: true, bare: true });
    expect(html).not.toContain("@font-face");
  });

  it("each embedded face decodes to a valid woff2 (wOF2 signature)", () => {
    const css = printFontFaceCSS();
    const b64s = [...css.matchAll(/data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g)].map(
      (m) => m[1],
    );
    expect(b64s.length).toBe(6);
    for (const b64 of b64s) {
      const head = Buffer.from(b64.slice(0, 8), "base64");
      // woff2 magic number is 'wOF2' (0x774F4632).
      expect(head.subarray(0, 4).toString("latin1")).toBe("wOF2");
    }
  });
});
