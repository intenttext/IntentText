/**
 * pdfa.ts — turn a rendered PDF into a PDF/A archival PDF.
 *
 * PDF/A (ISO 19005) is the archival standard auditors check for. Conformance has
 * several requirements; this pass adds the ones that are post-processing concerns:
 *   • an XMP metadata stream carrying the PDF/A identification (pdfaid:part /
 *     pdfaid:conformance), consistent with the document info;
 *   • an OutputIntent with an embedded ICC colour profile (sRGB) — REQUIRED for a
 *     device-independent colour, so it must be supplied (PDF/A can't be claimed
 *     without it);
 *   • a stable document /ID.
 *
 * The OTHER requirements depend on how the PDF was PRODUCED, not on this pass:
 *   • No transparency / JS / encryption — our render path already avoids these.
 *   • ALL fonts embedded — this is the one KNOWN gap for a green veraPDF run (G-07):
 *     the default print CSS uses system families (Georgia/Times/…) that Chrome may
 *     reference WITHOUT embedding on a headless Linux CI box, which PDF/A forbids. The
 *     fix lives in the render path, not here: serve an `@font-face` web font (a subset
 *     of an open font like Noto/Liberation) as the body family so Chrome embeds a
 *     subset. Until that lands AND `.github/workflows/pdfa-verify.yml` is green, treat
 *     the output as **PDF/A-oriented**, not certified — the docs say exactly that.
 * This pass DOES guarantee the metadata is internally consistent (Info ↔ XMP), the
 * OutputIntent/ICC is present, and the /ID exists — the post-processing requirements.
 */
