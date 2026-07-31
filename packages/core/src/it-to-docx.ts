/**
 * IntentText → DOCX converter (Node.js + browser; pure JS).
 *
 * Parses `.it` source and emits a spec-valid OOXML .docx (zipped with fflate)
 * that opens in Word / LibreOffice without a repair prompt.
 *
 * The output is a *document*, not a text dump: it carries the document's
 * direction, its `style:` rules, its page setup, its running header/footer, its
 * tables as real tables, and its images as embedded pictures. That matters
 * because the `.it` file is often a contract or an offer — something a person
 * will edit in Word and then sign. A Word file that loses the Arabic direction
 * or collapses a three-column table is not an editable copy of the document; it
 * is a different document.
 *
 * Block mapping:
 *   title:               → Title-styled paragraph
 *   section:             → Heading1        sub: → Heading2
 *   text:/quote:/info:…  → Normal paragraph (info/quote get a shaded callout)
 *   text: … | end: …     → label … value, split across the line
 *   list-item (- …)      → bulleted paragraph (ListBullet style)
 *   step-item (1. …)     → numbered paragraph (ListNumber style)
 *   table                → <w:tbl> with a grid, a filled header row and zebra rows
 *   image:               → embedded picture (needs `resolveImage`)
 *   signline:            → a printed signature line with label, rule, name, role
 *   metric:              → label + value
 *   break:               → page break
 *   page:/header:/footer: → section properties and running header/footer parts
 *   style:               → colour/weight/leading applied to that block type
 *
 * Direction: per paragraph, from its first strong character (the same rule the
 * HTML renderer applies with dir="auto"), falling back to the document
 * language. So a mixed Arabic/English contract lays out correctly line by line.
 */

import { parseIntentText, renderableParts } from "./parser";
import { escapeXml, zip } from "./ooxml-util";
import { IntentBlock, IntentDocument } from "./types";
import { IntentTheme, getBuiltinTheme } from "./theme";

export interface ItToDocxOptions {
  /**
   * The document's theme — a built-in name or a full IntentTheme, exactly what
   * `renderPrint` takes. Passing the same value to both is what keeps the Word
   * file and the PDF the same document: one palette, one type, one identity.
   * Falls back to the `meta: | theme:` line in the source.
   */
  theme?: string | IntentTheme;
  /**
   * Resolve an `image:` src to bytes so the picture is embedded in the .docx.
   * Left out (the browser case) images are skipped rather than emitted broken.
   * Node callers pass a reader, e.g.
   *   { resolveImage: (src) => ({ bytes: fs.readFileSync(src), ext: "png" }) }
   */
  resolveImage?: (src: string) => ImageBytes | undefined;
  /** Body font. Default: a Word-safe stack that also renders Arabic. */
  font?: string;
  /** Accent colour (headings, table header fill). Default: from `style:`/meta, else slate. */
  accent?: string;
}

export interface ImageBytes {
  bytes: Uint8Array;
  /** png | jpeg | gif — used for the content type. Inferred from bytes if absent. */
  ext?: string;
}

// ───────────────────────────── units ─────────────────────────────

const TWIPS_PER_INCH = 1440;
const EMU_PER_INCH = 914400;
const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [11906, 16838],
  a5: [8391, 11906],
  letter: [12240, 15840],
  legal: [12240, 20160],
};

/** CSS length → twips. Understands mm/cm/in/pt/px; bare numbers are px. */
function toTwips(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?\s*$/.exec(String(value));
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case "mm":
      return Math.round((n / 25.4) * TWIPS_PER_INCH);
    case "cm":
      return Math.round((n / 2.54) * TWIPS_PER_INCH);
    case "in":
      return Math.round(n * TWIPS_PER_INCH);
    case "pt":
      return Math.round(n * 20);
    default:
      return Math.round((n / 96) * TWIPS_PER_INCH);
  }
}

/** #rrggbb → RRGGBB (OOXML wants no hash). Non-colours fall back. */
function hex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(color).trim());
  return m ? m[1].toUpperCase() : fallback;
}

function resolveTheme(ref: string | IntentTheme | undefined): IntentTheme | undefined {
  if (ref && typeof ref === "object") return ref;
  if (typeof ref === "string") return getBuiltinTheme(ref);
  return undefined;
}

