// Single source of truth for page geometry in the visual editor.
//
// The SAME `page:` block drives core's @page print CSS and this on-screen
// geometry, so the editor view and the printed PDF paginate identically —
// that's what makes the editor WYSIWYG. All values are CSS px at 96dpi
// (1mm = 96/25.4 px), kept as floats to avoid drift across many pages.

import { parseIntentText } from "@dotit/core";

export const MM = 96 / 25.4;

/** Named paper sizes in mm — keep in sync with core's PAPER_SIZES. */
const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  A3: [297, 420],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
};

/** Ruler unit per named paper size — metric sheets read in cm, US sheets in inches. */
const PAPER_UNIT: Record<string, "cm" | "in"> = {
  A4: "cm",
  A5: "cm",
  A3: "cm",
  LETTER: "in",
  LEGAL: "in",
  TABLOID: "in",
};

/** Default print margin — MUST match core renderPrint's default (20mm). */
const DEFAULT_MARGIN_MM = 20;
/** Narrow pages (receipts) default tight margins — matches core (≤120mm → 4mm). */
const NARROW_MARGIN_MM = 4;
const NARROW_WIDTH_MM = 120;

export interface PageGeometry {
  /** Page width in px. */
  width: number;
  /** Page height in px — Infinity when height is `auto` (continuous receipt). */
  height: number;
  /** True when the page grows with content (e.g. `80mm auto`): no pagination. */
  autoHeight: boolean;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  /** Height available for content on one page (height - vertical margins). */
  contentHeight: number;
  /** Header text ('' if none). Supports {{page}}/{{pages}} tokens. */
  header: string;
  /** Footer text ('' if none). Supports {{page}}/{{pages}} tokens. */
  footer: string;
  /** Ruler unit derived from the page size (A-series → cm, Letter/Legal → in). */
  unit: "cm" | "in";
}

function parseLength(v: string): number | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*(mm|cm|in|px|pt)?$/.exec(v.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  switch (m[2] || "mm") {
    case "mm":
      return n * MM;
    case "cm":
      return n * 10 * MM;
    case "in":
      return n * 96;
    case "pt":
      return (n / 72) * 96;
    case "px":
      return n;
    default:
      return null;
  }
}

/** Parse a CSS-style margin shorthand (1–4 values) into [t, r, b, l] px. */
function parseMargins(raw: string, fallback: number): [number, number, number, number] {
  const parts = raw.trim().split(/\s+/).map(parseLength);
  if (parts.some((p) => p === null) || parts.length === 0)
    return [fallback, fallback, fallback, fallback];
  const v = parts as number[];
  if (v.length === 1) return [v[0], v[0], v[0], v[0]];
  if (v.length === 2) return [v[0], v[1], v[0], v[1]];
  if (v.length === 3) return [v[0], v[1], v[2], v[1]];
  return [v[0], v[1], v[2], v[3]];
}

/** Compute the page geometry from `.it` source (its page:/header:/footer: blocks). */
export function getPageGeometry(source: string): PageGeometry {
  let size = "A4";
  let marginRaw: string | undefined;
  let header = "";
  let footer = "";
  try {
    const doc = parseIntentText(source);
    const page = doc.blocks.find((b) => b.type === "page");
    const props = (page?.properties || {}) as Record<string, string>;
    if (props.size) size = String(props.size);
    marginRaw = (props.margin ?? props.margins) as string | undefined;
    header =
      doc.blocks.find((b) => b.type === "header")?.content ||
      String(props.header || "");
    footer =
      doc.blocks.find((b) => b.type === "footer")?.content ||
      String(props.footer || "");
  } catch {
    /* defaults */
  }

  // Resolve page size: named, or "<w> <h>" (h may be `auto`).
  let width = PAPER_MM.A4[0] * MM;
  let height: number = PAPER_MM.A4[1] * MM;
  let autoHeight = false;
  let unit: "cm" | "in" = "cm";
  const named = PAPER_MM[size] || PAPER_MM[size.toUpperCase?.() as string];
  if (named) {
    width = named[0] * MM;
    height = named[1] * MM;
    unit = PAPER_UNIT[size.toUpperCase()] || "cm";
  } else {
    const parts = size.trim().split(/\s+/);
    const w = parts[0] ? parseLength(parts[0]) : null;
    if (w) width = w;
    // Custom sizes declared in inches read in inches; everything else metric.
    if (/(\d)\s*in\b/.test(size)) unit = "in";
    if (parts[1] === "auto") {
      autoHeight = true;
      height = Infinity;
    } else {
      const h = parts[1] ? parseLength(parts[1]) : null;
      if (h) height = h;
    }
  }

  const defMargin =
    (width <= NARROW_WIDTH_MM * MM ? NARROW_MARGIN_MM : DEFAULT_MARGIN_MM) * MM;
  const [mt, mr, mb, ml] = marginRaw
    ? parseMargins(marginRaw, defMargin)
    : [defMargin, defMargin, defMargin, defMargin];

  return {
    width,
    height,
    autoHeight,
    marginTop: mt,
    marginRight: mr,
    marginBottom: mb,
    marginLeft: ml,
    contentHeight: autoHeight ? Infinity : height - mt - mb,
    header,
    footer,
    unit,
  };
}

/**
 * Set (or replace) the `margin:` property on the document's `page:` block.
 * Idempotent: replaces any existing margin/margins prop rather than appending,
 * so repeated ruler drags never accumulate duplicate pipe segments. Inserts a
 * `page:` block (after the meta/title preamble) when the document has none.
 */
export function setPageMargin(source: string, marginValue: string): string {
  const lines = source.split("\n");
  const pageIdx = lines.findIndex((l) => /^\s*page\s*:/i.test(l));
  if (pageIdx >= 0) {
    // Strip existing margin/margins segments, then append the new one.
    let line = lines[pageIdx]
      .replace(/\s*\|\s*margins?\s*:[^|]*/gi, "")
      .replace(/\s+$/, "");
    line = `${line} | margin: ${marginValue}`;
    lines[pageIdx] = line;
    return lines.join("\n");
  }
  // No page block — insert one after the leading meta/title/summary preamble.
  const insertAt = lines.findIndex(
    (l) => l.trim() && !/^\s*(meta|title|summary)\s*:/i.test(l),
  );
  const pageLine = `page: A4 | margin: ${marginValue}`;
  if (insertAt <= 0) return `${pageLine}\n${source}`;
  lines.splice(insertAt, 0, pageLine);
  return lines.join("\n");
}

/** Resolve {{page}}/{{pages}} tokens for on-screen display. */
export function resolvePageTokens(
  text: string,
  page: number,
  pages: number,
): string {
  return text
    .replace(/\{\{\s*page\s*\}\}/g, String(page))
    .replace(/\{\{\s*pages\s*\}\}/g, String(pages));
}
