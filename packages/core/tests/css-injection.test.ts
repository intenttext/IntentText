import { describe, it, expect } from "vitest";
import { renderHTML, parseIntentText } from "../src/index";

const render = (src: string) => renderHTML(parseIntentText(src));

// #13: the figure width/align and signline width landed inside a style="…" attribute
// via escapeHtml, which does NOT strip `;` — so an authored/merged value could inject
// extra CSS declarations (pin an overlay, hide the signature line, beacon to a remote
// URL on open). Width is now length-validated and align is whitelisted.

const EVIL =
  "100%;position:fixed;top:0;left:0;width:100vw;height:100vh;opacity:0.01;background:url(https://evil.example/opened.gif)";

describe("#13: CSS-declaration injection via figure/signline is neutralized", () => {
  it("figure width: an injected declaration is dropped, not emitted", () => {
    const html = render(`figure: Logo | src: ./logo.png | width: ${EVIL}`);
    expect(html).not.toMatch(/position:\s*fixed/i);
    expect(html).not.toMatch(/evil\.example/i);
  });

  it("figure align: only a whitelisted keyword is emitted", () => {
    const html = render(
      `figure: Logo | src: ./logo.png | align: center;position:fixed;top:0`,
    );
    expect(html).not.toMatch(/position:\s*fixed/i);
    expect(html).toMatch(/text-align:\s*center/i); // invalid align → safe fallback
  });

  it("signline width: an injected declaration cannot hide the signature line", () => {
    const html = render(`signline: Authorized Officer | width: ${EVIL}`);
    expect(html).not.toMatch(/position:\s*fixed/i);
    expect(html).not.toMatch(/evil\.example/i);
    expect(html).toMatch(/it-signline/); // the line still renders (with the fallback width)
  });

  it("a VALID width is still applied (no false neutralization)", () => {
    expect(render(`figure: Chart | src: ./c.png | width: 50%`)).toMatch(
      /width:\s*50%/,
    );
    expect(render(`signline: Officer | width: 40%`)).toMatch(/width:\s*40%/);
  });
});
