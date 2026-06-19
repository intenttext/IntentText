/**
 * IntentText → DOCX converter (Node.js + browser; pure JS).
 *
 * Parses `.it` source and emits a minimal, spec-valid OOXML .docx (zipped
 * with fflate) that opens in Word / LibreOffice without a repair prompt.
 *
 * Block mapping:
 *   title:               → Title-styled paragraph
 *   section:             → Heading1
 *   sub:                 → Heading2
 *   text:/quote:/info:…  → Normal paragraph
 *   list-item (- …)      → bulleted paragraph (ListBullet style)
 *   step-item (1. …)     → numbered paragraph (ListNumber style)
 *   table                → <w:tbl>, first row bold (header)
 */

import { parseIntentText } from "./parser";
import { escapeXml, zip } from "./ooxml-util";
import { IntentBlock, IntentDocument } from "./types";

export interface ItToDocxOptions {
  /** Reserved for future options (styling, page size). */
  _reserved?: never;
}

/**
 * Build the runs XML for a paragraph, honoring `.it` inline emphasis so it survives
 * the round-trip (G-17): `*bold*` → <w:b/>, `_italic_` → <w:i/>, `~strike~` →
 * <w:strike/>, `` `code` `` → a monospace run. `bold` forces bold across the whole
 * paragraph (headings / table-header cells). Marks are treated as non-nesting (as in
 * `.it`); an unmatched mark stays literal.
 */