/** A CSS font stack is meaningless to Word; take the first real family name. */
function firstFamily(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const first = stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "");
  return first || undefined;
}

// ───────────────────────────── direction ─────────────────────────────

// Hebrew, Arabic, Syriac, Thaana, NKo, Arabic Supplement/Extended, presentation forms.
const RTL_CHARS =
  /[֐-׿؀-ۿ܀-ݏݐ-ݿ߀-ࣿיִ-﷿ﹰ-﻿]/;
const LTR_CHARS = /[A-Za-zÀ-ɏͰ-֏]/;

/** First-strong-character direction, or null when the text is all neutral. */
function firstStrongRtl(text: string): boolean | null {
  for (const ch of text) {
    if (RTL_CHARS.test(ch)) return true;
    if (LTR_CHARS.test(ch)) return false;
  }
  return null;
}

// ───────────────────────────── context ─────────────────────────────

interface StyleRule {
  color?: string;
  weight?: string;
  leading?: string;
  size?: string;
}

interface Ctx {
  rtl: boolean;
  font: string;
  accent: string;
  theme?: IntentTheme;
  styles: Record<string, StyleRule>;
  contentWidth: number; // twips available between the margins
  images: { part: string; ext: string; bytes: Uint8Array; rid: string }[];
  resolveImage?: (src: string) => ImageBytes | undefined;
}

function collectStyleRules(doc: IntentDocument): Record<string, StyleRule> {
  const rules: Record<string, StyleRule> = {};
  const walk = (blocks: IntentBlock[]): void => {
    for (const b of blocks) {
      if (b.type === "style" && b.content) {
        rules[b.content.trim()] = {
          ...(rules[b.content.trim()] ?? {}),
          ...((b.properties as StyleRule) ?? {}),
        };
      }
      if (b.children?.length) walk(b.children);
    }
  };
  walk(doc.blocks);
  return rules;
}

function findBlock(doc: IntentDocument, type: string): IntentBlock | undefined {
  let found: IntentBlock | undefined;
  const walk = (blocks: IntentBlock[]): void => {
    for (const b of blocks) {
      if (!found && b.type === type) found = b;
      if (b.children?.length) walk(b.children);
    }
  };
  walk(doc.blocks);
  return found;
}

// ───────────────────────────── runs & paragraphs ─────────────────────────────

interface RunOpts {
  bold?: boolean;
  rtl?: boolean;
  color?: string;
  size?: number; // half-points
  font: string;
}

function runProps(o: RunOpts, extra: string[] = []): string {
  const props = [
    `<w:rFonts w:ascii="${escapeXml(o.font)}" w:hAnsi="${escapeXml(o.font)}" w:cs="${escapeXml(o.font)}"/>`,
    ...extra,
  ];
  if (o.bold) props.push("<w:b/>", "<w:bCs/>");
  if (o.color) props.push(`<w:color w:val="${o.color}"/>`);
  if (o.size) props.push(`<w:sz w:val="${o.size}"/>`, `<w:szCs w:val="${o.size}"/>`);
  if (o.rtl) props.push("<w:rtl/>");
  return `<w:rPr>${props.join("")}</w:rPr>`;
}

/**
 * Build the runs XML for a paragraph, honoring `.it` inline emphasis so it survives
 * the round-trip (G-17): `*bold*` → <w:b/>, `_italic_` → <w:i/>, `~strike~` →
 * <w:strike/>, `` `code` `` → a monospace run. `bold` forces bold across the whole
 * paragraph (headings / table-header cells). Marks are treated as non-nesting (as in
 * `.it`); an unmatched mark stays literal.
 */
