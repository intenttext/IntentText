import { describe, it, expect } from "vitest";
import { convertHtmlToIntentText } from "../src/index";

// #53: a nested <ul>/<ol> inside an <li> was flattened into the parent item's text
// ("Parent AChild A1Child A2"). Nested lists now emit as SEPARATE (indented) items.
describe("#53: nested HTML lists are separate items, not flattened", () => {
  it("keeps parent and nested children as distinct list lines", () => {
    const html =
      "<ul><li>Parent A<ul><li>Child A1</li><li>Child A2</li></ul></li><li>Parent B</li></ul>";
    const out = convertHtmlToIntentText(html);
    expect(out).toContain("- Parent A");
    expect(out).toContain("- Child A1");
    expect(out).toContain("- Child A2");
    expect(out).toContain("- Parent B");
    expect(out).not.toMatch(/Parent A\s*Child/); // not concatenated onto the parent
    // The children are indented one level under the parent.
    expect(out).toMatch(/^ {2}- Child A1$/m);
  });

  it("handles ordered nested inside unordered", () => {
    const out = convertHtmlToIntentText(
      "<ul><li>Steps<ol><li>First</li><li>Second</li></ol></li></ul>",
    );
    expect(out).toContain("- Steps");
    expect(out).toMatch(/^ {2}1\. First$/m);
    expect(out).toMatch(/^ {2}2\. Second$/m);
  });
});
