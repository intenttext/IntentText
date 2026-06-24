/**
 * DOCX → IntentText converter (Node.js + browser; pure JS).
 *
 * A .docx is OOXML: a ZIP of XML parts. We unzip with fflate and walk
 * word/document.xml's body children IN ORDER: `<w:p>` paragraphs and
 * `<w:tbl>` tables.
 *
 *   - paragraph style (w:pStyle):
 *       Title           → title:
 *       Heading1        → section:
 *       Heading2/3/4…   → sub:
 *       (default)       → text:
 *   - list paragraphs (w:numPr): bullet → "- ", numbered → "N. "
 *   - tables (w:tbl): each w:tr → a `| Cell | Cell |` row, first row header.
 *
 * Bold/italic runs map to *bold* / _italic_ inline emphasis (matching the
 * markdown/html converters' convention).
 */

import {
  unzip,
  partText,
  findElements,
  attr,
  decodeXmlEntities,
} from "./ooxml-util";

export interface DocxToItOptions {
  /** Override the document title. */
  title?: string;
}

/** Extract the text of a single run (<w:r>), honoring tabs/breaks/spaces. */
function runText(runInner: string): string {
  let text = "";
  // Walk the run's children in order: <w:t>, <w:tab/>, <w:br/>, <w:cr/>.
  const re =
    /<(?:[a-z0-9]+:)?t(\s[^>]*)?>([\s\S]*?)<\/(?:[a-z0-9]+:)?t>|<(?:[a-z0-9]+:)?(tab|br|cr)\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runInner)) !== null) {
    if (m[2] !== undefined) {
      text += decodeXmlEntities(m[2]);
    } else if (m[3]) {
      const tag = m[3].toLowerCase();
      if (tag === "tab") text += "\t";
      else text += " "; // br/cr → space (single-line .it content)
    }
  }
  return text;
}

/** Concatenate a paragraph's runs, applying bold/italic emphasis. */
function paragraphText(pInner: string): string {
  let result = "";
  for (const r of findElements(pInner, "r")) {
    const raw = runText(r.inner);
    if (!raw) continue;
    // run properties live in <w:rPr> at the start of the run
    const rPr = findElements(r.inner, "rPr")[0];
    let bold = false;
    let italic = false;
    let strike = false;
    if (rPr) {
      const on = (tag: string): boolean => {
        const el = findElements(rPr.inner, tag)[0];
        return !!el && attr(el.open, "val") !== "false" && attr(el.open, "val") !== "0";
      };
      bold = on("b");
      italic = on("i");
      strike = on("strike");
    }
    let piece = raw;
    // Map to a .it inline mark (one per run; bold > italic > strike). `.it` marks
    // don't nest, so a run with multiple is rendered with its dominant mark. (G-17)
    if (bold && piece.trim()) piece = `*${piece.trim()}*`;
    else if (italic && piece.trim()) piece = `_${piece.trim()}_`;
    else if (strike && piece.trim()) piece = `~${piece.trim()}~`;
    result += piece;
  }
  return result;
}

