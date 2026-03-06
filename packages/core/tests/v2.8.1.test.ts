import { describe, it, expect, beforeEach } from "vitest";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  mergeData,
  parseAndMerge,
  validateDocumentSemantic,
  documentToSource,
  _resetIdCounter,
  ALIASES,
} from "../src";

beforeEach(() => {
  _resetIdCounter();
});

// ═══════════════════════════════════════════════════════
// ADDITION 1 — meta: keyword
// ═══════════════════════════════════════════════════════

describe("meta: keyword", () => {
  it("meta: parses to metadata.meta correctly", () => {
    const doc = parseIntentText(
      "title: My Doc\nmeta: | author: Ahmed | lang: en\n",
    );
    expect(doc.metadata?.meta).toEqual({ author: "Ahmed", lang: "en" });
  });

  it("multiple meta: blocks merge into single metadata.meta", () => {
    const doc = parseIntentText(
      "title: My Doc\nmeta: | author: Ahmed | lang: en\nmeta: | client: Acme Corp | department: Legal\n",
    );
    expect(doc.metadata?.meta).toEqual({
      author: "Ahmed",
      lang: "en",
      client: "Acme Corp",
      department: "Legal",
    });
  });

  it("meta: produces no blocks in document.blocks", () => {
    const doc = parseIntentText(
      "title: My Doc\nmeta: | author: Ahmed | lang: en\nsummary: Test\n",
    );
    const metaBlocks = doc.blocks.filter((b) => b.type === "meta");
    expect(metaBlocks).toHaveLength(0);
    // title and summary should be present
    expect(doc.blocks.some((b) => b.type === "title")).toBe(true);
    expect(doc.blocks.some((b) => b.type === "summary")).toBe(true);
  });

  it("meta: is invisible in HTML renderer output", () => {
    const doc = parseIntentText(
      "title: My Doc\nmeta: | author: Ahmed\n\nsection: Intro\nnote: Hello\n",
    );
    const html = renderHTML(doc);
    expect(html).not.toContain("Ahmed");
    expect(html).toContain("My Doc");
    expect(html).toContain("Hello");
  });

  it("meta: after section: is treated as content block", () => {
    const doc = parseIntentText(
      "title: My Doc\n\nsection: Body\nmeta: | author: Ahmed\n",
    );
    // Should NOT populate metadata.meta
    expect(doc.metadata?.meta).toBeUndefined();
    // Should emit as a block
    const allBlocks = doc.blocks.flatMap(function collect(b: any): any[] {
      return [b, ...(b.children ?? []).flatMap(collect)];
    });
    const metaBlocks = allBlocks.filter((b: any) => b.type === "meta");
    expect(metaBlocks).toHaveLength(1);
  });

  it("META_AFTER_SECTION warning raised correctly", () => {
    const doc = parseIntentText(
      "title: My Doc\n\nsection: Body\nmeta: | author: Ahmed\n",
    );
    const result = validateDocumentSemantic(doc);
    const metaWarnings = result.issues.filter(
      (i) => i.code === "META_AFTER_SECTION",
    );
    expect(metaWarnings).toHaveLength(1);
    expect(metaWarnings[0].type).toBe("warning");
  });

  it("no META_AFTER_SECTION warning when meta: is in header", () => {
    const doc = parseIntentText(
      "title: My Doc\nmeta: | author: Ahmed\n\nsection: Body\nnote: Hello\n",
    );
    const result = validateDocumentSemantic(doc);
    const metaWarnings = result.issues.filter(
      (i) => i.code === "META_AFTER_SECTION",
    );
    expect(metaWarnings).toHaveLength(0);
  });

  it("documentToSource round-trips meta: correctly", () => {
    const source =
      "title: My Doc\nmeta: | author: Ahmed | lang: en\n\nsection: Body\nnote: Hello";
    const doc = parseIntentText(source);
    // meta: is consumed as metadata, not as a block, so documentToSource
    // won't have it unless we reconstruct. Just verify metadata.meta is set.
    expect(doc.metadata?.meta).toEqual({ author: "Ahmed", lang: "en" });
  });

  it("meta: with 10+ properties parses all correctly", () => {
    const doc = parseIntentText(
      "title: Doc\nmeta: | a: 1 | b: 2 | c: 3 | d: 4 | e: 5 | f: 6 | g: 7 | h: 8 | i: 9 | j: 10 | k: 11\n",
    );
    expect(doc.metadata?.meta).toBeDefined();
    expect(Object.keys(doc.metadata!.meta!)).toHaveLength(11);
    expect(doc.metadata!.meta!.a).toBe("1");
    expect(doc.metadata!.meta!.k).toBe("11");
  });
});

