import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { convertXlsxToIntentText } from "../src/xlsx-to-it";

// #55: XLSX date cells store an Excel SERIAL number in <v> (e.g. 45000). Reading it raw
// put "45000" in the .it instead of the date. The converter now reads xl/styles.xml and
// converts serials in date-formatted cells to ISO.

// A minimal XLSX where A1 is date-styled (numFmtId 14) and B1 is a plain number — both
// hold the same serial, so only A1 should become a date.
function xlsxWithSerial(serial: string): Uint8Array {
  const p: Record<string, Uint8Array> = {};
  const put = (n: string, x: string) => (p[n] = strToU8(x));
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  put(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
  );
  put(
    "_rels/.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  put(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dates" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  put(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  // cellXfs[0] = general (numFmtId 0), cellXfs[1] = built-in date (numFmtId 14).
  put(
    "xl/styles.xml",
    `<?xml version="1.0"?><styleSheet ${NS}><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
  );
  put(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0"?><worksheet ${NS}><sheetData><row r="1"><c r="A1" s="1"><v>${serial}</v></c><c r="B1" s="0"><v>${serial}</v></c></row></sheetData></worksheet>`,
  );
  return zipSync(p);
}

describe("#55: XLSX date cells become ISO dates, not serial numbers", () => {
  it("converts a date-styled serial to an ISO date; leaves a plain number raw", () => {
    const it = convertXlsxToIntentText(xlsxWithSerial("45000")); // 45000 = 2023-03-15
    expect(it).toContain("2023-03-15"); // A1 (date style) → ISO
    expect(it).toContain("45000"); // B1 (plain) → untouched serial
  });

  it("handles the epoch correctly across dates", () => {
    // serial 1 = 1900-01-01; serial 44197 = 2021-01-01 (past the 1900 leap-bug boundary).
    expect(convertXlsxToIntentText(xlsxWithSerial("44197"))).toContain("2021-01-01");
  });
});
