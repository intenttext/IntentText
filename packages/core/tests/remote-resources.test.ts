import { describe, it, expect } from "vitest";
import { renderHTML, parseIntentText } from "../src/index";

const render = (src: string, allowRemote = false) =>
  renderHTML(parseIntentText(src), { allowRemoteResources: allowRemote });

// #44: image:/figure:/embed: with a remote src auto-load on render — a sealed counterparty
// document could beacon "opened" to a remote host, and its appearance could depend on
// mutable remote bytes. Remote auto-loading resources are now dropped by default.
describe("#44: remote auto-loading resources are gated", () => {
  it("drops a remote image by default and shows a transparent placeholder", () => {
    const html = render("image: Logo | src: https://evil.example/opened.gif");
    expect(html).not.toContain("evil.example/opened.gif");
    expect(html).toContain("was blocked");
    expect(html).toMatch(/evil\.example/); // the host is disclosed in the placeholder
  });

  it("drops a remote iframe/video embed by default", () => {
    expect(
      render("embed: | type: iframe | src: https://evil.example/beacon"),
    ).not.toMatch(/<iframe[^>]+evil\.example/);
    expect(
      render("embed: | type: video | src: https://evil.example/v.mp4"),
    ).not.toMatch(/<video[^>]+evil\.example/);
  });

  it("allows remote resources when allowRemoteResources:true (own trusted content)", () => {
    const html = render("image: Logo | src: https://cdn.example/logo.png", true);
    expect(html).toContain("https://cdn.example/logo.png");
    expect(html).not.toContain("was blocked");
  });

  it("always allows relative / same-document images (not remote)", () => {
    const rel = render("image: Logo | src: ./assets/logo.png");
    expect(rel).toContain("./assets/logo.png");
    expect(rel).not.toContain("was blocked");
  });

  it("a remote figure image is blocked but the caption still renders", () => {
    const html = render("figure: Chart | src: https://evil.example/c.png | num: 1");
    expect(html).not.toContain("evil.example/c.png");
    expect(html).toContain("was blocked");
    expect(html).toContain("Figure 1:");
  });
});