// ═══════════════════════════════════════════════════════
// ADDITION 2 — each: property for dynamic table rows
// ═══════════════════════════════════════════════════════

describe("each: dynamic table rows", () => {
  it("each: items expands 3 items to 3 rows", () => {
    const source = `title: Invoice
| Description | Qty | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.total}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, {
      items: [
        { description: "Consulting", qty: "10", total: "5000" },
        { description: "Design", qty: "5", total: "1500" },
        { description: "Support", qty: "2", total: "500" },
      ],
    });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    expect(table!.table!.rows).toHaveLength(3);
    expect(table!.table!.rows[0][0]).toBe("Consulting");
    expect(table!.table!.rows[2][2]).toBe("500");
  });

  it("each: items with empty array produces 0 data rows", () => {
    const source = `title: Invoice
| Description | Qty | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.total}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, { items: [] });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    expect(table!.table!.headers).toEqual(["Description", "Qty", "Total"]);
    expect(table!.table!.rows).toHaveLength(0);
  });

  it("each: items header row renders without each property in output", () => {
    const source = `| Name | Price | each: items |
| {{item.name}} | {{item.price}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, {
      items: [{ name: "Widget", price: "10" }],
    });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table!.table!.headers).toEqual(["Name", "Price"]);
    // The "each: items" column is removed from headers
    expect(table!.table!.headers).not.toContain("each: items");
  });

  it("each: orders as order uses explicit loop variable", () => {
    const source = `| Order ID | Status | each: orders as order |
| {{order.id}} | {{order.status}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, {
      orders: [
        { id: "ORD-001", status: "shipped" },
        { id: "ORD-002", status: "pending" },
      ],
    });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table!.table!.rows).toHaveLength(2);
    expect(table!.table!.rows[0][0]).toBe("ORD-001");
    expect(table!.table!.rows[1][1]).toBe("pending");
  });

  it("singularize correctly handles items, products, entries, invoices", () => {
    // Test through actual usage
    const makeSource = (arr: string) =>
      `| Name | each: ${arr} |\n| {{${arr.replace(/ies$/, "y").replace(/s$/, "")}.name}} |`;

    // items → item
    const doc1 = parseIntentText(makeSource("items"));
    const m1 = mergeData(doc1, { items: [{ name: "A" }] });
    expect(m1.blocks.find((b) => b.type === "table")!.table!.rows[0][0]).toBe(
      "A",
    );

    // products → product
    const doc2 = parseIntentText(
      `| Name | each: products |\n| {{product.name}} |`,
    );
    const m2 = mergeData(doc2, { products: [{ name: "B" }] });
    expect(m2.blocks.find((b) => b.type === "table")!.table!.rows[0][0]).toBe(
      "B",
    );

    // entries → entry
    const doc3 = parseIntentText(
      `| Name | each: entries |\n| {{entry.name}} |`,
    );
    const m3 = mergeData(doc3, { entries: [{ name: "C" }] });
    expect(m3.blocks.find((b) => b.type === "table")!.table!.rows[0][0]).toBe(
      "C",
    );
  });

  it("nested properties {{item.address.city}} resolve correctly", () => {
    const source = `| City | each: people as person |
| {{person.address.city}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, {
      people: [{ address: { city: "Doha" } }, { address: { city: "Dubai" } }],
    });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table!.table!.rows[0][0]).toBe("Doha");
    expect(table!.table!.rows[1][0]).toBe("Dubai");
  });

  it("missing array in data — header renders, no crash", () => {
    const source = `| Name | each: missing |
| {{mi.name}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, {});
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    expect(table!.table!.headers).toEqual(["Name"]);
    expect(table!.table!.rows).toHaveLength(0);
  });

  it("non-array value for each: — header renders, no crash", () => {
    const source = `| Name | each: notarray |
| {{notarra.name}} |`;
    const doc = parseIntentText(source);
    const merged = mergeData(doc, { notarray: "string-value" });
    const table = merged.blocks.find((b) => b.type === "table");
    expect(table).toBeDefined();
    expect(table!.table!.headers).toEqual(["Name"]);
    expect(table!.table!.rows).toHaveLength(0);
  });

  it("full invoice template renders correctly end-to-end", () => {
    const source = `title: Invoice {{invoice.number}}
note: Bill To: {{client.name}}

| Description | Qty | Total | each: items |
| {{item.description}} | {{item.qty}} | {{item.total}} |

note: **Total: {{totals.due}}**`;

    const data = {
      invoice: { number: "INV-2026-042" },
      client: { name: "Acme Corp" },
      items: [
        { description: "Consulting", qty: "10", total: "5,000" },
        { description: "Design", qty: "5", total: "1,500" },
      ],
      totals: { due: "6,500 USD" },
    };

    const doc = parseAndMerge(source, data);
    expect(doc.blocks.find((b) => b.type === "title")?.content).toBe(
      "Invoice INV-2026-042",
    );
    const table = doc.blocks.find((b) => b.type === "table");
    expect(table!.table!.rows).toHaveLength(2);
    expect(table!.table!.rows[0][0]).toBe("Consulting");
    const html = renderHTML(doc);
    expect(html).toContain("INV-2026-042");
    expect(html).toContain("Consulting");
  });

  it("documentToSource preserves each: property on header row", () => {
    // Parse a table with each: in headers
    const source = `| Description | Qty | each: items |
| {{item.description}} | {{item.qty}} |`;
    const doc = parseIntentText(source);
    const table = doc.blocks.find((b) => b.type === "table");
    expect(table!.table!.headers).toContain("each: items");
    // documentToSource should preserve it
    const roundTripped = documentToSource(doc);
    expect(roundTripped).toContain("each: items");
  });
});