function runsXml(text: string, bold = false): string {
  const emit = (
    s: string,
    f: { b?: boolean; i?: boolean; strike?: boolean; code?: boolean },
  ): string => {
    if (s === "") return "";
    const props: string[] = [];
    if (bold || f.b) props.push("<w:b/>");
    if (f.i) props.push("<w:i/>");
    if (f.strike) props.push("<w:strike/>");
    if (f.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
    const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
    return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(s)}</w:t></w:r>`;
  };

  const re = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out += emit(text.slice(last, m.index), {});
    const tok = m[0];
    const inner = tok.slice(1, -1);
    if (tok[0] === "*") out += emit(inner, { b: true });
    else if (tok[0] === "_") out += emit(inner, { i: true });
    else if (tok[0] === "~") out += emit(inner, { strike: true });
    else out += emit(inner, { code: true });
    last = re.lastIndex;
  }
  if (last < text.length) out += emit(text.slice(last), {});
  return out || emit("", {}) || `<w:r><w:t xml:space="preserve"></w:t></w:r>`;
}

function paragraphXml(text: string, style?: string, bold = false): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}${runsXml(text, bold)}</w:p>`;
}

function listParagraphXml(text: string, ordered: boolean): string {
  const style = ordered ? "ListNumber" : "ListBullet";
  const numId = ordered ? 2 : 1;
  const pPr = `<w:pPr><w:pStyle w:val="${style}"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>`;
  return `<w:p>${pPr}${runsXml(text)}</w:p>`;
}

function tableXml(headers: string[], rows: string[][]): string {
  const allRows: { cells: string[]; header: boolean }[] = [];
  if (headers && headers.length > 0)
    allRows.push({ cells: headers, header: true });
  for (const r of rows) allRows.push({ cells: r, header: false });
  if (allRows.length === 0) return "";
  const width = Math.max(...allRows.map((r) => r.cells.length));

  const trXml = allRows
    .map((row) => {
      const cells: string[] = [];
      for (let i = 0; i < width; i++) {
        const text = row.cells[i] ?? "";
        cells.push(
          `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraphXml(text, undefined, row.header)}</w:tc>`,
        );
      }
      return `<w:tr>${cells.join("")}</w:tr>`;
    })
    .join("");

  const tblPr =
    "<w:tblPr><w:tblStyle w:val=\"TableGrid\"/><w:tblW w:w=\"0\" w:type=\"auto\"/>" +
    "<w:tblBorders>" +
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>' +
    "</w:tblBorders></w:tblPr>";
  return `<w:tbl>${tblPr}${trXml}</w:tbl>`;
}

/**
 * Reconstruct the inline-marker text (`*bold*` / `_italic_` / `~strike~` / `` `code` ``)
 * from a block's parsed inline nodes, so runsXml can re-encode emphasis as docx runs
 * (G-17). `block.content` has the marks stripped; the marks live in `block.inline`.
 * Falls back to plain content when there are no inline nodes.
 */
function inlineMarkers(block: IntentBlock): string {
  const nodes = block.inline;
  if (!nodes || nodes.length === 0) return block.content || "";
  let out = "";
  for (const n of nodes) {
    const v =
      (n as { value?: string }).value ??
      (n as { content?: string }).content ??
      "";
    switch (n.type) {
      case "bold":
        out += `*${v}*`;
        break;
      case "italic":
        out += `_${v}_`;
        break;
      case "strike":
        out += `~${v}~`;
        break;
      case "code":
        out += `\`${v}\``;
        break;
      default:
        out += v;
        break;
    }
  }
  return out || block.content || "";
}

/** Walk the doc tree, emitting body XML in order. */
function buildBody(doc: IntentDocument): string {
  const body: string[] = [];

  function walk(blocks: IntentBlock[]): void {
    for (const block of blocks) {
      switch (block.type) {
        case "title":
          body.push(paragraphXml(inlineMarkers(block), "Title"));
          break;
        case "section":
          body.push(paragraphXml(inlineMarkers(block), "Heading1"));
          break;
        case "sub":
          body.push(paragraphXml(inlineMarkers(block), "Heading2"));
          break;
        case "summary":
          body.push(paragraphXml(inlineMarkers(block), "Subtitle"));
          break;
        case "list-item":
          body.push(listParagraphXml(inlineMarkers(block), false));
          break;
        case "step-item":
          body.push(listParagraphXml(inlineMarkers(block), true));
          break;
        case "table":
          if (block.table)
            body.push(
              tableXml(block.table.headers || [], block.table.rows || []),
            );
          break;
        case "metric": {
          const value =
            (block.properties &&
              (block.properties as Record<string, string>).value) ||
            "";
          body.push(
            paragraphXml(
              value ? `${block.content}: ${value}` : block.content || "",
            ),
          );
          break;
        }
        case "divider":
          body.push(
            '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>',
          );
          break;
        case "meta":
        case "page":
        case "header":
        case "footer":
        case "watermark":
        case "style":
          // metadata / layout — skipped in the document body
          break;
        default: {
          const content = inlineMarkers(block);
          if (content.trim() !== "") body.push(paragraphXml(content));
          break;
        }
      }
      // Only structural headings hold real nested content. Leaf blocks like
      // list-item/text carry a mirror `text` child of their own content —
      // recursing into those would duplicate the text.
      if (
        (block.type === "section" ||
          block.type === "sub" ||
          block.type === "title") &&
        block.children &&
        block.children.length > 0
      ) {
        walk(block.children);
      }
    }
  }

  walk(doc.blocks);
  if (body.length === 0) body.push(paragraphXml(""));
  return body.join("");
}

/**
 * Convert IntentText source to a DOCX byte array.
 */
export function convertIntentTextToDocx(
  source: string,
  _opts: ItToDocxOptions = {},
): Uint8Array {
  const doc = parseIntentText(source);
  const bodyXml = buildBody(doc);

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>` +
    "</w:document>";

  // Minimal styles defining Title/Heading1/2/Subtitle + list styles.
  const heading = (id: string, name: string, sz: string, outline: string) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${outline}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="52"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:i/><w:sz w:val="28"/></w:rPr></w:style>' +
    heading("Heading1", "heading 1", "36", "0") +
    heading("Heading2", "heading 2", "30", "1") +
    heading("Heading3", "heading 3", "26", "2") +
    '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
    "</w:styles>";

  // Numbering: one bullet list (numId 1), one decimal list (numId 2).
  const numberingXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
    '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
    "</w:numbering>";

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    "</Types>";

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const documentRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
    "</Relationships>";

  return zip({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRels,
    "word/document.xml": documentXml,
    "word/_rels/document.xml.rels": documentRels,
    "word/styles.xml": stylesXml,
    "word/numbering.xml": numberingXml,
  });
}
