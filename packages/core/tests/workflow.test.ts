import { describe, it, expect } from "vitest";
import { extractWorkflow } from "../src/workflow";
import { parseIntentText } from "../src/parser";

describe("extractWorkflow — canonical signal blocks", () => {
  it("includes canonical signal: blocks in workflow graph", () => {
    const src = `title: Test\nstep: Do work | id: s1\nsignal: Work complete`;
    const doc = parseIntentText(src);
    const graph = extractWorkflow(doc);
    const types = Object.values(graph.steps).map((s) => s.block.type);
    expect(types).toContain("signal");
  });

  it("includes signal blocks when written as deprecated emit:", () => {
    const src = `title: Test\nstep: Do work | id: s1\nemit: Payment confirmed`;
    const doc = parseIntentText(src);
    const graph = extractWorkflow(doc);
    const types = Object.values(graph.steps).map((s) => s.block.type);
    // Parser normalizes emit → signal, so graph must contain signal, not emit
    expect(types).toContain("signal");
    expect(types).not.toContain("emit");
  });
});
