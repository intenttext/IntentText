import { describe, it, expect } from "vitest";
import {
  hasTrackedChanges,
  extractChanges,
  acceptChanges,
  rejectChanges,
  extractComments,
  commentAnchors,
  isTemplate,
  assertNotTemplate,
  parseIntentText,
  renderHTML,
} from "../src/index";

const doc = `text: The price is [1,200]{track: del; by: Sarah; id: c1} [1,500]{track: ins; by: Sarah; id: c2} per unit.
text: Delivery in [30]{track: ins; by: Lina; id: c3} days.
`;

describe("tracked changes", () => {
  it("detects + extracts changes", () => {
    expect(hasTrackedChanges(doc)).toBe(true);
    const changes = extractChanges(doc);
    expect(changes.map((c) => `${c.type}:${c.text}`)).toEqual([
      "del:1,200",
      "ins:1,500",
      "ins:30",
    ]);
    expect(changes[0].by).toBe("Sarah");
    expect(changes[0].id).toBe("c1");
  });

  it("accept = keep insertions, drop deletions", () => {
    const out = acceptChanges(doc);
    expect(out).toContain("The price is  1,500 per unit."); // del gone, ins kept
    expect(out).toContain("Delivery in 30 days.");
    expect(hasTrackedChanges(out)).toBe(false);
  });

  it("reject = drop insertions, restore deletions", () => {
    const out = rejectChanges(doc);
    expect(out).toContain("The price is 1,200  per unit."); // del restored, ins gone
    expect(out).toContain("Delivery in  days.");
    expect(hasTrackedChanges(out)).toBe(false);
  });

  it("accept/reject specific changes by id", () => {
    // accept only c2 (the insertion); the deletion c1 stays pending
    const out = acceptChanges(doc, ["c2"]);
    expect(out).toContain("1,500"); // c2 accepted → plain
    expect(out).toContain("track: del; by: Sarah; id: c1"); // c1 still pending
    expect(extractChanges(out).map((c) => c.id)).toEqual(["c1", "c3"]);
  });

  it("leaves non-tracked bracket spans alone", () => {
    const styled = "text: [bold]{weight: bold} and a [link](http://x).";
    expect(hasTrackedChanges(styled)).toBe(false);
    expect(acceptChanges(styled)).toBe(styled);
  });

  it("trust gate: pending changes make a doc a template (not sealable)", () => {
    expect(isTemplate(doc)).toBe(true);
    expect(() => assertNotTemplate(doc, "sealed")).toThrow();
    // Once resolved, the clean document is trustable again.
    const clean = acceptChanges(doc);
    expect(isTemplate(clean)).toBe(false);
    expect(() => assertNotTemplate(clean, "sealed")).not.toThrow();
  });
});

describe("rendering", () => {
  it("renders insertions as <ins>, deletions as <del>, anchors highlighted", () => {
    const src =
      "text: Price [1,200]{track: del; by: Sarah; id: c1} [1,500]{track: ins; by: Sarah; id: c2}, clause [3.2]{comment: k1}.";
    const html = renderHTML(parseIntentText(src));
    expect(html).toContain(
      '<del class="it-track it-track-del" data-change="c1" data-by="Sarah"',
    );
    expect(html).toContain("1,200</del>");
    expect(html).toContain(
      '<ins class="it-track it-track-ins" data-change="c2" data-by="Sarah"',
    );
    expect(html).toContain("1,500</ins>");
    expect(html).toContain('<span class="it-comment-anchor" data-comment="k1">3.2</span>');
  });
});

describe("comments", () => {
  const src = `text: Clause [3.2]{comment: k1} needs review.
comment: Is this enforceable? | id: k1 | by: Lina | at: 2026-06-16
comment: Agreed, revise. | id: k2 | by: Sarah | resolved: yes
`;
  it("extracts comment threads + anchors", () => {
    const comments = extractComments(src);
    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({ id: "k1", by: "Lina", resolved: false });
    expect(comments[0].body).toBe("Is this enforceable?");
    expect(comments[1].resolved).toBe(true);
    expect(commentAnchors(src)).toEqual(["k1"]);
  });
});