/** Escape pipe characters inside .it content/cells. */
function escapeIt(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

interface ParaInfo {
  style: string;
  isList: boolean;
  ordered: boolean;
}

function paragraphInfo(pInner: string): ParaInfo {
  const pPr = findElements(pInner, "pPr")[0];
  let style = "";
  let isList = false;
  let ordered = false;
  if (pPr) {
    const pStyle = findElements(pPr.inner, "pStyle")[0];
    if (pStyle) style = (attr(pStyle.open, "val") || "").toLowerCase();
    const numPr = findElements(pPr.inner, "numPr")[0];
    if (numPr) {
      isList = true;
      // Heuristic: ListParagraph + numId; we can't resolve numbering.xml
      // bullet-vs-number cheaply, so default to bullets unless the style
      // name hints ordering.
      ordered = /number|ordered|decimal/.test(style);
    }
  }
  return { style, isList, ordered };
}

/** Map a heading style name to an .it keyword, or null for body text. */
function styleToKeyword(style: string): string | null {
  if (!style) return null;
  if (style === "title") return "title";
  if (/^heading\s*1$/.test(style) || style === "heading1") return "section";
  if (/^heading\s*[2-9]$/.test(style) || /^heading[2-9]$/.test(style))
    return "sub";
  return null;
}

/**
 * Get a table cell's text (its paragraphs joined by a space). Cell text is
 * read PLAIN (no bold/italic markers) so tables round-trip cleanly — a
 * bold header cell should come back as the literal header value.
 */
function cellText(tcInner: string): string {
  const paras = findElements(tcInner, "p").map((p) =>
    runsPlain(p.inner),
  );
  return paras.filter((t) => t.trim() !== "").join(" ").trim();
}

/** Concatenate a paragraph's runs as plain text (no emphasis markers). */
function runsPlain(pInner: string): string {
  let result = "";
  for (const r of findElements(pInner, "r")) result += runText(r.inner);
  return result;
}

/**
 * Convert DOCX bytes to IntentText source.
 */
export function convertDocxToIntentText(
  data: Uint8Array | Buffer,
  opts: DocxToItOptions = {},
): string {
  const parts = unzip(data);
  const xml = partText(parts, "word/document.xml");
  const out: string[] = [];

  if (opts.title) {
    out.push(`title: ${escapeIt(opts.title)}`);
  }
  out.push("meta: | type: document");
  out.push("");

  // Get the body inner content, then walk its top-level <w:p> and <w:tbl>.
  const body = findElements(xml, "body")[0];
  const bodyXml = body ? body.inner : xml;

  // Walk paragraphs and tables in document order. We find both and sort by
  // their start offset.
  const tblEls = findElements(bodyXml, "tbl");
  const tblSpans = tblEls.map((e) => ({ start: e.start, end: e.end }));
  const insideTable = (pos: number): boolean =>
    tblSpans.some((s) => pos >= s.start && pos < s.end);

  // findElements returns matches at the SAME tag's depth-0 only, so it also
  // returns <w:p> nested inside tables (different tag). Filter those out by
  // position so table paragraphs are handled once, by the table branch.
  const paras = findElements(bodyXml, "p")
    .filter((e) => !insideTable(e.start))
    .map((e) => ({ kind: "p" as const, start: e.start, inner: e.inner }));
  const tbls = tblEls.map((e) => ({
    kind: "tbl" as const,
    start: e.start,
    inner: e.inner,
  }));

  const items = [...paras, ...tbls].sort((a, b) => a.start - b.start);

  let listOrdinal = 0;
  for (const item of items) {
    if (item.kind === "p") {
      const info = paragraphInfo(item.inner);
      const text = paragraphText(item.inner).replace(/\s+$/g, "");
      if (info.isList) {
        if (text.trim() === "") continue;
        if (info.ordered) {
          listOrdinal++;
          out.push(`${listOrdinal}. ${escapeIt(text.trim())}`);
        } else {
          out.push(`- ${escapeIt(text.trim())}`);
        }
        continue;
      }
      listOrdinal = 0;
      const kw = styleToKeyword(info.style);
      if (kw) {
        out.push(`${kw}: ${escapeIt(text.trim())}`);
        out.push("");
      } else if (text.trim() !== "") {
        const t = escapeIt(text.trim());
        // bare prose is the preferred style; force `text:` only when the line would
        // otherwise parse as a keyword (starts with a single `word:` token).
        out.push(/^[\p{L}][\p{L}\d-]*:(\s|$)/u.test(t) ? `text: ${t}` : t);
        out.push("");
      } else {
        out.push("");
      }
    } else {
      // Table
      listOrdinal = 0;
      const rows = findElements(item.inner, "tr");
      const grid: string[][] = [];
      for (const tr of rows) {
        const cells = findElements(tr.inner, "tc").map((tc) =>
          cellText(tc.inner),
        );
        grid.push(cells);
      }
      if (grid.length === 0) continue;
      const width = Math.max(...grid.map((r) => r.length));
      for (const row of grid) {
        const padded = row.slice();
        while (padded.length < width) padded.push("");
        const out2 = padded.map((c) => (c === "" ? " " : escapeIt(c)));
        out.push(`| ${out2.join(" | ")} |`);
      }
      out.push("");
    }
  }

  // Collapse 3+ blank lines and trim trailing blanks.
  const cleaned: string[] = [];
  let blank = 0;
  for (const line of out) {
    if (line === "") {
      blank++;
      if (blank <= 1) cleaned.push("");
    } else {
      blank = 0;
      cleaned.push(line);
    }
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n");
}