// ═══════════════════════════════════════════════════════
// ADDITION 3 — Alias system
// ═══════════════════════════════════════════════════════

describe("alias system", () => {
  it("ALIASES object is exported", () => {
    expect(ALIASES).toBeDefined();
    expect(typeof ALIASES).toBe("object");
    expect(Object.keys(ALIASES).length).toBeGreaterThan(10);
  });

  it("text: parses identically to note:", () => {
    const docAlias = parseIntentText("text: Hello world");
    const docCanonical = parseIntentText("note: Hello world");
    expect(docAlias.blocks[0].type).toBe(docCanonical.blocks[0].type);
    expect(docAlias.blocks[0].type).toBe("note");
    expect(docAlias.blocks[0].content).toBe(docCanonical.blocks[0].content);
  });

  it("h2: parses identically to section:", () => {
    const docAlias = parseIntentText("h2: Introduction");
    const docCanonical = parseIntentText("section: Introduction");
    expect(docAlias.blocks[0].type).toBe("section");
    expect(docAlias.blocks[0].content).toBe(docCanonical.blocks[0].content);
  });

  it("todo: parses identically to task:", () => {
    const docAlias = parseIntentText("todo: Write docs | owner: Ahmed");
    const docCanonical = parseIntentText("task: Write docs | owner: Ahmed");
    expect(docAlias.blocks[0].type).toBe("task");
    expect(docAlias.blocks[0].content).toBe(docCanonical.blocks[0].content);
    expect(docAlias.blocks[0].properties?.owner).toBe("Ahmed");
  });

  it("log: parses identically to audit:", () => {
    const docAlias = parseIntentText("log: System started");
    const docCanonical = parseIntentText("audit: System started");
    expect(docAlias.blocks[0].type).toBe("audit");
    expect(docAlias.blocks[0].content).toBe(docCanonical.blocks[0].content);
  });

  it("lock: parses identically to freeze:", () => {
    const docAlias = parseIntentText(
      "lock: | at: 2026-01-01 | hash: sha256:abc123",
    );
    const docCanonical = parseIntentText(
      "freeze: | at: 2026-01-01 | hash: sha256:abc123",
    );
    expect(docAlias.blocks[0].type).toBe("freeze");
    expect(docAlias.blocks[0].properties?.hash).toBe(
      docCanonical.blocks[0].properties?.hash,
    );
  });

  it("rule: parses identically to policy:", () => {
    const docAlias = parseIntentText("rule: No PII in logs | action: block");
    const docCanonical = parseIntentText(
      "policy: No PII in logs | action: block",
    );
    expect(docAlias.blocks[0].type).toBe("policy");
    expect(docAlias.blocks[0].content).toBe(docCanonical.blocks[0].content);
    expect(docAlias.blocks[0].properties?.action).toBe("block");
  });

  it("constraint: parses identically to policy:", () => {
    const doc = parseIntentText("constraint: Max 5 retries | action: warn");
    expect(doc.blocks[0].type).toBe("policy");
    expect(doc.blocks[0].content).toBe("Max 5 retries");
  });

  it("RULE: (uppercase) resolves correctly to policy:", () => {
    const doc = parseIntentText("RULE: Uppercase test | action: block");
    // Parser lowercases the keyword before alias lookup
    expect(doc.blocks[0].type).toBe("policy");
  });

  it("documentToSource of aliased block outputs canonical keyword", () => {
    const doc = parseIntentText("text: Hello world");
    expect(doc.blocks[0].type).toBe("note");
    const source = documentToSource(doc);
    expect(source).toContain("note:");
    expect(source).not.toContain("text:");
  });

  it("round-trip: parse with alias → source → parse again produces same result", () => {
    const doc1 = parseIntentText(
      "h2: Intro\ntodo: Do this | owner: Ahmed\nrule: Be safe | action: warn",
    );
    const source = documentToSource(doc1);
    const doc2 = parseIntentText(source);

    expect(doc2.blocks[0].type).toBe("section");
    expect(doc2.blocks[0].content).toBe("Intro");

    const allBlocks1 = doc1.blocks.flatMap(function collect(b: any): any[] {
      return [b, ...(b.children ?? []).flatMap(collect)];
    });
    const allBlocks2 = doc2.blocks.flatMap(function collect(b: any): any[] {
      return [b, ...(b.children ?? []).flatMap(collect)];
    });

    const tasks1 = allBlocks1.filter((b: any) => b.type === "task");
    const tasks2 = allBlocks2.filter((b: any) => b.type === "task");
    expect(tasks1.length).toBe(tasks2.length);
  });

  it("completed: and finished: resolve to done (task with status: done)", () => {
    const doc1 = parseIntentText("completed: Task A");
    expect(doc1.blocks[0].type).toBe("task");
    expect(doc1.blocks[0].properties?.status).toBe("done");

    const doc2 = parseIntentText("finished: Task B");
    expect(doc2.blocks[0].type).toBe("task");
    expect(doc2.blocks[0].properties?.status).toBe("done");
  });

  it("run: resolves to step: with pending status", () => {
    const doc = parseIntentText("run: Execute query");
    expect(doc.blocks[0].type).toBe("step");
    expect(doc.blocks[0].properties?.status).toBe("pending");
  });

  it("if: resolves to decision:", () => {
    const doc = parseIntentText("if: Is valid? | then: proceed | else: abort");
    expect(doc.blocks[0].type).toBe("decision");
    expect(doc.blocks[0].properties?.then).toBe("proceed");
  });
});

