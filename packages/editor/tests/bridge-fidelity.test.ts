// bridge-fidelity — does the visual editor's round-trip preserve the document?
//
// The editor edits a TipTap model, then serialises back with docToSource. If that
// round-trip changes blocks the user didn't touch, the change indicator over-counts
// and (worse) a save can drift the bytes. This suite exercises every construct and
// reports which ones survive sourceToDoc → docToSource unchanged.
//
// "Semantic" fidelity = parse(src) deep-equals parse(roundtrip) per diffDocuments
// (whitespace/property-order ignored). "Byte" fidelity = exact string match.

import { describe, it, expect } from "vitest";
import { parseIntentText, diffDocuments } from "@dotit/core";
import { sourceToDoc, docToSource } from "../src/bridge";

const roundtrip = (src: string) => docToSource(sourceToDoc(src));

const semanticDiff = (a: string, b: string) => {
  const d = diffDocuments(parseIntentText(a), parseIntentText(b));
  return d.added.length + d.removed.length + d.modified.length;
};

// One representative document per construct. Keep them small so a failure points
// straight at the construct that drifts.
const CASES: Record<string, string> = {
  "title + summary": "title: Invoice INV-2026-0042\nsummary: Acme Corporation",
  "bare prose": "The parties agree to the terms below.\nA second sentence here.",
  // Distinct paragraphs are blank-separated (the canonical multi-paragraph form).
  // The editor serializes prose BARE now, so two paragraphs round-trip as two bare
  // blocks; `text:` is still accepted on input and survives semantically.
  "text keyword": "text: Hello world\n\ntext: Second line",
  "section + sub": "section: Scope\nsub: Phase 1\ntext: Details here",
  "bullet list": "- First item\n- Second item\n- Third item",
  "ordered list": "1. First\n1. Second\n1. Third",
  "inline formatting": "text: This is *bold* and _italic_ and ~struck~ text",
  link: "link: Docs | to: https://example.com",
  image: "image: A logo | src: ./logo.png",
  metric: "metric: Revenue | value: 24000 | unit: USD",
  "callout (info)": "info: Heads up — this expires soon | type: warning",
  quote: "quote: The best way to predict the future is to invent it | by: Alan Kay",
  "code block": "code: ```\nconst x = 1;\nconst y = 2;\n``` | lang: js",
  meta: "meta: | type: invoice | id: INV-001 | version: 2",
  contact: "contact: Acme Corp | role: Client | email: billing@acme.com",
  "pipe table": "section: Line Items\n| Description | Qty | Total |\n| Dev | 1 | 12000 |\n| Design | 8 | 3600 |",
  "trust: approve": "title: Doc\napprove: Reviewed | by: Sarah | role: Legal | at: 2026-03-05",
  "invoice-like": [
    "title: Invoice INV-2026-0042",
    "text: Dalil Technology LLC",
    "",
    "section: Bill To",
    "text: Acme Corporation",
    "",
    "section: Line Items",
    "| Description | Qty | Unit Price | Total |",
    "| Platform Development | 1 | 12000 | 12000 |",
    "",
    "metric: Subtotal | value: 16500 | unit: QAR",
  ].join("\n"),
};

describe("bridge fidelity — sourceToDoc → docToSource", () => {
  for (const [name, src] of Object.entries(CASES)) {
    it(`${name}: survives the round-trip with no SEMANTIC change`, () => {
      const back = roundtrip(src);
      const drift = semanticDiff(src, back);
      // Report the actual before/after on failure so the drifting construct is obvious.
      expect(
        drift,
        `\n--- src ---\n${src}\n--- roundtrip ---\n${back}\n`,
      ).toBe(0);
    });
  }
});

describe("bridge fidelity — a single edit touches only one block", () => {
  // The crux of "one space = N changes": editing one block must not re-serialise
  // its neighbours. We simulate an edit on the invoice and diff against the original.
  const SRC = CASES["invoice-like"];

  it("editing one block's text reports ~1 changed block, not many", () => {
    const doc = sourceToDoc(SRC);
    // Mutate the FIRST text node's content (simulate the user typing in one block).
    const json = JSON.parse(JSON.stringify(doc));
    let edited = false;
    const walk = (n: any) => {
      if (edited) return;
      if (n.type === "text" && typeof n.text === "string") {
        n.text = n.text + " X";
        edited = true;
        return;
      }
      (n.content || []).forEach(walk);
    };
    walk(json);
    expect(edited, "could not find a text node to edit").toBe(true);

    const editedSrc = docToSource(json);
    const drift = semanticDiff(SRC, editedSrc);
    expect(
      drift,
      `editing one block drifted ${drift} blocks\n--- editedSrc ---\n${editedSrc}\n`,
    ).toBeLessThanOrEqual(1);
  });
});

describe("bridge — literal pipes are escaped on serialize (no broken lines)", () => {
  it("re-emits a literal pipe in prose as \\| (round-trips intact, no diagnostics)", () => {
    const src = "text: run a \\| b in the shell";
    const out = roundtrip(src);
    expect(out).toContain("\\|");
    const doc = parseIntentText(out);
    expect(doc.blocks[0].content).toBe("run a | b in the shell");
    expect(doc.diagnostics ?? []).toHaveLength(0);
  });

  it("escapes a pipe in BARE prose too", () => {
    const out = roundtrip("A logical OR is written a \\| b here.");
    const doc = parseIntentText(out);
    expect(doc.blocks[0].type).toBe("text");
    expect(doc.blocks[0].content).toBe("A logical OR is written a | b here.");
    expect(doc.diagnostics ?? []).toHaveLength(0);
  });

  it("leaves pipes in fenced code verbatim (NOT escaped)", () => {
    const src = "code: ```sh\na | grep b\n```";
    const out = roundtrip(src);
    expect(out).not.toContain("\\|");
    expect(parseIntentText(out).blocks[0].content).toContain("a | grep b");
  });
});
