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

  it("no longer treats former emit: alias as a signal — it parses as a custom block", () => {
    const src = `title: Test\nstep: Do work | id: s1\nemit: Payment confirmed`;
    const doc = parseIntentText(src);
    // The emit alias was eliminated: it must now resolve to a custom block
    // carrying its literal keyword, not normalize to a signal.
    const emitBlock = doc.blocks.find(
      (b) => b.type === "custom" && b.properties?.keyword === "emit",
    );
    expect(emitBlock).toBeDefined();
    expect(emitBlock?.type).toBe("custom");
    expect(emitBlock?.properties?.keyword).toBe("emit");
    // And the workflow graph must not surface a signal from it.
    const graph = extractWorkflow(doc);
    const types = Object.values(graph.steps).map((s) => s.block.type);
    expect(types).not.toContain("signal");
    expect(types).not.toContain("emit");
  });
});