import {
  PDFDocument,
  PDFName,
  PDFString,
  PDFHexString,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";

export type PdfAConformance = "1B" | "2B" | "3B";

export interface PdfAOptions {
  /**
   * sRGB ICC profile bytes — REQUIRED for the OutputIntent. Ship a standard
   * "sRGB IEC61966-2.1" profile (e.g. from color.org / the package's
   * resources/sRGB.icc) and pass it here. Without it the pass adds XMP + ID only
   * and the result is NOT valid PDF/A (OutputIntent missing) — it throws unless
   * `allowNoIcc` is set.
   */
  iccProfile?: Uint8Array;
  /** Proceed without an ICC (XMP+ID only) — produces NON-compliant output. */
  allowNoIcc?: boolean;
  /** PDF/A conformance level. Default "3B" (the most permissive; allows attachments). */
  conformance?: PdfAConformance;
  title?: string;
  author?: string;
  /** Creation/modification instant stamped into BOTH Info and XMP (kept consistent).
   *  Defaults to the PDF's existing CreationDate, else now. Pass a fixed Date for
   *  reproducible output. */
  date?: Date;
}

const CREATOR_TOOL = "IntentText (@dotit/pdf)";
const PRODUCER = "IntentText (@dotit/pdf)";

interface XmpMeta {
  part: string;
  conformance: string;
  title: string;
  author: string;
  creatorTool: string;
  producer: string;
  /** ISO-8601 (no milliseconds), e.g. "2026-06-19T10:00:00Z". */
  createDate: string;
  modifyDate: string;
}

/**
 * Build the XMP packet. PDF/A requires the XMP to be CONSISTENT with the document
 * information dictionary for every shared property — so this emits `xmp:CreatorTool`
 * (= Info /Creator), `pdf:Producer` (= Info /Producer), and `xmp:CreateDate` /
 * `xmp:ModifyDate` (= Info /CreationDate, /ModDate) alongside dc:title / dc:creator.
 * A property present in Info but missing from XMP (or with a different value) is a
 * veraPDF metadata-consistency failure (G-07).
 */
function xmpPacket(m: XmpMeta): string {
  const esc = (s: string) =>
    s.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"));
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdfaid:part>${m.part}</pdfaid:part>
      <pdfaid:conformance>${m.conformance}</pdfaid:conformance>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(m.title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${esc(m.author)}</rdf:li></rdf:Seq></dc:creator>
      <xmp:CreatorTool>${esc(m.creatorTool)}</xmp:CreatorTool>
      <xmp:CreateDate>${m.createDate}</xmp:CreateDate>
      <xmp:ModifyDate>${m.modifyDate}</xmp:ModifyDate>
      <xmp:MetadataDate>${m.modifyDate}</xmp:MetadataDate>
      <pdf:Producer>${esc(m.producer)}</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/** ISO-8601 with no milliseconds (the XMP date form), e.g. 2026-06-19T10:00:00Z. */
function xmpDate(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Apply the PDF/A pass to PDF bytes. Returns new PDF bytes. Requires an sRGB ICC
 * profile (PDF/A needs an OutputIntent) unless `allowNoIcc` is set.
 */
export async function toPdfA(pdf: Uint8Array, opts: PdfAOptions = {}): Promise<Uint8Array> {
  if (!opts.iccProfile && !opts.allowNoIcc) {
    throw new Error(
      "PDF/A requires an sRGB ICC profile for the OutputIntent. Pass opts.iccProfile " +
        "(a standard 'sRGB IEC61966-2.1' profile), or set allowNoIcc to emit XMP+ID only " +
        "(NOT valid PDF/A).",
    );
  }
  const conformance = opts.conformance ?? "3B";
  const part = conformance[0];
  const level = conformance.slice(1);

  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const ctx = doc.context;
  const title = opts.title ?? doc.getTitle() ?? "";
  const author = opts.author ?? doc.getAuthor() ?? "";

  // Keep the document info dictionary consistent with the XMP — every shared field
  // must match in BOTH or veraPDF flags a metadata-consistency error (G-07).
  const when = opts.date ?? doc.getCreationDate() ?? new Date();
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  doc.setCreator(CREATOR_TOOL);
  doc.setProducer(PRODUCER);
  doc.setCreationDate(when);
  doc.setModificationDate(when);

  // 1. XMP metadata stream (uncompressed, plain XML) referenced from the catalog.
  const xmp = xmpPacket({
    part,
    conformance: level,
    title,
    author,
    creatorTool: CREATOR_TOOL,
    producer: PRODUCER,
    createDate: xmpDate(when),
    modifyDate: xmpDate(when),
  });
  const metaStream = PDFRawStream.of(
    ctx.obj({ Type: "Metadata", Subtype: "XML", Length: xmp.length }),
    new TextEncoder().encode(xmp),
  );
  const metaRef = ctx.register(metaStream);
  doc.catalog.set(PDFName.of("Metadata"), metaRef);

  // 2. OutputIntent with the embedded sRGB ICC profile.
  if (opts.iccProfile) {
    const iccStream = ctx.flateStream(opts.iccProfile, { N: 3 });
    const iccRef = ctx.register(iccStream);
    const outputIntent = ctx.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
      Info: PDFString.of("sRGB IEC61966-2.1"),
      RegistryName: PDFString.of("http://www.color.org"),
      DestOutputProfile: iccRef,
    });
    doc.catalog.set(PDFName.of("OutputIntents"), ctx.obj([outputIntent]));
  }

  // 3. A stable document /ID (PDF/A requires one).
  const idHex = stableId(title || "intenttext", xmp.length);
  ctx.trailerInfo.ID = ctx.obj([PDFHexString.of(idHex), PDFHexString.of(idHex)]);

  // PDF/A-1 forbids object/xref streams; -2/-3 allow them. Disable for the widest
  // compatibility regardless of level.
  return doc.save({ useObjectStreams: false, addDefaultPage: false });
}

/** Deterministic 32-hex-char ID from inputs (no Math.random — stable across runs). */
function stableId(seed: string, n: number): string {
  let h = 0x811c9dc5 >>> 0;
  const s = `${seed}:${n}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 4; i++) {
    h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, 32);
}

// re-export so consumers can sanity-check ICC streams in tests if needed
export { decodePDFRawStream };