function runsXml(text: string, o: RunOpts): string {
  const emit = (
    s: string,
    f: { b?: boolean; i?: boolean; strike?: boolean; code?: boolean },
  ): string => {
    if (s === "") return "";
    const extra: string[] = [];
    if (f.i) extra.push("<w:i/>", "<w:iCs/>");
    if (f.strike) extra.push("<w:strike/>");
    const props = f.code
      ? runProps({ ...o, bold: o.bold || f.b, font: "Consolas" }, extra)
      : runProps({ ...o, bold: o.bold || f.b }, extra);
    return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(s)}</w:t></w:r>`;
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
  return out || `<w:r>${runProps(o)}<w:t xml:space="preserve"></w:t></w:r>`;
}

interface ParaOpts {
  style?: string;
  bold?: boolean;
  color?: string;
  size?: number;
  /** null → derive from the text; true/false → force. */
  rtl?: boolean | null;
  align?: "left" | "right" | "center" | "both";
  spacingBefore?: number; // twips
  spacingAfter?: number;
  lineRule?: number; // 240ths of a line
  indentStart?: number;
  shading?: string;
  borderStart?: string;
  borderBottom?: string;
  keepNext?: boolean;
  pageBreakBefore?: boolean;
  tabRightAt?: number;
  /** Value pinned to the far end of the same line, past a tab stop. */
  endText?: string;
}

function paragraph(text: string, ctx: Ctx, o: ParaOpts = {}): string {
  const derived = o.rtl === undefined || o.rtl === null ? firstStrongRtl(text) : o.rtl;
  const rtl = derived === null ? ctx.rtl : derived;

  const pPr: string[] = [];
  if (o.style) pPr.push(`<w:pStyle w:val="${o.style}"/>`);
  if (o.keepNext) pPr.push("<w:keepNext/>");
  if (o.pageBreakBefore) pPr.push("<w:pageBreakBefore/>");
  if (o.shading) pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shading}"/>`);
  if (o.borderStart || o.borderBottom) {
    const side = rtl ? "right" : "left";
    const parts: string[] = [];
    if (o.borderStart)
      parts.push(
        `<w:${side} w:val="single" w:sz="24" w:space="6" w:color="${o.borderStart}"/>`,
      );
    if (o.borderBottom)
      parts.push(
        `<w:bottom w:val="dotted" w:sz="6" w:space="2" w:color="${o.borderBottom}"/>`,
      );
    pPr.push(`<w:pBdr>${parts.join("")}</w:pBdr>`);
  }
  if (o.spacingBefore || o.spacingAfter || o.lineRule) {
    const attrs = [
      o.spacingBefore ? `w:before="${o.spacingBefore}"` : "",
      o.spacingAfter ? `w:after="${o.spacingAfter}"` : "",
      o.lineRule ? `w:line="${o.lineRule}" w:lineRule="auto"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    pPr.push(`<w:spacing ${attrs}/>`);
  }
  if (o.indentStart) {
    pPr.push(
      rtl
        ? `<w:ind w:right="${o.indentStart}"/>`
        : `<w:ind w:left="${o.indentStart}"/>`,
    );
  }
  if (o.tabRightAt)
    pPr.push(`<w:tabs><w:tab w:val="${rtl ? "left" : "right"}" w:pos="${o.tabRightAt}"/></w:tabs>`);
  if (rtl) pPr.push("<w:bidi/>");
  if (o.align) pPr.push(`<w:jc w:val="${o.align}"/>`);
  else pPr.push(`<w:jc w:val="${rtl ? "right" : "left"}"/>`);

  const runOpts = {
    bold: o.bold,
    rtl,
    color: o.color,
    size: o.size,
    font: ctx.font,
  };
  let runs = runsXml(text, runOpts);
  if (o.endText != null) {
    // A literal "\t" inside <w:t> is just whitespace; the tab has to be its own
    // element or the value wraps onto the next line instead of pinning to the end.
    runs +=
      `<w:r>${runProps(runOpts)}<w:tab/></w:r>` +
      runsXml(o.endText, { ...runOpts, bold: true });
  }
  return `<w:p><w:pPr>${pPr.join("")}</w:pPr>${runs}</w:p>`;
}

function listParagraph(text: string, ctx: Ctx, ordered: boolean): string {
  const rtl = firstStrongRtl(text) ?? ctx.rtl;
  const style = ordered ? "ListNumber" : "ListBullet";
  const numId = ordered ? 2 : 1;
  // No explicit w:jc: an alignment plus a hanging indent makes the marker float
  // with the text on short lines. `w:bidi` alone starts the line — and the
  // marker — at the correct margin whatever the line length.
  const pPr =
    `<w:pStyle w:val="${style}"/>` +
    `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr>` +
    (rtl ? "<w:bidi/>" : "") +
    '<w:spacing w:after="60"/>';
  return `<w:p><w:pPr>${pPr}</w:pPr>${runsXml(text, { rtl, font: ctx.font })}</w:p>`;
}

// ───────────────────────────── tables ─────────────────────────────

/**
 * A `w:tbl` with no `w:tblGrid` is not a valid table: Word and LibreOffice both
 * fall back to a single column, silently dropping every cell after the first.
 * That is why the grid is computed here rather than left to the reader.
 */
function tableXml(headers: string[], rows: string[][], ctx: Ctx): string {
  const all: { cells: string[]; header: boolean }[] = [];
  if (headers && headers.length > 0) all.push({ cells: headers, header: true });
  for (const r of rows) all.push({ cells: r, header: false });
  if (all.length === 0) return "";

  const cols = Math.max(...all.map((r) => r.cells.length));
  const colWidth = Math.floor(ctx.contentWidth / cols);
  const grid = `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${colWidth}"/>`).join("")}</w:tblGrid>`;

  const rule = themeColor(ctx, "border", "D8E0E2");
  const zebra = themeColor(ctx, "background", "F5F8F8");

  const trs = all
    .map((row, rowIndex) => {
      const bodyIndex = headers?.length ? rowIndex - 1 : rowIndex;
      const fill = row.header ? ctx.accent : bodyIndex % 2 === 1 ? zebra : "";
      const cells: string[] = [];
      for (let i = 0; i < cols; i++) {
        const text = row.cells[i] ?? "";
        const tcPr =
          `<w:tcW w:w="${colWidth}" w:type="dxa"/>` +
          (fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "") +
          `<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>` +
          `<w:start w:w="100" w:type="dxa"/><w:end w:w="100" w:type="dxa"/></w:tcMar>` +
          "<w:vAlign w:val=\"center\"/>";
        const para = paragraph(text, ctx, {
          bold: row.header,
          color: row.header ? "FFFFFF" : undefined,
          spacingBefore: 20,
          spacingAfter: 20,
        });
        cells.push(`<w:tc><w:tcPr>${tcPr}</w:tcPr>${para}</w:tc>`);
      }
      const trPr = row.header ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
      return `<w:tr>${trPr}${cells.join("")}</w:tr>`;
    })
    .join("");

  const tblPr =
    '<w:tblPr><w:tblStyle w:val="TableGrid"/>' +
    `<w:tblW w:w="${ctx.contentWidth}" w:type="dxa"/>` +
    (ctx.rtl ? "<w:bidiVisual/>" : "") +
    "<w:tblBorders>" +
    `<w:top w:val="single" w:sz="4" w:space="0" w:color="${rule}"/>` +
    `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="${rule}"/>` +
    `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="${rule}"/>` +
    "</w:tblBorders>" +
    '<w:tblCellMar><w:start w:w="100" w:type="dxa"/><w:end w:w="100" w:type="dxa"/></w:tblCellMar>' +
    "</w:tblPr>";
  return `<w:tbl>${tblPr}${grid}${trs}</w:tbl>`;
}

// ───────────────────────────── images ─────────────────────────────

/** Intrinsic size in px from the bytes — PNG (IHDR) and JPEG (SOFn). */
function imageSizePx(bytes: Uint8Array): { w: number; h: number } | undefined {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry the dimensions
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          h: (bytes[i + 5] << 8) | bytes[i + 6],
          w: (bytes[i + 7] << 8) | bytes[i + 8],
        };
      }
      i += 2 + len;
    }
  }
  return undefined;
}

