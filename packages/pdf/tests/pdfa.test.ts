import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import { toPdfA } from "../src/pdfa";

/** A minimal one-page PDF made with pdf-lib (no Chrome needed for the structural test). */
async function minimalPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.setTitle("Invoice INV-1");
  return doc.save();
}

/** A fake "ICC" payload — toPdfA only embeds the bytes; veraPDF (CI) checks validity. */
const fakeIcc = new Uint8Array(512).fill(7);

describe("PDF/A pass (structure — full compliance is veraPDF's job in CI)", () => {
  it("requires an ICC profile (OutputIntent) unless allowNoIcc", async () => {
    await expect(toPdfA(await minimalPdf())).rejects.toThrow(/ICC|OutputIntent/i);
  });

  it("embeds XMP (PDF/A id), an OutputIntent, and a document ID", async () => {
    const out = await toPdfA(await minimalPdf(), {
      iccProfile: fakeIcc,
      conformance: "3B",
      author: "Jadwal",
    });
    const reloaded = await PDFDocument.load(out);
    const catalog = reloaded.catalog;

    // XMP metadata present + carries the PDF/A identification
    expect(catalog.get(PDFName.of("Metadata"))).toBeTruthy();
    const text = Buffer.from(out).toString("latin1");
    expect(text).toContain("pdfaid:part>3");
    expect(text).toContain("pdfaid:conformance>B");

    // OutputIntent present
    expect(catalog.get(PDFName.of("OutputIntents"))).toBeTruthy();
    expect(text).toContain("sRGB IEC61966-2.1");

    // a document ID exists
    expect(reloaded.context.trailerInfo.ID).toBeTruthy();
  });

  it("allowNoIcc emits XMP+ID only (explicitly non-compliant)", async () => {
    const out = await toPdfA(await minimalPdf(), { allowNoIcc: true });
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.catalog.get(PDFName.of("Metadata"))).toBeTruthy();
    expect(reloaded.catalog.get(PDFName.of("OutputIntents"))).toBeFalsy();
  });

  it("the same input yields a stable document ID (deterministic)", async () => {
    const a = await toPdfA(await minimalPdf(), { iccProfile: fakeIcc });
    const b = await toPdfA(await minimalPdf(), { iccProfile: fakeIcc });
    const idA = (await PDFDocument.load(a)).context.trailerInfo.ID?.toString();
    const idB = (await PDFDocument.load(b)).context.trailerInfo.ID?.toString();
    expect(idA).toBe(idB);
  });

  // G-07: every property shared by the Info dict and XMP must MATCH, or veraPDF flags
  // a metadata-consistency error. Producer / CreatorTool / dates were previously in
  // Info but missing from XMP.
  it("keeps Info and XMP metadata consistent (Producer / CreatorTool / dates / title)", async () => {
    const when = new Date("2026-06-19T10:00:00Z");
    const out = await toPdfA(await minimalPdf(), {
      iccProfile: fakeIcc,
      title: "Invoice INV-1",
      author: "Jadwal",
      date: when,
    });

    // Info dictionary (via pdf-lib getters)
    const reloaded = await PDFDocument.load(out, { updateMetadata: false });
    expect(reloaded.getProducer()).toBe("IntentText (@dotit/pdf)");
    expect(reloaded.getCreator()).toBe("IntentText (@dotit/pdf)");
    expect(reloaded.getTitle()).toBe("Invoice INV-1");
    expect(reloaded.getAuthor()).toBe("Jadwal");
    expect(reloaded.getCreationDate()?.toISOString()).toBe("2026-06-19T10:00:00.000Z");
    expect(reloaded.getModificationDate()?.toISOString()).toBe("2026-06-19T10:00:00.000Z");

    // XMP (uncompressed plain XML in the bytes) carries the SAME values
    const xmp = Buffer.from(out).toString("latin1");
    expect(xmp).toContain("<pdf:Producer>IntentText (@dotit/pdf)</pdf:Producer>");
    expect(xmp).toContain("<xmp:CreatorTool>IntentText (@dotit/pdf)</xmp:CreatorTool>");
    expect(xmp).toContain("<xmp:CreateDate>2026-06-19T10:00:00Z</xmp:CreateDate>");
    expect(xmp).toContain("<xmp:ModifyDate>2026-06-19T10:00:00Z</xmp:ModifyDate>");
    expect(xmp).toContain('xmlns:pdf="http://ns.adobe.com/pdf/1.3/"');
    expect(xmp).toContain("Invoice INV-1"); // dc:title
  });
});
