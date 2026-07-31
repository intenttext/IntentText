import { describe, it, expect } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { convertXlsxToIntentText } from "../src/xlsx-to-it";
import { convertIntentTextToXlsx } from "../src/it-to-xlsx";
import { convertDocxToIntentText } from "../src/docx-to-it";
import { convertIntentTextToDocx } from "../src/it-to-docx";
import { parseIntentText } from "../src/parser";
import { validateDocumentSemantic } from "../src/validate";

describe("OOXML converters — XLSX", () => {
  const itTable = `section: Sales
| Product | Qty | Price |
| Widget | 10 | 5.50 |
| Gadget | 3 | 12 |`;

  it("round-trips an .it table through xlsx and back", () => {
    const xlsx = convertIntentTextToXlsx(itTable);
    const back = convertXlsxToIntentText(xlsx);
    expect(back).toContain("| Product | Qty | Price |");
    expect(back).toContain("| Widget | 10 | 5.50 |");
    expect(back).toContain("| Gadget | 3 | 12 |");
    expect(back).toContain("section: Sales");
    expect(back).toContain("meta: | type: spreadsheet");
  });

  it("preserves numbers as numeric cells (not strings)", () => {
    const xlsx = convertIntentTextToXlsx(itTable);
    const parts = unzipSync(xlsx);
    const sheet = strFromU8(parts["xl/worksheets/sheet1.xml"]);
    // "10" should be a bare numeric <v>, no t="s"
    expect(sheet).toMatch(/<c r="B2"><v>10<\/v><\/c>/);
    // "Widget" should be a shared string (t="s")
    expect(sheet).toMatch(/<c r="A2" t="s">/);
  });

  it("generated xlsx has well-formed OOXML parts", () => {
    const xlsx = convertIntentTextToXlsx(itTable);
    const parts = unzipSync(xlsx);
    const names = Object.keys(parts);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("_rels/.rels");
    expect(names).toContain("xl/workbook.xml");
    expect(names).toContain("xl/_rels/workbook.xml.rels");
    expect(names).toContain("xl/sharedStrings.xml");
    expect(names).toContain("xl/styles.xml");
    expect(names).toContain("xl/worksheets/sheet1.xml");
    // Content types valid XML declaration
    expect(strFromU8(parts["[Content_Types].xml"])).toContain("<Types");
  });

  it("multiple sections produce multiple worksheets", () => {
    const src = `section: A
| x | y |
| 1 | 2 |
section: B
| p | q |
| 3 | 4 |`;
    const xlsx = convertIntentTextToXlsx(src, { includeMetrics: false });
    const parts = unzipSync(xlsx);
    expect(parts["xl/worksheets/sheet1.xml"]).toBeDefined();
    expect(parts["xl/worksheets/sheet2.xml"]).toBeDefined();
    const back = convertXlsxToIntentText(xlsx);
    expect(back).toContain("section: A");
    expect(back).toContain("section: B");
  });

  it("round-tripped .it parses and validates with no errors", () => {
    const xlsx = convertIntentTextToXlsx(itTable);
    const back = convertXlsxToIntentText(xlsx);
    const doc = parseIntentText(back);
    const result = validateDocumentSemantic(doc);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("handles ragged rows by padding", () => {
    const src = `section: Ragged
| a | b | c |
| 1 |
| 7 | 8 | 9 |`;
    const xlsx = convertIntentTextToXlsx(src, { includeMetrics: false });
    const back = convertXlsxToIntentText(xlsx);
    const doc = parseIntentText(back);
    const errors = validateDocumentSemantic(doc).issues.filter(
      (i) => i.severity === "error",
    );
    expect(errors).toHaveLength(0);
    expect(back).toContain("| a | b | c |");
  });
});

describe("OOXML converters — DOCX", () => {
  const itDoc = `title: Report
section: Intro
text: Hello world.
- one
- two
section: Data
| A | B |
| 1 | 2 |`;

  it("round-trips text and a table through docx and back", () => {
    const docx = convertIntentTextToDocx(itDoc);
    const back = convertDocxToIntentText(docx);
    expect(back).toContain("title: Report");
    expect(back).toContain("section: Intro");
    expect(back).toContain("Hello world."); // bare prose (preferred style)
    expect(back).toContain("- one");
    expect(back).toContain("- two");
    expect(back).toContain("section: Data");
    expect(back).toContain("| A | B |");
    expect(back).toContain("| 1 | 2 |");
    expect(back).toContain("meta: | type: document");
  });

  it("does not duplicate list-item or table-cell text", () => {
    const docx = convertIntentTextToDocx(itDoc);
    const back = convertDocxToIntentText(docx);
    // "one" must appear exactly once as a list line, never as `text: one`
    expect(back).not.toContain("text: one");
    expect(back).not.toContain("text: A");
    expect(back).not.toContain("text: 1");
  });

  it("generated docx has well-formed OOXML parts", () => {
    const docx = convertIntentTextToDocx(itDoc);
    const parts = unzipSync(docx);
    const names = Object.keys(parts);
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("_rels/.rels");
    expect(names).toContain("word/document.xml");
    expect(names).toContain("word/_rels/document.xml.rels");
    expect(names).toContain("word/styles.xml");
    expect(names).toContain("word/numbering.xml");
    const doc = strFromU8(parts["word/document.xml"]);
    expect(doc).toContain("<w:document");
    expect(doc).toContain("<w:body>");
  });

  it("round-tripped .it parses and validates with no errors", () => {
    const docx = convertIntentTextToDocx(itDoc);
    const back = convertDocxToIntentText(docx);
    const doc = parseIntentText(back);
    const errors = validateDocumentSemantic(doc).issues.filter(
      (i) => i.severity === "error",
    );
    expect(errors).toHaveLength(0);
  });

  it("maps heading styles correctly (Heading1 -> section)", () => {
    const docx = convertIntentTextToDocx("section: My Section\ntext: body");
    const parts = unzipSync(docx);
    const doc = strFromU8(parts["word/document.xml"]);
    expect(doc).toContain('w:pStyle w:val="Heading1"');
    const back = convertDocxToIntentText(docx);
    expect(back).toContain("section: My Section");
  });
});

describe("OOXML converters — DOCX document fidelity", () => {
  const twoSided =
    "text: Reference | end: A-1\ntext: Offer ref | end: B-2\ntext: Third | end: C-3";

  it("keeps every value of consecutive two-ended lines (they merge into one block)", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx(twoSided))["word/document.xml"],
    );
    // Before renderableParts the labels ran together and only A-1 survived.
    for (const v of ["Reference", "A-1", "Offer ref", "B-2", "Third", "C-3"])
      expect(xml).toContain(v);
  });

  it("emits a table grid — without it every column after the first is dropped", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx("| A | B | C |\n| 1 | 2 | 3 |"))[
        "word/document.xml"
      ],
    );
    expect(xml).toContain("<w:tblGrid>");
    expect((xml.match(/<w:gridCol /g) || []).length).toBe(3);
  });

  it("marks an Arabic document right-to-left, paragraph and run", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx("قسم: الأطراف\nنص: هذا عقد بين الطرفين."))[
        "word/document.xml"
      ],
    );
    expect(xml).toContain("<w:bidi/>");
    expect(xml).toContain("<w:rtl/>");
    expect(xml).toContain('<w:jc w:val="right"/>');
  });

  it("keeps an English paragraph left-to-right inside an Arabic document", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx("قسم: الأطراف\ntext: Emad Jumaah — Software Manager"))[
        "word/document.xml"
      ],
    );
    expect(xml).toContain('<w:jc w:val="left"/>');
  });

  it("turns {{page}} into a live field in the running footer", () => {
    const parts = unzipSync(
      convertIntentTextToDocx("footer: page {{page}} of {{pages}}\ntext: body"),
    );
    const ftr = strFromU8(parts["word/footer1.xml"]);
    expect(ftr).toContain("PAGE");
    expect(ftr).toContain("NUMPAGES");
    expect(strFromU8(parts["word/document.xml"])).toContain("footerReference");
  });

  it("honours the page: block for size and margins", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx("page: | size: A4 | margin: 18mm\ntext: body"))[
        "word/document.xml"
      ],
    );
    expect(xml).toContain('w:w="11906"'); // A4 width in twips
    expect(xml).toContain('w:top="1020"'); // 18mm
  });

  it("embeds an image only when the caller can resolve its bytes", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68,
      82, 0, 0, 0, 64, 0, 0, 0, 32,
    ]);
    const src = "image: Logo | src: logo.png";
    expect(Object.keys(unzipSync(convertIntentTextToDocx(src)))).not.toContain(
      "word/media/image1.png",
    );
    const withImage = unzipSync(
      convertIntentTextToDocx(src, { resolveImage: () => ({ bytes: png }) }),
    );
    expect(Object.keys(withImage)).toContain("word/media/image1.png");
    expect(strFromU8(withImage["word/document.xml"])).toContain("<w:drawing>");
  });
});

describe("OOXML converters — DOCX inline emphasis (G-17)", () => {
  it("it->docx encodes *bold* / _italic_ / ~strike~ as real runs", () => {
    const docx = convertIntentTextToDocx(
      "text: The *bold* and _italic_ and ~struck~ words.",
    );
    const xml = strFromU8(unzipSync(docx)["word/document.xml"]);
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("<w:strike/>");
    // the emphasized words are split into their own runs (not one flat run)
    expect(xml).toContain("<w:t xml:space=\"preserve\">bold</w:t>");
  });

  it("round-trips bold/italic/strike emphasis through docx and back", () => {
    const src = "text: A *bold* word, an _italic_ word, a ~struck~ word.";
    const back = convertDocxToIntentText(convertIntentTextToDocx(src));
    expect(back).toContain("*bold*");
    expect(back).toContain("_italic_");
    expect(back).toContain("~struck~");
  });

  it("plain text (no marks) stays a single clean run", () => {
    const xml = strFromU8(
      unzipSync(convertIntentTextToDocx("text: plain words here"))[
        "word/document.xml"
      ],
    );
    expect(xml).not.toContain("<w:b/>");
    expect(xml).not.toContain("<w:strike/>");
    expect(xml).toContain("plain words here");
  });
});