function inferExt(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  return "png";
}

function imageXml(block: IntentBlock, ctx: Ctx): string {
  if (!ctx.resolveImage) return "";
  const props = (block.properties ?? {}) as Record<string, string>;
  const src = String(props.src ?? props.at ?? block.content ?? "");
  if (!src) return "";
  const resolved = ctx.resolveImage(src);
  if (!resolved || !resolved.bytes?.length) return "";

  const ext = resolved.ext ?? inferExt(resolved.bytes);
  const index = ctx.images.length + 1;
  const rid = `rIdImg${index}`;
  const part = `media/image${index}.${ext}`;
  ctx.images.push({ part, ext, bytes: resolved.bytes, rid });

  const size = imageSizePx(resolved.bytes) ?? { w: 240, h: 120 };
  const maxW = toTwips(props.width, 0) || 0;
  // Default to the intrinsic size at 96 dpi, capped at the content width.
  let wEmu = Math.round((size.w / 96) * EMU_PER_INCH);
  let hEmu = Math.round((size.h / 96) * EMU_PER_INCH);
  const capEmu = maxW
    ? Math.round((maxW / TWIPS_PER_INCH) * EMU_PER_INCH)
    : Math.round((ctx.contentWidth / TWIPS_PER_INCH) * EMU_PER_INCH);
  if (wEmu > capEmu) {
    hEmu = Math.round((hEmu * capEmu) / wEmu);
    wEmu = capEmu;
  }

  const alt = escapeXml(block.content || "image");
  const drawing =
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${wEmu}" cy="${hEmu}"/><wp:docPr id="${index}" name="Picture ${index}" descr="${alt}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${index}" name="Picture ${index}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${wEmu}" cy="${hEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`;

  const jc = ctx.rtl ? "right" : "left";
  return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:after="120"/></w:pPr><w:r>${drawing}</w:r></w:p>`;
}

// ───────────────────────────── header / footer ─────────────────────────────

/** `{{page}}` / `{{pages}}` become real Word fields so the numbers are live. */
function runsWithFields(text: string, ctx: Ctx, rtl: boolean): string {
  const muted = themeColor(ctx, "muted", "6B7A80");
  const field = (instr: string): string =>
    `<w:r>${runProps({ rtl, font: ctx.font, size: 16, color: muted })}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r>${runProps({ rtl, font: ctx.font, size: 16, color: muted })}<w:instrText xml:space="preserve"> ${instr} </w:instrText></w:r>` +
    `<w:r>${runProps({ rtl, font: ctx.font, size: 16, color: muted })}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r>${runProps({ rtl, font: ctx.font, size: 16, color: muted })}<w:t>1</w:t></w:r>` +
    `<w:r>${runProps({ rtl, font: ctx.font, size: 16, color: muted })}<w:fldChar w:fldCharType="end"/></w:r>`;

  let out = "";
  const re = /\{\{\s*(page|pages)\s*\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      out += runsXml(text.slice(last, m.index), {
        rtl,
        font: ctx.font,
        size: 16,
        color: muted,
      });
    out += field(m[1] === "page" ? "PAGE" : "NUMPAGES");
    last = re.lastIndex;
  }
  if (last < text.length)
    out += runsXml(text.slice(last), { rtl, font: ctx.font, size: 16, color: muted });
  return out;
}

function headerFooterPart(tag: "hdr" | "ftr", text: string, ctx: Ctx): string {
  const rtl = firstStrongRtl(text) ?? ctx.rtl;
  const line = themeColor(ctx, "border", "D8E0E2");
  const border =
    tag === "hdr"
      ? `<w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="${line}"/></w:pBdr>`
      : `<w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="${line}"/></w:pBdr>`;
  const pPr = `<w:pPr>${border}${rtl ? "<w:bidi/>" : ""}<w:jc w:val="center"/></w:pPr>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ` +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:p>${pPr}${runsWithFields(text, ctx, rtl)}</w:p>` +
    `</w:${tag}>`
  );
}

// ───────────────────────────── body ─────────────────────────────

/** A theme colour by key, as OOXML hex. Falls back when there is no theme. */
function themeColor(ctx: Ctx, key: string, fallback: string): string {
  return hex(ctx.theme?.colors?.[key], fallback);
}

function styleFor(ctx: Ctx, type: string): StyleRule {
  return ctx.styles[type] ?? {};
}

function lineRuleFor(rule: StyleRule): number | undefined {
  if (!rule.leading) return undefined;
  const n = parseFloat(rule.leading);
  return Number.isFinite(n) ? Math.round(n * 240) : undefined;
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
      (n as { value?: string }).value ?? (n as { content?: string }).content ?? "";
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

function signlineXml(block: IntentBlock, ctx: Ctx): string {
  const props = (block.properties ?? {}) as Record<string, string>;
  const out: string[] = [];
  if (props.label)
    out.push(
      paragraph(String(props.label), ctx, {
        bold: true,
        color: ctx.accent,
        size: 20,
        spacingBefore: 320,
        spacingAfter: 200,
        keepNext: true,
      }),
    );
  // The rule the pen goes on: an empty paragraph carrying a bottom border.
  out.push(
    paragraph("", ctx, {
      borderBottom: themeColor(ctx, "border", "9AA8AC"),
      spacingBefore: 240,
      spacingAfter: 40,
      keepNext: true,
    }),
  );
  out.push(
    paragraph(inlineMarkers(block), ctx, { bold: true, size: 20, spacingAfter: 20 }),
  );
  if (props.role)
    out.push(
      paragraph(String(props.role), ctx, {
        size: 18,
        color: themeColor(ctx, "muted", "6B7A80"),
      }),
    );
  if (String(props["date-line"]) === "true")
    out.push(
      paragraph(ctx.rtl ? "التاريخ: ………………………" : "Date: ………………………", ctx, {
        size: 18,
        color: themeColor(ctx, "muted", "6B7A80"),
        spacingBefore: 160,
      }),
    );
  return out.join("");
}

/** Walk the doc tree, emitting body XML in order. */
function buildBody(doc: IntentDocument, ctx: Ctx): string {
  const body: string[] = [];
  const titleRule = styleFor(ctx, "title");
  const sectionRule = styleFor(ctx, "section");
  const subRule = styleFor(ctx, "sub");
  const textRule = styleFor(ctx, "text");

  function walk(blocks: IntentBlock[]): void {
    // Consecutive `text: … | end: …` lines arrive merged into one block with only
    // the first line's properties; renderableParts hands them back whole.
    for (const block of blocks.flatMap(renderableParts)) {
      const props = (block.properties ?? {}) as Record<string, string>;
      switch (block.type) {
        case "title":
          body.push(
            paragraph(inlineMarkers(block), ctx, {
              style: "Title",
              // bold lives in the paragraph style, never on the run: a bold run
              // round-trips back through docx-to-it as a literal *marker*.
              size: 40,
              color: hex(titleRule.color, ctx.accent),
              align: "center",
              spacingAfter: 120,
            }),
          );
          break;
        case "summary":
          body.push(
            paragraph(inlineMarkers(block), ctx, {
              style: "Subtitle",
              size: 20,
              color: themeColor(ctx, "muted", "6B7A80"),
              align: "center",
              spacingAfter: 260,
            }),
          );
          break;
        case "section":
          body.push(
            paragraph(inlineMarkers(block), ctx, {
              style: "Heading1",
              // bold lives in the paragraph style, never on the run: a bold run
              // round-trips back through docx-to-it as a literal *marker*.
              size: 26,
              color: hex(sectionRule.color, ctx.accent),
              spacingBefore: 300,
              spacingAfter: 120,
              keepNext: true,
            }),
          );
          break;
        case "sub":
          body.push(
            paragraph(inlineMarkers(block), ctx, {
              style: "Heading2",
              // bold lives in the paragraph style, never on the run: a bold run
              // round-trips back through docx-to-it as a literal *marker*.
              size: 22,
              color: hex(subRule.color, ctx.accent),
              spacingBefore: 200,
              spacingAfter: 80,
              keepNext: true,
            }),
          );
          break;
        case "list-item":
          body.push(listParagraph(inlineMarkers(block), ctx, false));
          break;
        case "step-item":
          body.push(listParagraph(inlineMarkers(block), ctx, true));
          break;
        case "table":
          if (block.table)
            body.push(
              tableXml(block.table.headers || [], block.table.rows || [], ctx),
              // a table butting straight against the next paragraph reads cramped
              paragraph("", ctx, { spacingAfter: 60 }),
            );
          break;
        case "image":
          body.push(imageXml(block, ctx));
          break;
        case "signline":
          body.push(signlineXml(block, ctx));
          break;
        case "info":
        case "quote":
          body.push(
            paragraph(inlineMarkers(block), ctx, {
              size: 19,
              color: themeColor(ctx, "text", "3A4A50"),
              shading: themeColor(ctx, "background", "F5F8F8"),
              borderStart: ctx.accent,
              indentStart: 120,
              spacingBefore: 120,
              spacingAfter: 120,
              lineRule: lineRuleFor(textRule),
            }),
          );
          break;
        case "metric": {
          const value = props.value ?? "";
          const unit = props.unit ? ` ${props.unit}` : "";
          body.push(
            paragraph(
              value ? `${block.content}: *${value}${unit}*` : block.content || "",
              ctx,
              {
                bold: false,
                shading: themeColor(ctx, "background", "F5F8F8"),
                spacingBefore: 80,
                spacingAfter: 80,
                indentStart: 60,
              },
            ),
          );
          break;
        }
        case "contact": {
          const bits = [props.email, props.phone].filter(Boolean).join("  ·  ");
          body.push(
            paragraph(`*${inlineMarkers(block)}*`, ctx, { spacingAfter: 20 }),
          );
          if (bits)
            body.push(
              paragraph(bits, ctx, {
                size: 18,
                color: themeColor(ctx, "muted", "6B7A80"),
              }),
            );
          break;
        }
        case "break":
          body.push(paragraph("", ctx, { pageBreakBefore: true }));
          break;
        case "divider":
          body.push(
            '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="' +
              themeColor(ctx, 'border', 'D8E0E2') +
              '"/></w:pBdr></w:pPr></w:p>',
          );
          break;
        case "meta":
        case "page":
        case "header":
        case "footer":
        case "watermark":
        case "style":
          // metadata / layout — consumed by the section properties, not the body
          break;
        default: {
          const content = inlineMarkers(block);
          if (content.trim() === "") break;
          // `text: label | end: value` is a two-ended line: label at the start of
          // the line, value at the far end. A tab stop at the content width is
          // what keeps them apart when the document is edited.
          if (props.end) {
            body.push(
              paragraph(content, ctx, {
                endText: props.end,
                tabRightAt: ctx.contentWidth,
                spacingAfter: 40,
                lineRule: lineRuleFor(textRule),
              }),
            );
          } else {
            body.push(
              paragraph(content, ctx, {
                spacingAfter: 80,
                lineRule: lineRuleFor(textRule),
              }),
            );
          }
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
  if (body.length === 0) body.push(paragraph("", ctx));
  return body.join("");
}

// ───────────────────────────── package ─────────────────────────────

/**
 * Convert IntentText source to a DOCX byte array.
 */
export function convertIntentTextToDocx(
  source: string,
  opts: ItToDocxOptions = {},
): Uint8Array {
  const doc = parseIntentText(source);
  const meta = (doc.metadata?.meta ?? {}) as Record<string, string>;
  const styles = collectStyleRules(doc);

  const pageBlock = findBlock(doc, "page");
  const pageProps = (pageBlock?.properties ?? {}) as Record<string, string>;
  const [pgW, pgH] =
    PAGE_SIZES[String(pageProps.size ?? "a4").toLowerCase()] ?? PAGE_SIZES.a4;
  const margin = toTwips(pageProps.margin, 1134); // 20mm
  const landscape = String(pageProps.orientation ?? "").toLowerCase() === "landscape";
  const pageW = landscape ? pgH : pgW;
  const pageH = landscape ? pgW : pgH;

  const theme = resolveTheme(opts.theme ?? meta.theme);
  const ctx: Ctx = {
    rtl: doc.metadata?.language === "rtl",
    // Word needs a family name, not a CSS stack — and a font absent from the
    // reader's machine silently changes the document, so an unresolvable theme
    // font falls back to Arial: present on Windows, macOS and most Linux boxes,
    // and one of the few that also carries Arabic.
    font: opts.font ?? meta.font ?? firstFamily(theme?.fonts?.body) ?? "Arial",
    accent: hex(
      opts.accent ??
        meta.accent ??
        styles.section?.color ??
        styles.title?.color ??
        theme?.colors?.accent ??
        theme?.colors?.heading,
      "1F3B45",
    ),
    theme,
    styles,
    contentWidth: pageW - margin * 2,
    images: [],
    resolveImage: opts.resolveImage,
  };

  const bodyXml = buildBody(doc, ctx);

  const headerBlock = findBlock(doc, "header");
  const footerBlock = findBlock(doc, "footer");
  const headerText = headerBlock?.content?.trim() ?? "";
  const footerText = footerBlock?.content?.trim() ?? "";

  const sectRefs =
    (headerText ? '<w:headerReference w:type="default" r:id="rIdHdr"/>' : "") +
    (footerText ? '<w:footerReference w:type="default" r:id="rIdFtr"/>' : "");
  const sectPr =
    `<w:sectPr>${sectRefs}` +
    `<w:pgSz w:w="${pageW}" w:h="${pageH}"${landscape ? ' w:orient="landscape"' : ""}/>` +
    `<w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" ` +
    'w:header="567" w:footer="567" w:gutter="0"/>' +
    (ctx.rtl ? "<w:bidi/>" : "") +
    "</w:sectPr>";

  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    `<w:body>${bodyXml}${sectPr}</w:body>` +
    "</w:document>";

  // Minimal styles defining Title/Heading1/2/Subtitle + list styles.
  const heading = (id: string, name: string, sz: string, outline: string) =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="${outline}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:docDefaults><w:rPrDefault><w:rPr>" +
    `<w:rFonts w:ascii="${escapeXml(ctx.font)}" w:hAnsi="${escapeXml(ctx.font)}" w:cs="${escapeXml(ctx.font)}"/>` +
    '<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="290" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    "</w:docDefaults>" +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style>' +
    heading("Heading1", "heading 1", "26", "0") +
    heading("Heading2", "heading 2", "22", "1") +
    heading("Heading3", "heading 3", "21", "2") +
    '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListNumber"><w:name w:val="List Number"/><w:basedOn w:val="Normal"/></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style>' +
    "</w:styles>";

  // Numbering: one bullet list (numId 1), one decimal list (numId 2).
  // `w:bidi` on the level keeps the marker on the correct side in RTL documents.
  // `w:left` (not `w:start`) in the numbering definition: under a bidi paragraph
  // both Word and LibreOffice flip it to the start side, and `w:start` is the one
  // LibreOffice ignores here — the marker then lands on the wrong side of the line.
  const listPPr = (indent: string) =>
    `<w:pPr>${ctx.rtl ? "<w:bidi/>" : ""}<w:ind w:left="${indent}" w:hanging="360"/></w:pPr>`;
  const numberingXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>${listPPr("400")}</w:lvl></w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>${listPPr("400")}</w:lvl></w:abstractNum>` +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
    "</w:numbering>";

  const imageDefaults = [...new Set(ctx.images.map((i) => i.ext))]
    .map(
      (ext) =>
        `<Default Extension="${ext}" ContentType="image/${ext === "jpg" ? "jpeg" : ext}"/>`,
    )
    .join("");
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    imageDefaults +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    (headerText
      ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      : "") +
    (footerText
      ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      : "") +
    "</Types>";

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>";

  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const documentRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${R}/numbering" Target="numbering.xml"/>` +
    (headerText ? `<Relationship Id="rIdHdr" Type="${R}/header" Target="header1.xml"/>` : "") +
    (footerText ? `<Relationship Id="rIdFtr" Type="${R}/footer" Target="footer1.xml"/>` : "") +
    ctx.images
      .map((i) => `<Relationship Id="${i.rid}" Type="${R}/image" Target="${i.part}"/>`)
      .join("") +
    "</Relationships>";

  const parts: Record<string, string | Uint8Array> = {
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rootRels,
    "word/document.xml": documentXml,
    "word/_rels/document.xml.rels": documentRels,
    "word/styles.xml": stylesXml,
    "word/numbering.xml": numberingXml,
  };
  if (headerText) parts["word/header1.xml"] = headerFooterPart("hdr", headerText, ctx);
  if (footerText) parts["word/footer1.xml"] = headerFooterPart("ftr", footerText, ctx);
  for (const img of ctx.images) parts[`word/${img.part}`] = img.bytes;

  return zip(parts);
}
