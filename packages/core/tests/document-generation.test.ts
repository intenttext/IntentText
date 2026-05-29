import { describe, it, expect } from "vitest";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  mergeData,
  parseAndMerge,
} from "../src";

// ── Merge Engine ──────────────────────────────────────────────────────────

describe("Merge Engine", () => {
  it("resolves simple {{key}} references", () => {
    const doc = parseIntentText("title: Hello {{name}}");
    const merged = mergeData(doc, { name: "World" });
    expect(merged.blocks[0].content).toBe("Hello World");
  });

  it("resolves nested {{client.name}} dot notation", () => {
    const doc = parseIntentText("note: Dear {{client.name}}");
    const merged = mergeData(doc, { client: { name: "Acme Corp" } });
    expect(merged.blocks[0].content).toBe("Dear Acme Corp");
  });

  it("resolves array index {{items.0.price}}", () => {
    const doc = parseIntentText("note: Price is {{items.0.price}}");
    const merged = mergeData(doc, { items: [{ price: "100 QAR" }] });
    expect(merged.blocks[0].content).toBe("Price is 100 QAR");
  });

  it("leaves unresolved {{missing}} as-is and sets unresolved property", () => {
    const doc = parseIntentText("note: Hello {{missing}}");
    const merged = mergeData(doc, {});
    expect(merged.blocks[0].content).toContain("{{missing}}");
    expect(merged.blocks[0].properties?.unresolved).toBe(1);
  });

  it("resolves {{timestamp}}, {{date}}, {{year}} automatically", () => {
    const doc = parseIntentText("note: Year: {{year}}");
    const merged = mergeData(doc, {});
    expect(merged.blocks[0].content).toContain(
      String(new Date().getFullYear()),
    );
  });

  it("does NOT resolve {{page}} and {{pages}} (runtime variables)", () => {
    const doc = parseIntentText("note: Page {{page}} of {{pages}}");
    const merged = mergeData(doc, {});
    expect(merged.blocks[0].content).toBe("Page {{page}} of {{pages}}");
  });

  it("parseAndMerge() parses source string and merges data in one call", () => {
    const merged = parseAndMerge("title: {{title}}", { title: "Test" });
    expect(merged.blocks[0].content).toBe("Test");
    expect(merged.blocks[0].type).toBe("title");
  });

  it("does not mutate the original document", () => {
    const doc = parseIntentText("title: {{name}}");
    const original = doc.blocks[0].content;
    mergeData(doc, { name: "World" });
    expect(doc.blocks[0].content).toBe(original);
  });

  it("resolves variables in block properties", () => {
    const doc = parseIntentText("task: Do something | owner: {{owner}}");
    const merged = mergeData(doc, { owner: "Ahmed" });
    expect(String(merged.blocks[0].properties?.owner)).toBe("Ahmed");
  });

  it("resolves variables in table cells", () => {
    const doc = parseIntentText(
      "| Name | Price |\n| {{item.name}} | {{item.price}} |",
    );
    const merged = mergeData(doc, {
      item: { name: "Widget", price: "$10" },
    });
    expect(merged.blocks[0].table?.rows?.[0]).toContain("Widget");
    expect(merged.blocks[0].table?.rows?.[0]).toContain("$10");
  });
});

// ── Layout Blocks ─────────────────────────────────────────────────────────

