/**
 * IntentText → XLSX converter (Node.js + browser; pure JS).
 *
 * Parses the `.it` source, collects every table block, and emits ONE
 * worksheet per table (name from the nearest preceding section/sub heading,
 * sanitized + made unique). Optionally a "KPI" sheet of `metric:` rows.
 *
 * Output is a minimal but spec-valid OOXML xlsx (zipped with fflate) that
 * opens in Excel / LibreOffice without a repair prompt. Numeric-looking
 * cells are written as numbers (t omitted); everything else as shared strings.
 */

import { parseIntentText } from "./parser";
import { escapeXml, zip } from "./ooxml-util";
import { IntentBlock, IntentDocument } from "./types";

export interface ItToXlsxOptions {
  /** Include a KPI sheet built from top-level metric: blocks (default true). */
  includeMetrics?: boolean;
}

interface SheetData {
  name: string;
  rows: string[][];
}

/** A value is "numeric" for Excel if it parses cleanly as a plain number. */
function isNumeric(text: string): boolean {
  if (text === "" || text == null) return false;
  // Strip thousands separators only if the result is a clean number.
  const stripped = text.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(stripped)) return false;
  return isFinite(Number(stripped));
}

function numericValue(text: string): string {
  return text.replace(/,/g, "");
}

/** Sanitize a sheet name for the 31-char / forbidden-char Excel rules. */
function sanitizeSheetName(name: string, used: Set<string>): string {
  let n = (name || "Sheet")
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  if (!n) n = "Sheet";
  let candidate = n;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${i})`;
    candidate = n.slice(0, 31 - suffix.length) + suffix;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Walk the document tree, collecting tables (+ heading context) and metrics. */
function collectSheets(
  doc: IntentDocument,
  includeMetrics: boolean,
): SheetData[] {
  const used = new Set<string>();
  const sheets: SheetData[] = [];
  const metrics: string[][] = [];

  function walk(blocks: IntentBlock[], heading: string): void {
    let currentHeading = heading;
    for (const block of blocks) {
      if (block.type === "section" || block.type === "sub") {
        currentHeading = block.content || currentHeading;
      }
      if (block.type === "table" && block.table) {
        const rows: string[][] = [];
        if (block.table.headers && block.table.headers.length > 0) {
          rows.push(block.table.headers);
        }
        for (const r of block.table.rows || []) rows.push(r);
        if (rows.length > 0) {
          sheets.push({
            name: sanitizeSheetName(currentHeading || "Sheet", used),
            rows,
          });
        }
      }
      if (block.type === "metric" && includeMetrics) {
        const label = block.content || "";
        const value =
          (block.properties && (block.properties as Record<string, string>).value) ||
          "";
        metrics.push([label, value]);
      }
      if (block.children && block.children.length > 0) {
        walk(block.children, currentHeading);
      }
    }
  }

  walk(doc.blocks, "");

  if (includeMetrics && metrics.length > 0) {
    sheets.unshift({
      name: sanitizeSheetName("KPIs", used),
      rows: [["Metric", "Value"], ...metrics],
    });
  }

  if (sheets.length === 0) {
    sheets.push({ name: sanitizeSheetName("Sheet1", used), rows: [[""]] });
  }
  return sheets;
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Build worksheet XML for one sheet, given the shared-string interner. */
function buildSheetXml(
  rows: string[][],
  intern: (s: string) => number,
): string {
  const rowXml: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells: string[] = [];
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const value = row[c] ?? "";
      const ref = `${colLetter(c)}${r + 1}`;
      if (value === "") continue; // omit empty cells
      if (isNumeric(value)) {
        cells.push(`<c r="${ref}"><v>${numericValue(value)}</v></c>`);
      } else {
        const idx = intern(value);
        cells.push(`<c r="${ref}" t="s"><v>${idx}</v></c>`);
      }
    }
    rowXml.push(`<row r="${r + 1}">${cells.join("")}</row>`);
  }
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rowXml.join("")}</sheetData>` +
    "</worksheet>"
  );
}

/**
 * Convert IntentText source to an XLSX byte array.
 */
export function convertIntentTextToXlsx(
  source: string,
  opts: ItToXlsxOptions = {},
): Uint8Array {
  const doc = parseIntentText(source);
  const includeMetrics = opts.includeMetrics !== false;
  const sheets = collectSheets(doc, includeMetrics);

  // Shared string table (deduplicated, insertion-ordered).
  const stringTable: string[] = [];
  const stringIndex = new Map<string, number>();
  const intern = (s: string): number => {
    const existing = stringIndex.get(s);
    if (existing !== undefined) return existing;
    const idx = stringTable.length;
    stringIndex.set(s, idx);
    stringTable.push(s);
    return idx;
  };

  const sheetXmls: string[] = sheets.map((s) =>
    buildSheetXml(s.rows, intern),
  );

  // sharedStrings.xml
  let totalCount = 0;
  for (const s of sheets)
    for (const row of s.rows)
      for (const cell of row)
        if (cell !== "" && !isNumeric(cell)) totalCount++;
  const sst =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalCount}" uniqueCount="${stringTable.length}">` +
    stringTable
      .map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`)
      .join("") +
    "</sst>";

  // workbook.xml
  const sheetEls = sheets
    .map(
      (s, i) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheetEls}</sheets></workbook>`;

  // xl/_rels/workbook.xml.rels — sheets then sharedStrings + styles
  const sheetRels = sheets
    .map(
      (_s, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("");
  const sssRelId = sheets.length + 1;
  const stylesRelId = sheets.length + 2;
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRels +
    `<Relationship Id="rId${sssRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>` +
    `<Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>";

  // Minimal styles.xml
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    "</styleSheet>";

  // [Content_Types].xml
  const sheetOverrides = sheets
    .map(
      (_s, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheetOverrides +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    "</Types>";

  // _rels/.rels
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    "</Relationships>";

  const parts: Record<string, string> = {
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRels,
    "xl/workbook.xml": workbook,
    "xl/_rels/workbook.xml.rels": workbookRels,
    "xl/sharedStrings.xml": sst,
    "xl/styles.xml": styles,
  };
  sheetXmls.forEach((xml, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = xml;
  });

  return zip(parts);
}
