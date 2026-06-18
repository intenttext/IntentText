// ribbon-formatting — every ribbon control must map to the correct .it property
// and round-trip. We can't click the ribbon headlessly, but the ribbon commands
// just set TipTap marks/attrs that the bridge serialises — so a source→doc→source
// round-trip of each formatting proves the mapping (bold→*, color→{color:}, align→
// align:, lists→ -/1., …). Semantic equality (diffDocuments) is the contract;
// minor cosmetic spacing is allowed.

import { describe, it, expect } from "vitest";
import { parseIntentText, diffDocuments } from "@dotit/core";
import { sourceToDoc, docToSource } from "../src/bridge";

const semanticDrift = (a: string, b: string) => {
  const d = diffDocuments(parseIntentText(a), parseIntentText(b));
  return d.added.length + d.removed.length + d.modified.length;
};
const roundtrip = (src: string) => docToSource(sourceToDoc(src)).trim();

const FORMATS: Record<string, string> = {
  "bold (*)": "text: This is *bold* text",
  "italic (_)": "text: This is _italic_ text",
  "strike (~)": "text: This is ~struck~ text",
  "inline code (`)": "text: Call `render()` now",
  "color span": "text: A [red word]{color: #dc2626} here",
  "highlight span": "text: A [marked]{bg: #fef08a} word",
  "font-size span": "text: A [big]{size: 20px} word",
  "align center": "text: Centered line | align: center",
  "align right": "text: Right aligned | align: right",
  "bullet list": "- first item\n- second item",
  "ordered list": "1. first\n1. second",
};

describe("ribbon formatting → correct .it property (semantic round-trip)", () => {
  for (const [name, src] of Object.entries(FORMATS)) {
    it(`${name} round-trips with no semantic change`, () => {
      const back = roundtrip(src);
      expect(
        semanticDrift(src, back),
        `\n--- src ---\n${src}\n--- roundtrip ---\n${back}\n`,
      ).toBe(0);
    });
  }

  it("a mix of marks in one line all survive", () => {
    const src =
      "text: *Bold* and _italic_ and ~strike~ and `code` and [tinted]{color: #0a7} together";
    expect(semanticDrift(src, roundtrip(src))).toBe(0);
  });
});