describe("Layout Blocks", () => {
  it("font: parses to correct JSON shape with all properties", () => {
    const doc = parseIntentText(
      "font: | family: Georgia, serif | size: 12pt | leading: 1.6",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("font");
    expect(block.properties?.family).toBe("Georgia, serif");
    expect(block.properties?.size).toBe("12pt");
    expect(Number(block.properties?.leading)).toBe(1.6);
  });

  it("page: parses to correct JSON shape with all properties", () => {
    const doc = parseIntentText(
      "page: | size: A4 | margins: 20mm | numbering: true",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("page");
    expect(block.properties?.size).toBe("A4");
    expect(block.properties?.margins).toBe("20mm");
  });

  it("break: parses to { type: 'break' } with no content", () => {
    const doc = parseIntentText("break:");
    const block = doc.blocks[0];
    expect(block.type).toBe("break");
  });

  it("renderPrint() includes @media print CSS in output", () => {
    const doc = parseIntentText("title: Test");
    const html = renderPrint(doc);
    expect(html).toContain("@media print");
  });

  it("renderPrint() applies font: block values as CSS", () => {
    const doc = parseIntentText(
      "font: | family: Palatino, serif | size: 14pt\ntitle: Test",
    );
    const html = renderPrint(doc);
    expect(html).toContain("Palatino, serif");
    expect(html).toContain("14pt");
  });

  it("renderPrint() applies page: block values as CSS", () => {
    const doc = parseIntentText(
      "page: | size: Letter | margins: 25mm\ntitle: Test",
    );
    const html = renderPrint(doc);
    expect(html).toContain("Letter");
    expect(html).toContain("25mm");
  });

  it("renderPrint() renders break: as page break div", () => {
    const doc = parseIntentText("title: Before\nbreak:\ntitle: After");
    const html = renderPrint(doc);
    expect(html).toContain('class="it-page-break"');
  });

  it("renderHTML() does not render font: or page: blocks as visible content", () => {
    const doc = parseIntentText(
      "font: | family: Courier New | size: 14pt\npage: | size: A4\ntitle: Test",
    );
    const html = renderHTML(doc);
    // font and page should not produce visible block output
    expect(html).not.toContain('class="it-font"');
    expect(html).not.toContain('class="it-page"');
    expect(html).toContain("Test");
  });
});

// ── Writer Blocks ─────────────────────────────────────────────────────────

describe("Writer Blocks", () => {
  it("byline: parses content as author name with date and publication properties", () => {
    const doc = parseIntentText(
      "byline: John Doe | date: 2026-03-01 | publication: The Times",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("byline");
    expect(block.content).toBe("John Doe");
    expect(block.properties?.date).toBe("2026-03-01");
    expect(block.properties?.publication).toBe("The Times");
  });

  it("byline: renders as <div class='it-byline'> with correct child elements", () => {
    const doc = parseIntentText(
      "byline: Jane Smith | date: 2026 | publication: Tribune",
    );
    const html = renderHTML(doc);
    expect(html).toContain('class="it-byline"');
    expect(html).toContain('class="it-byline-author"');
    expect(html).toContain("Jane Smith");
    expect(html).toContain("2026");
    expect(html).toContain("Tribune");
  });

  it("epigraph: parses correctly with by: property", () => {
    const doc = parseIntentText(
      "epigraph: Knowledge is power | by: Francis Bacon",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("epigraph");
    expect(block.content).toBe("Knowledge is power");
    expect(block.properties?.by).toBe("Francis Bacon");
  });

  it("epigraph: renders as <blockquote class='it-epigraph'>", () => {
    const doc = parseIntentText("epigraph: To be or not to be | by: Hamlet");
    const html = renderHTML(doc);
    expect(html).toContain('class="it-epigraph"');
    expect(html).toContain("To be or not to be");
    expect(html).toContain("Hamlet");
  });

  it("caption: parses content only, no required properties", () => {
    const doc = parseIntentText("caption: Figure 1. Chart of results");
    const block = doc.blocks[0];
    expect(block.type).toBe("caption");
    expect(block.content).toBe("Figure 1. Chart of results");
  });

  it("caption: renders as <figcaption class='it-caption'>", () => {
    const doc = parseIntentText("caption: Photo by John");
    const html = renderHTML(doc);
    expect(html).toContain('class="it-caption"');
    expect(html).toContain("Photo by John");
  });

  it("footnote: parses number from content and text: from properties", () => {
    const doc = parseIntentText(
      "footnote: 1 | text: This is the first footnote.",
    );
    const block = doc.blocks[0];
    expect(block.type).toBe("footnote");
    expect(block.content).toBe("1");
    expect(block.properties?.text).toBe("This is the first footnote.");
  });

  it("footnote: blocks are collected and rendered as footnotes section", () => {
    const doc = parseIntentText(
      "note: Some text[^1]\nfootnote: 1 | text: A footnote.",
    );
    const html = renderHTML(doc);
    expect(html).toContain('class="it-footnotes"');
    expect(html).toContain("A footnote.");
    expect(html).toContain('id="fn-1"');
  });

  it("inline [^1] parses as footnote-ref", () => {
    const doc = parseIntentText("note: See this[^1] reference");
    const inlines = doc.blocks[0].inline;
    expect(inlines).toBeDefined();
    const fnRef = inlines!.find(
      (n: { type: string }) => n.type === "footnote-ref",
    );
    expect(fnRef).toBeDefined();
    expect((fnRef as { value: string }).value).toBe("1");
  });

  it("inline [^1] renders as <sup class='it-fn-ref'>", () => {
    const doc = parseIntentText("note: Text[^1]");
    const html = renderHTML(doc);
    expect(html).toContain('class="it-fn-ref"');
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain(">1</a>");
  });

  it("toc: parses with depth and title properties, defaults depth:2", () => {
    const doc = parseIntentText("toc:");
    const block = doc.blocks[0];
    expect(block.type).toBe("toc");
    expect(Number(block.properties?.depth)).toBe(2);
    expect(block.properties?.title).toBe("Contents");
  });

  it("toc: renderer scans document sections and builds anchor list", () => {
    const input =
      "toc:\nsection: Introduction\nnote: Hello\nsection: Conclusion\nnote: Bye";
    const doc = parseIntentText(input);
    const html = renderHTML(doc);
    expect(html).toContain('class="it-toc"');
    expect(html).toContain("Introduction");
    expect(html).toContain("Conclusion");
    expect(html).toContain('href="#introduction"');
    expect(html).toContain('href="#conclusion"');
  });

  it("dedication: parses content with inline formatting support", () => {
    const doc = parseIntentText("dedication: For *my mother*");
    const block = doc.blocks[0];
    expect(block.type).toBe("dedication");
    expect(block.content).toBe("For my mother");
    expect(block.inline).toBeDefined();
    const boldNode = block.inline!.find(
      (n: { type: string }) => n.type === "bold",
    );
    expect(boldNode).toBeDefined();
  });

  it("dedication: renders with it-dedication class", () => {
    const doc = parseIntentText("dedication: For the reader");
    const html = renderHTML(doc);
    expect(html).toContain('class="it-dedication"');
    expect(html).toContain("For the reader");
  });

  it("dedication: renders with page-break-after in print CSS", () => {
    const doc = parseIntentText("dedication: For you\ntitle: Chapter 1");
    const html = renderPrint(doc);
    expect(html).toContain("it-dedication");
    expect(html).toContain("page-break-after:always");
  });
});

// ── Integration ───────────────────────────────────────────────────────────

describe("Integration", () => {
  it("full invoice template: parse + merge + render produces valid HTML", () => {
    const template = `font: | family: Arial | size: 11pt
page: | size: A4 | margins: 20mm
title: Invoice
note: **{{seller.name}}**
note: Bill To: {{client.name}}
| Item | Total |
| {{items.0.name}} | {{items.0.total}} |
note: Total: {{totals.due}} | align: right`;

    const data = {
      seller: { name: "Dalil LLC" },
      client: { name: "Acme Corp" },
      items: [{ name: "Dev Work", total: "5000 QAR" }],
      totals: { due: "5000 QAR" },
    };

    const doc = parseAndMerge(template, data);
    const html = renderHTML(doc);
    expect(html).toContain("Dalil LLC");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Dev Work");
    expect(html).toContain("5000 QAR");
    expect(html).toContain("intent-document");
  });

  it("full book chapter: dedication, toc, epigraph, byline, footnote all render", () => {
    const template = `dedication: For my father
break:
toc: | depth: 2 | title: Contents
break:
title: Chapter One
epigraph: A wise quote | by: Author
byline: Emad | date: 2026 | publication: Press
section: Introduction
note: Some text[^1]
sub: Details
note: More text
footnote: 1 | text: A footnote about the source.`;

    const doc = parseIntentText(template);
    const html = renderHTML(doc);
    expect(html).toContain('class="it-dedication"');
    expect(html).toContain('class="it-toc"');
    expect(html).toContain('class="it-epigraph"');
    expect(html).toContain('class="it-byline"');
    expect(html).toContain('class="it-footnotes"');
    expect(html).toContain('id="fn-1"');
    expect(html).toContain("A footnote about the source.");
    expect(html).toContain('href="#introduction"');
  });

  it("full journalism article: byline, caption, [^1] inline ref, footnote", () => {
    const template = `title: Breaking News
byline: Sara | date: 2026-03-05 | publication: Tribune
note: First paragraph[^1]
image: Photo | at: img.jpg
caption: Photo credit
footnote: 1 | text: Source verified.`;

    const doc = parseIntentText(template);
    const html = renderHTML(doc);
    expect(html).toContain('class="it-byline"');
    expect(html).toContain('class="it-caption"');
    expect(html).toContain('class="it-fn-ref"');
    expect(html).toContain('class="it-footnotes"');
    expect(html).toContain("Source verified.");
  });

  it("backward compatibility: existing v2 documents parse identically", () => {
    const input = `title: Project Plan
summary: A summary
section: Phase 1
step: Setup | tool: cli | status: done
task: Configure | owner: Team | due: 2026-04-01
decision: Proceed? | if: budget>0 | then: step2 | else: stop`;

    const doc = parseIntentText(input);
    expect(doc.blocks.length).toBeGreaterThan(0);
    expect(doc.blocks[0].type).toBe("title");
    expect(doc.blocks[0].content).toBe("Project Plan");

    const html = renderHTML(doc);
    expect(html).toContain("intent-document");
    expect(html).toContain("Project Plan");
    expect(html).toContain("intent-step");
  });

  it("version is 2.5 for documents with docgen blocks", () => {
    const doc = parseIntentText("font: | family: Georgia\ntitle: Test");
    expect(doc.version).toBe("2.5");
  });

  it("version is appropriate for basic documents without docgen blocks", () => {
    const doc = parseIntentText("title: Hello\nnote: World");
    // Basic documents get a version based on their content complexity
    expect(doc.version).toBeDefined();
    expect(doc.version).not.toBe("2.5");
  });

  it("renderPrint wraps output in valid HTML document", () => {
    const doc = parseIntentText("title: Test");
    const html = renderPrint(doc);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain('body class="it-print"');
  });

  it("renderPrint hides checkboxes for print", () => {
    const doc = parseIntentText("task: Do something | status: done");
    const html = renderPrint(doc);
    expect(html).toContain("intent-task-checkbox");
    expect(html).toContain("display:none");
  });

  it("renderHTML includes footnotes section at end", () => {
    const doc = parseIntentText(
      "note: Reference[^1]\nnote: Another[^2]\nfootnote: 1 | text: First note\nfootnote: 2 | text: Second note",
    );
    const html = renderHTML(doc);
    expect(html).toContain('class="it-footnotes"');
    expect(html).toContain("First note");
    expect(html).toContain("Second note");
    expect(html).toContain('id="fn-1"');
    expect(html).toContain('id="fn-2"');
  });

  it("TOC includes sub-headings at depth 2", () => {
    const input =
      "toc: | depth: 2\nsection: Intro\nsub: Overview\nnote: text\nsection: End";
    const doc = parseIntentText(input);
    const html = renderHTML(doc);
    expect(html).toContain("Overview");
    expect(html).toContain('class="it-toc-sub"');
  });

  it("multiple footnote refs link to correct footnotes", () => {
    const doc = parseIntentText(
      "note: A[^1] and B[^2]\nfootnote: 1 | text: Note one\nfootnote: 2 | text: Note two",
    );
    const html = renderHTML(doc);
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('href="#fn-2"');
    expect(html).toContain("Note one");
    expect(html).toContain("Note two");
  });
});
