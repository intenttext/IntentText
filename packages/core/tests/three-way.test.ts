import { describe, it, expect } from "vitest";
import { mergeThreeWay, acceptChanges, extractChanges } from "../src/index";

const base = `text: line a
text: line b
text: line c`;

describe("mergeThreeWay — async co-authoring", () => {
  it("merges non-overlapping edits cleanly (no conflict)", () => {
    const mine = `text: line A
text: line b
text: line c`; // changed a
    const theirs = `text: line a
text: line b
text: line C`; // changed c
    const { source, conflicts } = mergeThreeWay(base, mine, theirs, { mineLabel: "Sara", theirsLabel: "Omar" });
    expect(conflicts).toBe(0);
    // accepting all tracked changes yields BOTH edits applied
    expect(acceptChanges(source)).toBe(`text: line A
text: line b
text: line C`);
    // attributions present
    expect(source).toContain("by: Sara");
    expect(source).toContain("by: Omar");
  });

  it("applies an identical edit once (no conflict)", () => {
    const same = `text: line a
text: line B
text: line c`;
    const { source, conflicts } = mergeThreeWay(base, same, same);
    expect(conflicts).toBe(0);
    expect(acceptChanges(source)).toBe(same);
  });

  it("marks a true conflict (both sides change the same region differently)", () => {
    const mine = `text: line a
text: line B1
text: line c`;
    const theirs = `text: line a
text: line B2
text: line c`;
    const { source, conflicts } = mergeThreeWay(base, mine, theirs, { mineLabel: "Sara", theirsLabel: "Omar" });
    expect(conflicts).toBe(1);
    // both variants are offered as attributed insertions for a human to pick
    const changes = extractChanges(source);
    expect(changes.some((c) => c.type === "ins" && c.text.includes("B1") && c.by === "Sara")).toBe(true);
    expect(changes.some((c) => c.type === "ins" && c.text.includes("B2") && c.by === "Omar")).toBe(true);
    // the base line is struck out
    expect(changes.some((c) => c.type === "del" && c.text.includes("line b"))).toBe(true);
  });

  it("identical base/mine/theirs → no changes, no conflicts", () => {
    const { source, conflicts } = mergeThreeWay(base, base, base);
    expect(conflicts).toBe(0);
    expect(source).toBe(base);
  });

  it("handles an insertion on one side", () => {
    const mine = `text: line a
text: line b
text: inserted by mine
text: line c`;
    const { source, conflicts } = mergeThreeWay(base, mine, base, { mineLabel: "Sara" });
    expect(conflicts).toBe(0);
    expect(acceptChanges(source)).toContain("inserted by mine");
  });
});
