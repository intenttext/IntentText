import { describe, it, expect } from "vitest";
import {
  compareVersions,
  hasTrackedChanges,
  acceptChanges,
  rejectChanges,
  extractChanges,
} from "../src/index";

describe("compareVersions", () => {
  it("identical versions produce no tracked changes", () => {
    const src = "title: Deal\ntext: The price is 1,200 per unit.\n";
    const out = compareVersions(src, src);
    expect(hasTrackedChanges(out)).toBe(false);
    expect(out).toBe(src); // all lines equal → identical source back
  });

  it("a one-word edit shows inline (word-level), keyword preserved", () => {
    const before = "text: The price is 1,200 per unit.";
    const after = "text: The price is 1,500 per unit.";
    const out = compareVersions(before, after);
    // only the changed word is marked — surrounding words stay plain
    expect(out).toContain("The price is");
    expect(out).toContain("[1,200]{track: del}");
    expect(out).toContain("[1,500]{track: ins}");
    expect(out).toContain("per unit.");
    // and it round-trips: accept → after, reject → before (modification case is exact)
    expect(acceptChanges(out)).toBe(after);
    expect(rejectChanges(out)).toBe(before);
  });

  it("an added line becomes an insertion; a removed line a deletion", () => {
    const before = "section: Terms\ntext: Net 30.";
    const after = "section: Terms\ntext: Net 30.\ntext: Late fee applies.";
    const out = compareVersions(after, before); // removed the late-fee line
    const changes = extractChanges(out);
    expect(changes.some((c) => c.type === "del" && c.text.includes("Late fee"))).toBe(true);

    const out2 = compareVersions(before, after); // added the late-fee line
    const ins = extractChanges(out2);
    expect(ins.some((c) => c.type === "ins" && c.text.includes("Late fee"))).toBe(true);
    // accepting the insertion keeps the new clause text
    expect(acceptChanges(out2)).toContain("Late fee applies.");
  });

  it("attributes changes to `by` when provided", () => {
    const out = compareVersions("text: red", "text: blue", { by: "Sarah" });
    expect(out).toContain("track: del; by: Sarah");
    expect(out).toContain("track: ins; by: Sarah");
  });

  it("multi-line modification: each changed line word-diffs independently", () => {
    const before = "text: Buyer pays 1,000.\ntext: Delivery in 30 days.";
    const after = "text: Buyer pays 2,000.\ntext: Delivery in 14 days.";
    const out = compareVersions(before, after);
    expect(acceptChanges(out)).toBe(after);
    expect(rejectChanges(out)).toBe(before);
    // word-level tokens include their trailing punctuation ("1,000." is one token)
    expect(out).toContain("[1,000.]{track: del}");
    expect(out).toContain("[2,000.]{track: ins}");
    expect(out).toContain("[30]{track: del}");
    expect(out).toContain("[14]{track: ins}");
  });
});