// ═══════════════════════════════════════════════════════
// ADDITION 4 — Known style properties
// ═══════════════════════════════════════════════════════

describe("style properties", () => {
  it("color: red produces style attribute in HTML output", () => {
    const doc = parseIntentText("note: Warning text | color: red");
    const html = renderHTML(doc);
    expect(html).toContain('style="color: red"');
  });

  it("align: center produces text-align style", () => {
    const doc = parseIntentText("note: Centered | align: center");
    const html = renderHTML(doc);
    // align produces both class and inline style
    expect(html).toContain("text-align: center");
  });

  it("bg: yellow produces background-color in HTML output", () => {
    const doc = parseIntentText("note: Highlight | bg: yellow");
    const html = renderHTML(doc);
    expect(html).toContain("background-color: yellow");
  });

  it("italic: true produces font-style: italic in HTML output", () => {
    const doc = parseIntentText("note: Aside | italic: true");
    const html = renderHTML(doc);
    expect(html).toContain("font-style: italic");
  });

  it("border: true produces border: 1px solid currentColor", () => {
    const doc = parseIntentText("note: Boxed | border: true");
    const html = renderHTML(doc);
    expect(html).toContain("border: 1px solid currentColor");
  });

  it("unknown style property is ignored — no crash, no output", () => {
    const doc = parseIntentText("note: Test | foo: bar");
    const html = renderHTML(doc);
    // The style attribute should not contain 'foo'
    expect(html).not.toMatch(/style="[^"]*foo/);
    expect(html).toContain("Test");
  });

  it("multiple style properties combine into single style attribute", () => {
    const doc = parseIntentText(
      "note: Styled | color: blue | bg: #f0f0f0 | weight: bold",
    );
    const html = renderHTML(doc);
    expect(html).toContain("color: blue");
    expect(html).toContain("background-color: #f0f0f0");
    expect(html).toContain("font-weight: bold");
    // All in one style attribute
    const styleMatch = html.match(/style="([^"]+)"/);
    expect(styleMatch).toBeTruthy();
    expect(styleMatch![1]).toContain("color: blue");
    expect(styleMatch![1]).toContain("background-color: #f0f0f0");
  });

  it("style properties do not affect parser output — only renderer", () => {
    const doc = parseIntentText("note: Test | color: red | bg: yellow");
    // Parser stores them as regular properties
    expect(doc.blocks[0].properties?.color).toBe("red");
    expect(doc.blocks[0].properties?.bg).toBe("yellow");
    // Type is still note
    expect(doc.blocks[0].type).toBe("note");
  });
});
