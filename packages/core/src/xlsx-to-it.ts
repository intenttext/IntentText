/**
 * XLSX → IntentText converter (Node.js + browser; pure JS).
 *
 * An .xlsx is OOXML: a ZIP of XML parts. We unzip with fflate and read:
 *   - xl/workbook.xml            → sheet names + order (+ r:id refs)
 *   - xl/_rels/workbook.xml.rels → r:id → worksheet part path map
 *   - xl/sharedStrings.xml       → the <si> shared string table
 *   - xl/worksheets/sheetN.xml   → the cell grid
 *
 * Each sheet becomes a `section:` followed by a `| Cell | Cell |` table
 * (first row = header). Numbers and text are preserved faithfully.
 */

import {
  unzip,
  partText,
  findElements,
  attr,
  decodeXmlEntities,
  ZipParts,
} from "./ooxml-util";

export interface XlsxToItOptions {
  /** Document title (defaults to first sheet name / "Workbook"). */
  title?: string;
}

/** Convert column letters (A, B, ..., Z, AA, ...) to a 0-based index. */
function colToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Split a cell ref like "AB12" into its column letters. */
function refCol(ref: string): string {
  const m = ref.match(/^([A-Za-z]+)/);
  return m ? m[1].toUpperCase() : "A";
}

/** Parse the shared string table: each <si> → its concatenated text. */
function parseSharedStrings(xml: string): string[] {
  if (!xml) return [];
  const out: string[] = [];
  for (const si of findElements(xml, "si")) {
    // <si> may be a single <t> or a sequence of <r><t>…</t></r> runs.
    const texts = findElements(si.inner, "t");
    if (texts.length === 0) {
      out.push("");
    } else {
      out.push(texts.map((t) => decodeXmlEntities(t.inner)).join(""));
    }
  }
  return out;
}

interface CellValue {
  col: number;
  text: string;
}

/** Parse one worksheet's rows into a grid of string cells. */
function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowEls = findElements(xml, "row");
  for (const rowEl of rowEls) {
    const cells: CellValue[] = [];
    for (const c of findElements(rowEl.inner, "c")) {
      const ref = attr(c.open, "r") || "";
      const type = attr(c.open, "t"); // s | inlineStr | str | b | e | (number)
      const col = ref ? colToIndex(refCol(ref)) : cells.length;
      let text = "";
      if (type === "s") {
        // shared string: <v>index</v>
        const v = findElements(c.inner, "v")[0];
        const idx = v ? parseInt(decodeXmlEntities(v.inner).trim(), 10) : NaN;
        text = !isNaN(idx) && shared[idx] !== undefined ? shared[idx] : "";
      } else if (type === "inlineStr") {
        // <is><t>…</t></is>
        const ts = findElements(c.inner, "t");
        text = ts.map((t) => decodeXmlEntities(t.inner)).join("");
      } else if (type === "b") {
        const v = findElements(c.inner, "v")[0];
        text =
          v && decodeXmlEntities(v.inner).trim() === "1" ? "TRUE" : "FALSE";
      } else {
        // number, formula cached value (<f>…</f><v>…</v>), or "str"
        const v = findElements(c.inner, "v")[0];
        text = v ? decodeXmlEntities(v.inner).trim() : "";
      }
      cells.push({ col, text });
    }
    if (cells.length === 0) {
      rows.push([]);
      continue;
    }
    // Reconstruct a dense row, padding gaps from the column refs.
    const maxCol = Math.max(...cells.map((c) => c.col));
    const dense: string[] = new Array(maxCol + 1).fill("");
    for (const cell of cells) dense[cell.col] = cell.text;
    rows.push(dense);
  }
  return rows;
}

/** Map sheet name → worksheet part path via workbook + rels. */
function resolveSheets(
  parts: ZipParts,
): { name: string; path: string }[] {
  const workbook = partText(parts, "xl/workbook.xml");
  const rels = partText(parts, "xl/_rels/workbook.xml.rels");

  // rId → Target
  const relMap: Record<string, string> = {};
  for (const rel of findElements(rels, "Relationship")) {
    const id = attr(rel.open, "Id");
    let target = attr(rel.open, "Target");
    if (id && target) {
      target = target.replace(/^\//, "").replace(/^\.\.\//, "");
      if (!target.startsWith("xl/")) target = "xl/" + target;
      relMap[id] = target;
    }
  }

  const sheets: { name: string; path: string }[] = [];
  for (const sheet of findElements(workbook, "sheet")) {
    const name = attr(sheet.open, "name") || `Sheet${sheets.length + 1}`;
    // r:id (namespace-tolerant: "id" matches r:id)
    const rid = attr(sheet.open, "id");
    let path = rid ? relMap[rid] : undefined;
    if (!path) {
      // Fallback: positional sheetN.xml
      path = `xl/worksheets/sheet${sheets.length + 1}.xml`;
    }
    sheets.push({ name, path });
  }

  // Last-ditch fallback: no workbook info → scan for worksheet parts.
  if (sheets.length === 0) {
    const names = Object.keys(parts)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort();
    names.forEach((p, i) => sheets.push({ name: `Sheet${i + 1}`, path: p }));
  }

  return sheets;
}

/** Emit a `.it` table for a grid; first non-empty row is the header. */
function emitTable(out: string[], grid: string[][]): void {
  // Drop fully-empty leading/trailing rows.
  const rows = grid.filter((r) => r.some((c) => c !== ""));
  if (rows.length === 0) return;
  const width = Math.max(...rows.map((r) => r.length));
  for (const row of rows) {
    const padded = row.slice();
    while (padded.length < width) padded.push("");
    // Empty cells use a single space so `| |` keeps the column count.
    const cells = padded.map((c) => (c === "" ? " " : escapeCell(c)));
    out.push(`| ${cells.join(" | ")} |`);
  }
}

/** Escape pipe characters inside a cell (reserved as the .it delimiter). */
function escapeCell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

/** Sanitize a name for use as a `section:` heading. */
function sectionName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").trim() || "Sheet";
}

/**
 * Convert XLSX bytes to IntentText source.
 */
export function convertXlsxToIntentText(
  data: Uint8Array | Buffer,
  opts: XlsxToItOptions = {},
): string {
  const parts = unzip(data);
  const shared = parseSharedStrings(partText(parts, "xl/sharedStrings.xml"));
  const sheets = resolveSheets(parts);

  const out: string[] = [];
  const title = opts.title || sheets[0]?.name || "Workbook";
  out.push(`title: ${escapeCell(sectionName(title))}`);
  out.push("meta: | type: spreadsheet");
  out.push("");

  for (const sheet of sheets) {
    const xml = partText(parts, sheet.path);
    const grid = xml ? parseSheet(xml, shared) : [];
    out.push(`section: ${escapeCell(sectionName(sheet.name))}`);
    if (grid.length === 0 || grid.every((r) => r.every((c) => c === ""))) {
      out.push("text: (empty sheet)");
    } else {
      emitTable(out, grid);
    }
    out.push("");
  }

  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}
