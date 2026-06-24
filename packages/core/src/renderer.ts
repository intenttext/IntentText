import { IntentBlock, IntentDocument, InlineNode, PrintLayout } from "./types";
import { effectiveProperties } from "./defaults";
import { DOCUMENT_CSS } from "./document-css";import { IntentTheme, getBuiltinTheme, generateThemeCSS } from "./theme";
import {
  sealForDocument,
  renderTrustBand,
  TRUST_BAND_CSS,
  trustBandPositionCss,
  type TrustTier,
} from "./seal";
import { documentToSource } from "./source";
import { deriveWorkflowState, WorkflowState } from "./workflow-state";

export interface RenderOptions {
  /** Theme name (built-in) or IntentTheme object */
  theme?: string | IntentTheme;
  /**
   * Stamp the Hash-Based Ambient Seal in the top-right corner of the first page.
   * `true` auto-detects the tier (and colour) from the document's trust lines;
   * pass an object to force a verified tier or set the size (pt). Default off.
   */
  seal?: boolean | { tier?: TrustTier; size?: number };
  /**
   * BARE / "as signed" rendering. When true, ALL visual decoration is suppressed —
   * authored colour, size, font family, background, alignment, spacing/indent,
   * opacity, border, `style:` rules — leaving only the content and its EMPHASIS
   * (bold / italic / underline / strike). This is the canonical view of what the
   * signature actually covers (see canonicalContent): a court/legal viewer where
   * styling cannot exist, so it can never hide or distort the signed content.
   */
  bare?: boolean;
}

/**
 * Emphasis carries MEANING — it changes how text reads ("shall **not**") — so it
 * stays in the bare/signed view. Every other STYLE_PROPERTIES key is pure
 * appearance and is dropped when rendering bare. Keep this in sync with the
 * content projection that the signature hashes.
 */
const EMPHASIS_PROPS = new Set(["weight", "italic", "underline", "strike"]);

// Module-scoped bare-render flag. Set at the start of renderHTML (synchronous,
// single-threaded rendering → no reentrancy) and restored in a finally. Read by
// extractInlineStyles + getAlignmentClass so every styling choke point honours it.
let BARE_RENDER = false;

// Bare view = a plain typed document: strip every box/border/background/shadow so
// only the content + emphasis remain — no callout boxes, contact cards, coloured
// rules, field boxes, or seal/sign frames. `.intent-bare .x` (specificity 0,2,0)
// beats the theme/DOCUMENT_CSS single-class rules, and it's emitted AFTER them.
const BARE_RESET_CSS = `
.intent-bare .intent-callout,
.intent-bare .it-callout,
.intent-bare .intent-info,
.intent-bare .it-contact,
.intent-bare .it-deadline,
.intent-bare .intent-sign,
.intent-bare .intent-approve,
.intent-bare .intent-freeze,
.intent-bare .it-field-box,
.intent-bare .it-epigraph{background:none !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;padding-inline:0 !important;}
.intent-bare .intent-summary{border:0 !important;padding-inline-start:0 !important;}
.intent-bare .intent-callout-icon,
.intent-bare .it-callout-icon{display:none;}
`;

function resolveThemeSync(ref: string | IntentTheme | undefined): IntentTheme {
  if (ref && typeof ref === "object") return ref;
  if (typeof ref === "string") {
    const found = getBuiltinTheme(ref);
    if (found) return found;
  }
  // Fall back to corporate theme when none is given or the name is unknown.
  return getBuiltinTheme("corporate") as IntentTheme;
}

// v2.9: Paper size to CSS @page size mapping.
// Stored portrait (w × h). Large ISO sheets (A3/A2/A1) and orientation need an
// explicit `w h` so landscape can swap the two — a bare CSS keyword (`A4`) can't
// be rotated reliably across print engines, so we emit real physical mm.
const PAPER_SIZES: Record<string, string> = {
  A5: "148mm 210mm",
  A4: "210mm 297mm",
  A3: "297mm 420mm",
  A2: "420mm 594mm",
  A1: "594mm 841mm",
  Letter: "8.5in 11in",
  Legal: "8.5in 14in",
};

/**
 * Resolve a `page:`/`size:` value (+ optional `orientation:`) into the true
 * physical @page `size` string. Accepts:
 *   - named sizes: A5|A4|A3|A2|A1|Letter|Legal
 *   - the shorthand `A3 landscape` (orientation baked into the size value)
 *   - explicit `<w> <h>` custom dims (e.g. `210mm 297mm`, `80mm auto`)
 * Landscape swaps the two dimensions; portrait is the default. `auto` heights
 * (continuous receipts) are never swapped.
 */
export function resolvePageSize(
  rawSize: string,
  orientationProp?: string,
): string {
  let raw = String(rawSize || "A4").trim();
  let orientation = String(orientationProp || "").trim().toLowerCase();

  // Shorthand: trailing "landscape"/"portrait" inside the size value wins only
  // if no explicit orientation: prop was given.
  const shorthand = /\s+(landscape|portrait)\s*$/i.exec(raw);
  if (shorthand) {
    if (!orientation) orientation = shorthand[1].toLowerCase();
    raw = raw.slice(0, shorthand.index).trim();
  }

  // Resolve the portrait dimension string.
  const named =
    PAPER_SIZES[raw] ||
    PAPER_SIZES[
      Object.keys(PAPER_SIZES).find(
        (k) => k.toLowerCase() === raw.toLowerCase(),
      ) || ""
    ];
  const dims = named || raw;

  if (orientation !== "landscape") return dims;

  // Landscape: swap the two dimensions (only when there are exactly two).
  const parts = dims.split(/\s+/);
  if (parts.length === 2 && parts[1].toLowerCase() !== "auto") {
    return `${parts[1]} ${parts[0]}`;
  }
  return dims;
}

/** v2.9: Collect print layout blocks from a document. */
export function collectPrintLayout(doc: IntentDocument): PrintLayout {
  const allBlocks = doc.blocks.flatMap(function collect(
    b: IntentBlock,
  ): IntentBlock[] {
    return [b, ...(b.children ?? []).flatMap(collect)];
  });
  return {
    page: allBlocks.find((b) => b.type === "page"),
    header: allBlocks.filter((b) => b.type === "header").pop(),
    footer: allBlocks.filter((b) => b.type === "footer").pop(),
    watermark: allBlocks.filter((b) => b.type === "watermark").pop(),
    breaks: allBlocks.filter(
      (b) => b.type === "break" && (b.properties?.before || b.properties?.keep),
    ),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sanitize a value destined for a CSS property inside an inline style="" — strips
// the metacharacters (`;{}<>"\`) that would let it inject extra declarations or
// break out of the attribute. Callers should still escapeHtml() for the HTML
// attribute context.
function cssValue(value: string): string {
  return value.replace(/[;{}<>"\\]/g, "");
}

/**
 * Build a CSS `content` value for an @page margin box (running header/footer).
 *
 * Two things HTML-escaping gets wrong here and this gets right:
 *  - `{{page}}` / `{{pages}}` become `counter(page)` / `counter(pages)` so running
 *    page numbers actually work (parity with the editor's print path).
 *  - Literal text is escaped for the CSS *string* context (`\` → `\\`, `"` → `\"`,
 *    newlines flattened) — not HTML entities, which would print as `&quot;`.
 *
 * Returns a value ready to drop straight after `content:` (already quoted), e.g.
 *   `"INV-1 · Page " counter(page)`
 */
export function cssContentValue(text: string): string {
  if (!text) return '""';
  const parts = String(text)
    .split(/(\{\{\s*pages?\s*\}\})/g)
    .filter((p) => p !== "");
  return (
    parts
      .map((p) => {
        if (/^\{\{\s*page\s*\}\}$/.test(p)) return "counter(page)";
        if (/^\{\{\s*pages\s*\}\}$/.test(p)) return "counter(pages)";
        return (
          '"' +
          p
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/[\r\n]+/g, " ") +
          '"'
        );
      })
      .join(" ") || '""'
  );
}

/**
 * Format an ISO timestamp for trust block display.
 */
function formatTrustDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    // Date-only inputs (YYYY-MM-DD) read better without a midnight timestamp
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr.trim())) {
      return `${day} ${month} ${year}`;
    }
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch {
    return escapeHtml(isoStr);
  }
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";

  // Allow safe common schemes + relative URLs + fragment links.
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // Block dangerous schemes explicitly
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return "#";
  }

  // Allow bare relative paths like "logo.png" or "assets/banner.png".
  // Block any value that looks like it declares a scheme (e.g. "javascript:").
  if (!lower.includes(":") && !lower.startsWith("//")) {
    return trimmed;
  }

  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return trimmed;
  }

  return "#";
}

// SVG elements that can execute script or load active/external content. An
// embedded `type: svg` is meant to be a static vector graphic, so these are
// stripped entirely before the SVG is inlined into the document.
const SVG_FORBIDDEN_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "link",
  "audio",
  "video",
  "animate",
  "animatetransform",
  "animatemotion",
  "set",
  "handler",
]);

// Sanitize an embedded SVG: keep the vector graphic, remove anything that can
// run JavaScript (script/foreignObject/SMIL animation→href, on* handlers,
// javascript:/vbscript:/data:text-html refs, expression() in inline styles).
// Parses with node-html-parser (already a core dependency, works in Node and the
// browser); if the parser is unavailable for any reason, fails safe by escaping.
function sanitizeSvg(svg: string): string {
  let root: { toString(): string; childNodes?: unknown[] };
  try {
    // Lazy require mirrors html-to-it.ts so the parser isn't pulled into
    // bundles that never embed SVG.
    const { parse } = require("node-html-parser");
    root = parse(svg, { comment: false });
  } catch {
    return escapeHtml(svg);
  }

  const walk = (node: any): void => {
    const children = [...(node.childNodes || [])];
    for (const child of children) {
      // Element nodes expose rawTagName / attributes; skip text & comments.
      const tag = String(child.rawTagName || "").toLowerCase();
      if (!tag) continue;
      if (SVG_FORBIDDEN_TAGS.has(tag)) {
        child.remove();
        continue;
      }
      const attrs = child.attributes || {};
      for (const name of Object.keys(attrs)) {
        const lname = name.toLowerCase();
        const val = String(attrs[name] ?? "");
        const lval = val.trim().toLowerCase();
        if (lname.startsWith("on")) {
          child.removeAttribute(name);
        } else if (
          (lname === "href" ||
            lname === "xlink:href" ||
            lname.endsWith(":href")) &&
          (lval.startsWith("javascript:") ||
            lval.startsWith("vbscript:") ||
            lval.startsWith("data:text/html"))
        ) {
          child.removeAttribute(name);
        } else if (
          lname === "style" &&
          /expression\s*\(|javascript:|vbscript:/i.test(val)
        ) {
          child.removeAttribute(name);
        }
      }
      walk(child);
    }
  };

  try {
    walk(root);
    return root.toString();
  } catch {
    return escapeHtml(svg);
  }
}

// Apply inline AST nodes to produce safe HTML.
// Falls back to escaping plain content when no inline nodes are present.
function applyInlineFormatting(
  content: string,
  inline?: InlineNode[],
  originalContent?: string,
): string {
  if (inline && inline.length > 0) {
    return inline
      .map((node) => {
        switch (node.type) {
          case "text":
            return escapeHtml(node.value);
          case "bold":
            return `<strong>${escapeHtml(node.value)}</strong>`;
          case "italic":
            return `<em>${escapeHtml(node.value)}</em>`;
          case "strike":
            return `<del>${escapeHtml(node.value)}</del>`;
          case "inline-quote":
            return `<q class="intent-inline-quote">${escapeHtml(node.value)}</q>`;
          case "highlight":
            return `<mark class="intent-inline-highlight">${escapeHtml(node.value)}</mark>`;
          case "code":
            return `<code>${escapeHtml(node.value)}</code>`;
          case "styled": {
            // Inline TRACKED CHANGE (redline): [new]{track: ins} / [old]{track: del}.
            // Insertions render as <ins>, deletions as <del>, both tagged with the
            // author/id so the editor can offer accept/reject. See redline.ts.
            if (node.props && node.props.track != null) {
              const tk = String(node.props.track).toLowerCase();
              if (tk === "ins" || tk === "del") {
                const tag = tk === "ins" ? "ins" : "del";
                const by = node.props.by != null ? String(node.props.by) : "";
                const id = node.props.id != null ? String(node.props.id) : "";
                const title = by
                  ? ` title="${escapeHtml((tk === "ins" ? "Inserted by " : "Deleted by ") + by)}"`
                  : "";
                return `<${tag} class="it-track it-track-${tk}"${id ? ` data-change="${escapeHtml(id)}"` : ""}${by ? ` data-by="${escapeHtml(by)}"` : ""}${title}>${escapeHtml(node.value)}</${tag}>`;
              }
            }
            // Inline COMMENT ANCHOR: [clause text]{comment: id} — highlights the
            // anchored span and links it to the `comment:` thread block.
            if (node.props && node.props.comment != null) {
              const cid = escapeHtml(String(node.props.comment));
              return `<span class="it-comment-anchor" data-comment="${cid}">${escapeHtml(node.value)}</span>`;
            }
            // REDACTED span: [████]{redacted: reason; …} renders as a black bar (the
            // text is already removed from source). A PENDING [text]{redact: reason}
            // mark renders highlighted so the author sees what will be removed.
            if (node.props && node.props.redacted != null) {
              const reason = String(node.props.redacted);
              const title = reason && reason !== "yes" ? ` title="${escapeHtml("Redacted: " + reason)}"` : ' title="Redacted"';
              return `<span class="it-redacted"${title}>${escapeHtml(node.value)}</span>`;
            }
            if (node.props && node.props.redact != null) {
              const reason = String(node.props.redact);
              return `<span class="it-redact-pending" title="${escapeHtml("Marked to redact" + (reason ? ": " + reason : ""))}">${escapeHtml(node.value)}</span>`;
            }
            // Inline MATH: [E = mc^2]{math: tex}. Core only MARKS it (stays
            // dependency-free); @dotit/math renders the data-tex placeholder to
            // MathML/KaTeX (renderMathInHtml / hydrateMath). Fallback text = the TeX.
            if (node.props && node.props.math != null) {
              const tex = escapeHtml(node.value);
              return `<span class="it-math" data-tex="${tex}">${tex}</span>`;
            }
            // Inline FORM FIELD: [answer]{input: key; type: …} — a fill-in-the-blank
            // within prose (e.g. "I, [Jane]{input: signer}, agree"). Empty bracket
            // renders as an underline to fill; a value renders inline.
            if (node.props && node.props.input != null) {
              const key = escapeHtml(String(node.props.input));
              const ftype = escapeHtml(
                String(node.props.type ?? "text").toLowerCase(),
              );
              const required = /^(yes|true|on|1|required)$/i.test(
                String(node.props.required ?? "").trim(),
              );
              const hasVal = node.value.trim().length > 0;
              return `<span class="it-field-inline it-field-inline-${ftype} ${hasVal ? "filled" : "blank"}" data-key="${key}" data-type="${ftype}"${required ? ' data-required="true"' : ""}>${hasVal ? escapeHtml(node.value) : ""}</span>`;
            }
            const css = extractInlineStyles(node.props);
            return css
              ? `<span style="${css}">${escapeHtml(node.value)}</span>`
              : escapeHtml(node.value);
          }
          case "inline-note":
            return `<span class="intent-inline-note">${escapeHtml(node.value)}</span>`;
          case "date":
            return `<time class="intent-inline-date" datetime="${escapeHtml(node.iso)}">${escapeHtml(node.value)}</time>`;
          case "mention":
            return `<span class="intent-inline-mention">@${escapeHtml(node.value)}</span>`;
          case "tag":
            return `<span class="intent-inline-tag">#${escapeHtml(node.value)}</span>`;
          case "link":
            return `<a href="${escapeHtml(sanitizeUrl(node.href))}" class="intent-inline-link">${escapeHtml(node.value)}</a>`;
          case "footnote-ref":
            return `<sup class="it-fn-ref"><a href="#fn-${escapeHtml(node.value)}">${escapeHtml(node.value)}</a></sup>`;
          case "label":
            return `<span class="it-label">${escapeHtml(node.value)}</span>`;
          default:
            return escapeHtml((node as { value: string }).value);
        }
      })
      .join("");
  }

  return escapeHtml(originalContent || content);
}

function getAlignmentClass(props: Record<string, string | number>): string {
  // Alignment is styling — dropped in the bare/signed view.
  if (BARE_RENDER) return "";
  const raw = String(props.align || "")
    .toLowerCase()
    .trim();
  if (raw === "center") return " intent-align-center";
  if (raw === "right") return " intent-align-right";
  if (raw === "justify") return " intent-align-justify";
  return "";
}

/**
 * Two-sided row: `text: Customer Name | end: 2026-06-12` puts the content at the
 * line start and the `end:` value at the line end (flex space-between). Uses
 * flex start/end, so it is RTL-native — sides flip automatically under dir="rtl".
 */
function splitEnd(
  content: string,
  props: Record<string, string | number>,
): { inner: string; splitClass: string } {
  const end = props.end;
  if (end === undefined || end === "") {
    return { inner: content, splitClass: "" };
  }
  return {
    inner: `<span class="it-split-main">${content}</span><span class="it-split-end" dir="auto">${escapeHtml(String(end))}</span>`,
    splitClass: " it-split",
  };
}

/**
 * Render table body rows with MERGED CELLS. A cell whose value is exactly `<`
 * merges into the cell on its left (colspan); a cell whose value is exactly `^`
 * merges into the cell above in the same source column (rowspan). Continuation
 * cells (`<` / `^`) are consumed — only real cells emit a <td>. An empty string is
 * a genuine empty cell, NOT a merge.
 */
function renderTableRows(rows: string[][]): string {
  const out: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const cells: string[] = [];
    for (let c = 0; c < rows[r].length; c++) {
      const v = rows[r][c];
      if (v === "<" || v === "^") continue; // continuation — consumed by a real cell
      let colspan = 1;
      while (c + colspan < rows[r].length && rows[r][c + colspan] === "<") colspan++;
      let rowspan = 1;
      while (r + rowspan < rows.length && rows[r + rowspan]?.[c] === "^") rowspan++;
      const attrs =
        (colspan > 1 ? ` colspan="${colspan}"` : "") +
        (rowspan > 1 ? ` rowspan="${rowspan}"` : "");
      cells.push(
        `<td class="intent-table-td"${attrs} dir="auto">${escapeHtml(v)}</td>`,
      );
    }
    out.push(`<tr class="intent-row">${cells.join("")}</tr>`);
  }
  return out.join("");
}

// v2.8.1: Known style properties that map to CSS
const STYLE_PROPERTIES: Record<string, string> = {
  color: "color",
  size: "font-size",
  family: "font-family",
  weight: "font-weight",
  align: "text-align",
  bg: "background-color",
  indent: "padding-inline-start",
  leading: "line-height",
  "space-before": "margin-top",
  "space-after": "margin-bottom",
  opacity: "opacity",
  italic: "font-style",
  border: "border",
  underline: "text-decoration",
  strike: "text-decoration",
  valign: "vertical-align",
};

function extractInlineStyles(
  properties: Record<string, string | number>,
  context: "attr" | "stylesheet" = "attr",
): string {
  const styles: string[] = [];
  const decorations: string[] = [];
  // Visibility guard (defense-in-depth for the styled / non-bare path): never let a
  // content line be made FULLY INVISIBLE through styling — that is the "hidden
  // content" smuggle (opacity:0 / white-on-white / size:0) that the content hash
  // can't see. Bare mode already drops all presentation; here we additionally
  // neutralize only the unambiguously-invisible cases so even a styled print/PDF
  // cannot conceal signed text. Faint-but-readable styling is left untouched.
  const normStyle = (v: unknown) =>
    String(v).trim().toLowerCase().replace(/\s+/g, "");
  const colorVal = normStyle(properties.color);
  const sameColorAsBg = colorVal !== "" && colorVal === normStyle(properties.bg);
  const opacityNum =
    properties.opacity !== undefined
      ? parseFloat(String(properties.opacity))
      : NaN;
  const invisibleOpacity = !Number.isNaN(opacityNum) && opacityNum < 0.1;
  const isZeroSize = (v: unknown) => /^0(?:px|pt|em|rem|%)?$/.test(normStyle(v));
  for (const [prop, css] of Object.entries(STYLE_PROPERTIES)) {
    // Bare/signed view keeps emphasis (bold/italic/underline/strike), drops the
    // rest (colour/size/font/bg/align/spacing/…).
    if (BARE_RENDER && !EMPHASIS_PROPS.has(prop)) continue;
    // Drop styling that would render the content invisible (see visibility guard).
    if ((prop === "color" || prop === "bg") && sameColorAsBg) continue;
    if (prop === "opacity" && invisibleOpacity) continue;
    if (prop === "size" && isZeroSize(properties[prop])) continue;
    const value = properties[prop];
    if (value === undefined || value === "") continue;
    // Values can come from merged data (e.g. `color: {{brandColor}}`) — sanitize
    // for the emission context:
    //  - "attr": inside style="…" — strip `;{}` (declaration injection) then
    //    HTML-escape so a `"` can't break out of the attribute (stored XSS).
    //  - "stylesheet": inside a <style> element — entities do NOT decode there,
    //    so instead strip `<>{};` (blocks `</style>` breakout and rule injection).
    const strValue =
      context === "attr"
        ? escapeHtml(String(value).replace(/[;{}]/g, ""))
        : String(value).replace(/[<>{};]/g, "");
    if (prop === "border" && strValue === "true") {
      styles.push("border: 1px solid currentColor");
    } else if (prop === "italic" && strValue === "true") {
      styles.push("font-style: italic");
    } else if (prop === "underline" && strValue === "true") {
      decorations.push("underline");
    } else if (prop === "strike" && strValue === "true") {
      decorations.push("line-through");
    } else if (prop !== "underline" && prop !== "strike") {
      styles.push(`${css}: ${strValue}`);
    }
  }
  // underline + strike combine into a single text-decoration declaration.
  if (decorations.length) styles.push(`text-decoration: ${decorations.join(" ")}`);
  return styles.join("; ");
}

/* ── Scoped document styles (`style:` blocks, v4.3) ───────────────────────────
 *
 * `style: <target> | color: … | weight: …` declares house styling for a block
 * type ONCE, document-wide — content lines stay clean and queryable. The value
 * vocabulary is the same constrained STYLE_PROPERTIES set (not arbitrary CSS).
 */

/** Block types a `style:` rule may target → their selectors in core's HTML. */
export const DOC_STYLE_TARGETS: Record<string, string[]> = {
  title: [".intent-title"],
  summary: [".intent-summary"],
  section: [".intent-section"],
  sub: [".intent-sub"],
  text: [".intent-text"],
  quote: [".intent-quote"],
  callout: [".intent-callout"],
  info: [".intent-callout"],
  table: [".intent-table-th", ".intent-table-td"],
  "table-header": [".intent-table-th"],
  metric: [".it-metric-row"],
  contact: [".it-contact"],
  divider: [".intent-divider"],
};

export interface DocumentStyleRule {
  /** Validated target name (a key of DOC_STYLE_TARGETS). */
  target: string;
  /** Sanitized CSS declarations, e.g. `color: #0a7; font-weight: 600`. */
  declarations: string;
}

/** Collect the document's `style:` rules (sanitized, unknown targets dropped). */
export function collectDocumentStyles(doc: IntentDocument): DocumentStyleRule[] {
  const rules: DocumentStyleRule[] = [];
  const walk = (blocks: IntentBlock[]) => {
    for (const b of blocks) {
      if (b.type === "style" && b.content) {
        const target = String(b.content).trim().toLowerCase();
        if (DOC_STYLE_TARGETS[target]) {
          const declarations = extractInlineStyles(
            b.properties || {},
            "stylesheet",
          );
          if (declarations) rules.push({ target, declarations });
        }
      }
      if (b.children) walk(b.children);
    }
  };
  walk(doc.blocks);
  return rules;
}

/**
 * Build the CSS for a document's `style:` rules. `selectorMap` lets a consumer
 * with different markup (e.g. the visual editor's `.it-doc-*` classes) reuse the
 * exact same collection/sanitization — single source of truth for what a rule
 * means. Defaults to core's own selectors.
 */
export function documentStyleCSS(
  doc: IntentDocument,
  selectorMap: Record<string, string[]> = DOC_STYLE_TARGETS,
  selectorPrefix = "",
): string {
  return collectDocumentStyles(doc)
    .map((rule) => {
      const sels = selectorMap[rule.target];
      if (!sels || sels.length === 0) return "";
      const scoped = sels.map((s) => `${selectorPrefix}${s}`).join(",");
      return `${scoped}{${rule.declarations};}`;
    })
    .filter(Boolean)
    .join("\n");
}

// Helper function to render a single block
function renderBlock(block: IntentBlock): string {
  // Pre-section metadata keywords — invisible in rendered output.
  // `style:` rules are document-level styling, rendered as CSS (documentStyleCSS),
  // never as body content.
  if (
    block.type === "agent" ||
    block.type === "model" ||
    block.type === "style"
  ) {
    return "";
  }

  const content = applyInlineFormatting(
    block.content,
    block.inline,
    block.originalContent,
  );
  // Read-time defaults applied here (the parser records only authored bytes).
  const props = effectiveProperties(block);
  const alignClass = getAlignmentClass(props);
  const inlineStyle = extractInlineStyles(props);
  const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : "";
  // Per-paragraph direction: a block carrying `dir: rtl|ltr|auto` renders RTL/LTR
  // independently of the document — so selecting some rows and turning on RTL
  // mirrors just those paragraphs (Word-style), without flipping the whole doc.
  const blockDir =
    props.dir === "rtl" || props.dir === "ltr" || props.dir === "auto"
      ? String(props.dir)
      : "";
  // Direction is CONTENT, never decoration — Arabic IS right-to-left — so it's
  // always honoured (kept in the bare/signed view too). In bare mode, blocks with
  // no explicit dir get dir="auto" so each paragraph's direction is derived from
  // its own characters: Arabic flows RTL, Latin flows LTR, even in a mixed doc and
  // even if the document was never flagged. Alignment then follows direction (the
  // CSS is logical — text-align:start/end), so dropping authored `align` is safe.
  const dirAttr = blockDir
    ? ` dir="${blockDir}"`
    : BARE_RENDER
      ? ` dir="auto"`
      : "";

  const { inner: splitContent, splitClass } = splitEnd(content, props);

  switch (block.type) {
    case "title":
      return `<h1 class="intent-title${alignClass}${splitClass}"${dirAttr}${styleAttr}>${splitContent}</h1>`;

    case "summary":
      return `<div class="intent-summary${alignClass}"${dirAttr}${styleAttr}>${content}</div>`;

    case "section":
      return `<h2 id="${slugify(block.content)}" class="intent-section${alignClass}${splitClass}"${dirAttr}${styleAttr}>${splitContent}</h2>`;

    case "sub":
      return `<h3 id="${slugify(block.content)}" class="intent-sub${alignClass}${splitClass}"${dirAttr}${styleAttr}>${splitContent}</h3>`;

    case "divider":
      const dividerStyle = props.style
        ? escapeHtml(String(props.style).replace(/[;{}"]/g, ""))
        : "solid";
      const label = content
        ? `<span class="intent-divider-label">${content}</span>`
        : "";
      return `<div class="intent-divider">
        <hr class="it-divider" style="border-style: ${dividerStyle}" />
        ${label}
      </div>`;

    case "text":
      return `<p class="intent-text${alignClass}${splitClass}"${dirAttr}${styleAttr}>${splitContent}</p>`;
    case "body-text":
      return `<p class="intent-prose${alignClass}${splitClass}"${dirAttr}${styleAttr}>${splitContent}</p>`;

    case "info": {
      const CALLOUT_VARIANTS: Record<string, string> = {
        info: "Note",
        warning: "Caution",
        danger: "Danger",
        tip: "Tip",
        success: "Done",
      };
      const subtype = (props.type as string) || "info";
      const variant = subtype in CALLOUT_VARIANTS ? subtype : "info";
      const label = CALLOUT_VARIANTS[variant];
      if (variant === "danger") {
        return `<div class="it-callout it-danger" role="alert"${styleAttr}><span class="it-callout-icon" aria-hidden="true">⛔</span><div class="it-callout-body">${content}</div></div>`;
      }
      return `<div class="intent-callout intent-${variant}"${styleAttr}><span class="intent-callout-label">${label}</span><div class="intent-callout-content">${content}</div></div>`;
    }

    case "task":
    case "done": {
      // "done" kept as legacy fallback for pre-1.1 JSON
      const isDone = props.status === "done" || block.type === "done";
      return `<div class="intent-task${isDone ? " intent-task-done" : ""}">
        <input class="intent-task-checkbox" type="checkbox"${isDone ? " checked" : ""} />
        <span class="intent-task-text${isDone ? " intent-task-text-done" : ""}">${content}</span>
        <span class="intent-task-meta">
          ${props.owner ? `<span class="intent-task-owner" dir="auto">${escapeHtml(String(props.owner))}</span>` : ""}
          ${props.due ? `<span class="intent-task-due" dir="auto">${escapeHtml(String(props.due))}</span>` : ""}
          ${props.time ? `<span class="intent-task-time" dir="auto">${escapeHtml(String(props.time))}</span>` : ""}
        </span>
      </div>`;
    }

    case "ask":
      return `<div class="intent-ask"><span class="intent-ask-label">Query</span><div class="intent-ask-content">${content}</div></div>`;

    case "quote": {
      const attribution = props.by
        ? `<cite class="intent-quote-cite">— ${escapeHtml(String(props.by))}</cite>`
        : "";
      return `<blockquote class="intent-quote"><p>${content}</p>${attribution}</blockquote>`;
    }

    case "cite": {
      const citeAuthor = props.author
        ? `<span class="it-cite-author">${escapeHtml(String(props.author))}</span>`
        : "";
      const citeDate = props.date
        ? `<span class="it-cite-date">${escapeHtml(String(props.date))}</span>`
        : "";
      const citeUrl = props.url
        ? ` href="${escapeHtml(sanitizeUrl(String(props.url)))}"`
        : "";
      const citeTitle = citeUrl
        ? `<a class="it-cite-title"${citeUrl} target="_blank" rel="noopener noreferrer">${content}</a>`
        : `<span class="it-cite-title">${content}</span>`;
      return `<div class="it-cite">${citeTitle}${citeAuthor ? ` — ${citeAuthor}` : ""}${citeDate ? `, ${citeDate}` : ""}</div>`;
    }

    case "image":
      const imgSrc = escapeHtml(
        sanitizeUrl(String(props.src ?? props.at ?? "")) ||
          String(props.src ?? props.at ?? content),
      );
      const imgAlt = content;
      return `<figure class="intent-image">
        <img class="intent-image-img" src="${imgSrc}" alt="${imgAlt}" />
        ${props.caption ? `<figcaption class="intent-image-caption">${escapeHtml(String(props.caption))}</figcaption>` : ""}
      </figure>`;

    case "link":
      const href = escapeHtml(sanitizeUrl(String(props.to || content)));
      const titleAttr = props.title
        ? `title="${escapeHtml(String(props.title))}"`
        : "";
      return `<p class="intent-link"><a href="${href}" ${titleAttr}>${content}</a></p>`;

    case "ref": {
      const refFile = props.file ? String(props.file) : "";
      const refUrl = props.url ? String(props.url) : "";
      const refRel = props.rel ? escapeHtml(String(props.rel)) : "";
      const refHref = refFile
        ? escapeHtml(sanitizeUrl(refFile))
        : refUrl
          ? escapeHtml(sanitizeUrl(refUrl))
          : "";
      const refName = escapeHtml(block.content || refFile || refUrl);
      const relBadge = refRel
        ? `<span class="it-ref-rel">${refRel}</span>`
        : "";
      const linkEl = refHref
        ? `<a href="${refHref}" class="it-ref-link">${refName}</a>`
        : `<span class="it-ref-name">${refName}</span>`;
      return `<div class="it-ref-card">
        <span class="it-ref-icon">📎</span>
        ${linkEl}
        ${relBadge}
      </div>`;
    }

    case "embed": {
      const embedType = props.type || "iframe";
      const src = String(props.src || "");
      const embedContent = String(props.content || "");

      switch (embedType) {
        case "iframe":
          return `<div class="intent-embed"><iframe src="${escapeHtml(sanitizeUrl(src))}" frameborder="0" loading="lazy" style="width:100%;min-height:400px;border-radius:8px;"></iframe></div>`;
        case "mermaid":
          // Mermaid reads the element's textContent, so escaping is both safe
          // and correct — the library still sees the original diagram source.
          return `<div class="intent-embed mermaid">${escapeHtml(embedContent)}</div>`;
        case "svg":
          // Keep the vector graphic but strip any executable content.
          return `<div class="intent-embed svg">${sanitizeSvg(embedContent)}</div>`;
        case "video":
          return `<div class="intent-embed video"><video src="${escapeHtml(sanitizeUrl(src))}" controls style="max-width:100%;border-radius:8px;"></video></div>`;
        case "audio":
          return `<div class="intent-embed audio"><audio src="${escapeHtml(sanitizeUrl(src))}" controls style="width:100%;"></audio></div>`;
        default:
          return `<div class="intent-embed unknown">${escapeHtml(embedContent || src)}</div>`;
      }
    }

    case "code":
      return `<pre class="intent-code"><code>${escapeHtml(block.content)}</code></pre>`;

    case "table": {
      const headers = block.table?.headers;
      const rows = block.table?.rows || [];

      const thead = headers
        ? `<thead><tr>${headers
            .map((h) => `<th class="intent-table-th" scope="col" dir="auto">${escapeHtml(h)}</th>`)
            .join("")}</tr></thead>`
        : "";

      const tbody = `<tbody>${renderTableRows(rows)}</tbody>`;

      return `<table class="intent-table">${thead}${tbody}</table>`;
    }

    case "list-item": {
      const listItemProps = block.properties || {};
      const listItemMeta = [
        listItemProps.owner &&
          `<span class="intent-task-owner" dir="auto">${escapeHtml(String(listItemProps.owner))}</span>`,
        listItemProps.due &&
          `<span class="intent-task-due" dir="auto">${escapeHtml(String(listItemProps.due))}</span>`,
      ]
        .filter(Boolean)
        .join(" ");
      return `<li class="intent-list-item">${content}${listItemMeta ? ` <span class="intent-task-meta">${listItemMeta}</span>` : ""}</li>`;
    }

    case "step-item":
      return `<li class="intent-step-item">${content}</li>`;

    // ─── v2 Agentic Workflow Blocks ────────────────────────────────────

    case "step": {
      const statusVal = String(props.status || "pending");
      const statusClass = `intent-status-${statusVal}`;
      const toolBadge = props.tool
        ? `<span class="intent-badge intent-badge-tool">${escapeHtml(String(props.tool))}</span>`
        : "";
      const statusBadge = `<span class="intent-badge ${statusClass}">${escapeHtml(statusVal)}</span>`;
      const dependsArrow = props.depends
        ? `<span class="intent-step-depends">⤷ ${escapeHtml(String(props.depends))}</span>`
        : "";
      const stepId = props.id
        ? `<span class="intent-step-id">${escapeHtml(String(props.id))}</span>`
        : "";
      return `<div class="intent-step">
        <span class="intent-step-icon">▶</span>
        <span class="intent-step-content">${content}</span>
        <span class="intent-step-meta">${stepId}${toolBadge}${statusBadge}${dependsArrow}</span>
      </div>`;
    }

    case "decision": {
      const ifExpr = props.if ? escapeHtml(String(props.if)) : "";
      const thenTarget = props.then ? escapeHtml(String(props.then)) : "";
      const elseTarget = props.else ? escapeHtml(String(props.else)) : "";
      return `<div class="intent-decision">
        <div class="intent-decision-diamond"></div>
        <div class="intent-decision-body">
          <div class="intent-decision-label">${content}</div>
          ${ifExpr ? `<div class="intent-decision-condition"><strong>if</strong> ${ifExpr}</div>` : ""}
          <div class="intent-decision-branches">
            ${thenTarget ? `<span class="intent-decision-then">✓ then → ${thenTarget}</span>` : ""}
            ${elseTarget ? `<span class="intent-decision-else">✗ else → ${elseTarget}</span>` : ""}
          </div>
        </div>
      </div>`;
    }

    case "trigger": {
      const eventBadge = props.event
        ? `<span class="intent-badge intent-badge-event">${escapeHtml(String(props.event))}</span>`
        : "";
      return `<div class="intent-trigger">
        <span class="intent-trigger-icon">⚡</span>
        <span class="intent-trigger-content">${content}</span>
        ${eventBadge}
      </div>`;
    }

    case "loop": {
      const overVal = props.over ? escapeHtml(String(props.over)) : "";
      const doVal = props.do ? escapeHtml(String(props.do)) : "";
      return `<div class="intent-loop">
        <span class="intent-loop-icon">🔁</span>
        <span class="intent-loop-content">${content}</span>
        ${overVal ? `<span class="intent-loop-over">over: ${overVal}</span>` : ""}
        ${doVal ? `<span class="intent-loop-do">do: ${doVal}</span>` : ""}
      </div>`;
    }

    case "checkpoint":
      return `<div class="intent-checkpoint">
        <span class="intent-checkpoint-flag">🚩</span>
        <span class="intent-checkpoint-label">${content}</span>
        <hr class="intent-checkpoint-line" />
      </div>`;

    case "audit":
      return `<div class="intent-audit"><span class="intent-audit-prefix">audit:</span> ${content}${props.by ? ` | by: ${escapeHtml(String(props.by))}` : ""}${props.at ? ` | at: ${escapeHtml(String(props.at))}` : ""}</div>`;

    case "error": {
      const fallbackInfo = props.fallback
        ? `<span class="intent-error-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      const notifyInfo = props.notify
        ? `<span class="intent-error-notify">notify: ${escapeHtml(String(props.notify))}</span>`
        : "";
      return `<div class="intent-callout intent-error-block"><span class="intent-callout-label">Error</span><div class="intent-callout-content">${content} ${fallbackInfo} ${notifyInfo}</div></div>`;
    }

    case "context": {
      // Render as a small key-value table
      const ctxEntries = Object.entries(props);
      if (ctxEntries.length === 0) {
        return `<div class="intent-context"><code>${content}</code></div>`;
      }
      const ctxRows = ctxEntries
        .map(
          ([k, v]) =>
            `<tr><td class="intent-context-key" dir="auto">${escapeHtml(k)}</td><td class="intent-context-val" dir="auto">${escapeHtml(String(v))}</td></tr>`,
        )
        .join("");
      return `<table class="intent-context-table"><tbody>${ctxRows}</tbody></table>`;
    }

    case "progress": {
      // Parse "X/Y" from content or use value/total properties
      let value = 0;
      let total = 100;
      const progressMatch = block.content.match(/(\d+)\s*\/\s*(\d+)/);
      if (progressMatch) {
        value = parseInt(progressMatch[1], 10);
        total = parseInt(progressMatch[2], 10);
      }
      if (props.value) value = Number(props.value);
      if (props.total) total = Number(props.total);
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return `<div class="intent-progress">
        <span class="intent-progress-label">${content}</span>
        <div class="intent-progress-bar"><div class="intent-progress-fill" style="width:${pct}%"></div></div>
        <span class="intent-progress-pct">${pct}%</span>
      </div>`;
    }

    case "import": {
      const asAlias = props.as ? ` as ${escapeHtml(String(props.as))}` : "";
      return `<div class="intent-file-ref intent-import"><span class="intent-file-ref-icon">📥</span> import: ${content}${asAlias}</div>`;
    }

    case "export": {
      const fmt = props.format ? ` (${escapeHtml(String(props.format))})` : "";
      return `<div class="intent-file-ref intent-export"><span class="intent-file-ref-icon">📤</span> export: ${content}${fmt}</div>`;
    }

    // ─── v2.1 Agentic Workflow Blocks ──────────────────────────────────

    case "signal": {
      const phase = props.phase
        ? `<span class="intent-signal-phase">${escapeHtml(String(props.phase))}</span>`
        : "";
      const levelBadge = props.level
        ? `<span class="intent-badge intent-badge-level">${escapeHtml(String(props.level))}</span>`
        : "";
      return `<div class="intent-signal-block">
        <span class="intent-signal-icon">📡</span>
        <span class="intent-signal-content">${content}</span>
        <span class="intent-signal-meta">${phase}${levelBadge}</span>
      </div>`;
    }

    case "result": {
      const statusVal = String(props.status || "success");
      const statusClass = `intent-result-${statusVal}`;
      const codeBadge = props.code
        ? `<span class="intent-badge intent-badge-code">${escapeHtml(String(props.code))}</span>`
        : "";
      const dataInfo = props.data
        ? `<div class="intent-result-data"><code>${escapeHtml(String(props.data))}</code></div>`
        : "";
      return `<div class="intent-result ${statusClass}">
        <span class="intent-result-icon">✅</span>
        <span class="intent-result-content">${content}</span>
        ${codeBadge}
        ${dataInfo}
      </div>`;
    }

    case "handoff": {
      const fromAgent = props.from
        ? `<span class="intent-handoff-agent intent-handoff-from">${escapeHtml(String(props.from))}</span>`
        : "";
      const toAgent = props.to
        ? `<span class="intent-handoff-agent intent-handoff-to">${escapeHtml(String(props.to))}</span>`
        : "";
      const arrow =
        fromAgent || toAgent
          ? `<span class="intent-handoff-arrow">${fromAgent} → ${toAgent}</span>`
          : "";
      return `<div class="intent-handoff">
        <span class="intent-handoff-icon">🤝</span>
        <span class="intent-handoff-content">${content}</span>
        ${arrow}
      </div>`;
    }

    case "wait": {
      const onVal = props.on
        ? `<span class="intent-badge intent-badge-event">${escapeHtml(String(props.on))}</span>`
        : "";
      const timeoutVal = props.timeout
        ? `<span class="intent-badge intent-badge-timeout">${escapeHtml(String(props.timeout))}</span>`
        : "";
      const fallbackVal = props.fallback
        ? `<span class="intent-wait-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      return `<div class="intent-wait">
        <span class="intent-wait-icon">⏳</span>
        <span class="intent-wait-content">${content}</span>
        <span class="intent-wait-meta">${onVal}${timeoutVal}${fallbackVal}</span>
      </div>`;
    }

    case "parallel": {
      const stepsVal = props.steps
        ? String(props.steps)
            .split(",")
            .map((s) => s.trim())
        : [];
      const stepBadges =
        stepsVal.length > 0
          ? stepsVal
              .map(
                (s) =>
                  `<span class="intent-badge intent-badge-parallel-step">${escapeHtml(s)}</span>`,
              )
              .join("")
          : "";
      const joinBadge = props.join
        ? `<span class="intent-badge intent-badge-join">join: ${escapeHtml(String(props.join))}</span>`
        : "";
      return `<div class="intent-parallel">
        <span class="intent-parallel-icon">⏩</span>
        <span class="intent-parallel-content">${content}</span>
        <span class="intent-parallel-steps">${stepBadges}${joinBadge}</span>
      </div>`;
    }

    case "retry": {
      const maxVal = props.max
        ? `<span class="intent-badge intent-badge-retry-max">max: ${escapeHtml(String(props.max))}</span>`
        : "";
      const delayVal = props.delay
        ? `<span class="intent-badge intent-badge-retry-delay">delay: ${escapeHtml(String(props.delay))}ms</span>`
        : "";
      const backoffVal = props.backoff
        ? `<span class="intent-badge intent-badge-retry-backoff">${escapeHtml(String(props.backoff))}</span>`
        : "";
      return `<div class="intent-retry">
        <span class="intent-retry-icon">🔄</span>
        <span class="intent-retry-content">${content}</span>
        <span class="intent-retry-meta">${maxVal}${delayVal}${backoffVal}</span>
      </div>`;
    }

    // ─── v2.2 Agentic Workflow Blocks ──────────────────────────────────

    case "gate": {
      const approverBadge = props.approver
        ? `<span class="intent-badge intent-badge-approver">${escapeHtml(String(props.approver))}</span>`
        : "";
      const timeoutBadge = props.timeout
        ? `<span class="intent-badge intent-badge-timeout">${escapeHtml(String(props.timeout))}</span>`
        : "";
      const fallbackInfo = props.fallback
        ? `<span class="intent-gate-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      return `<div class="intent-gate">
        <div class="intent-gate-icon">🛑</div>
        <div class="intent-gate-body">
          <div class="intent-gate-label">${content}</div>
          <div class="intent-gate-meta">${approverBadge}${timeoutBadge}${fallbackInfo}</div>
        </div>
      </div>`;
    }

    case "call": {
      const inputVal = props.input
        ? `<span class="intent-call-input">input: ${escapeHtml(String(props.input))}</span>`
        : "";
      const outputVal = props.output
        ? `<span class="intent-call-output">output: ${escapeHtml(String(props.output))}</span>`
        : "";
      return `<div class="intent-call">
        <span class="intent-call-icon">📞</span>
        <span class="intent-call-content">${content}</span>
        <span class="intent-call-meta">${inputVal}${outputVal}</span>
      </div>`;
    }

    // ─── v2.7 Agentic Workflow Blocks ──────────────────────────────────

    case "policy": {
      const conditions: string[] = [];
      if (props.if)
        conditions.push(
          `<span class="it-policy-condition">if ${escapeHtml(String(props.if))}</span>`,
        );
      if (props.always)
        conditions.push(
          `<span class="it-policy-always">always: ${escapeHtml(String(props.always))}</span>`,
        );
      if (props.never)
        conditions.push(
          `<span class="it-policy-never">never: ${escapeHtml(String(props.never))}</span>`,
        );
      if (props.action)
        conditions.push(
          `<span class="it-policy-action">→ ${escapeHtml(String(props.action))}</span>`,
        );
      if (props.requires)
        conditions.push(
          `<span class="it-policy-requires">requires: ${escapeHtml(String(props.requires))}</span>`,
        );
      if (props.notify)
        conditions.push(
          `<span class="it-policy-notify">notify: ${escapeHtml(String(props.notify))}</span>`,
        );
      return `<div class="it-block it-policy">
        <div class="it-policy-name">${content}</div>
        <div class="it-policy-rules">${conditions.join(" ")}</div>
      </div>`;
    }

    case "input": {
      // A FORM FIELD (see forms.ts): a fillable box, NOT an author-side {{merge}}
      // variable. It renders the captured `value:` when filled and an empty box
      // when blank — so the same line is a printable blank form AND, once every
      // required field is filled, a final signable record.
      const fieldType = (
        props.type != null ? String(props.type) : "text"
      ).toLowerCase();
      const safeType = escapeHtml(fieldType);
      const required = /^(yes|true|on|1|required|checked|x)$/i.test(
        String(props.required ?? "").trim(),
      );
      // Fall back to `default:` (legacy merge-template inputs) when no answer yet.
      const rawValue =
        props.value != null
          ? String(props.value)
          : props.default != null
            ? String(props.default)
            : "";
      const isDefault = props.value == null && props.default != null;
      const hasValue = rawValue.trim().length > 0;
      const keyAttr =
        props.key != null ? ` data-key="${escapeHtml(String(props.key))}"` : "";
      const dataAttrs = `${keyAttr} data-type="${safeType}"${required ? ' data-required="true"' : ""}`;
      const labelHtml = `<span class="it-input-name it-field-label">${content}${required ? '<span class="it-field-req">*</span>' : ""}</span>`;
      // Layout width (presentation): a validated CSS length → a flex-basis so two
      // narrow fields share the row. Rejected if it isn't a plain length (no CSS
      // injection from source).
      const widthRaw = props.width != null ? String(props.width).trim() : "";
      const widthStyle = /^[0-9]+(\.[0-9]+)?(%|px|em|rem|ch|vw)?$/.test(widthRaw)
        ? ` style="flex:0 1 calc(${widthRaw} - 8px);min-width:0"`
        : "";

      if (fieldType === "checkbox") {
        const checked = /^(yes|true|on|1|checked|x)$/i.test(rawValue.trim());
        return `<div class="it-input it-field it-field-checkbox"${dataAttrs}${widthStyle}><span class="it-field-check${checked ? " checked" : ""}" aria-hidden="true"></span>${labelHtml}</div>`;
      }
      if (fieldType === "signature") {
        const inner = hasValue
          ? `<span class="it-field-value">${escapeHtml(rawValue)}</span>`
          : "";
        return `<div class="it-input it-field it-field-signature"${dataAttrs}${widthStyle}><span class="it-field-box it-field-sig">${inner}</span>${labelHtml}</div>`;
      }
      const options = String(props.options ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const boxInner = hasValue
        ? `<span class="it-field-value${isDefault ? " it-field-default" : ""}">${escapeHtml(rawValue)}</span>`
        : fieldType === "choice" && options.length
          ? `<span class="it-field-hint">${escapeHtml(options.join("  /  "))}</span>`
          : "";
      return `<div class="it-input it-field it-field-${safeType}"${dataAttrs}${widthStyle}>${labelHtml}<span class="it-field-box it-field-box-${safeType} ${hasValue ? "filled" : "blank"}">${boxInner}</span></div>`;
    }

    case "output": {
      const outputType = props.type ? escapeHtml(String(props.type)) : "any";
      const outputFormat = props.format
        ? `<span class="it-output-format">${escapeHtml(String(props.format))}</span>`
        : "";
      return `<div class="it-output"><span class="it-output-name">${content}</span><span class="it-output-type">${outputType}</span>${outputFormat}</div>`;
    }

    case "tool": {
      const toolApi = props.api
        ? `<code class="it-tool-api">${escapeHtml(String(props.api))}</code>`
        : "";
      const toolMethod = props.method
        ? `<span class="it-tool-method">${escapeHtml(String(props.method))}</span>`
        : "";
      return `<div class="it-tool"><span class="it-tool-name">${content}</span>${toolApi}${toolMethod}</div>`;
    }

    case "prompt": {
      const promptModel = props.model
        ? `<span class="it-prompt-model">${escapeHtml(String(props.model))}</span>`
        : "";
      return `<div class="it-prompt">${promptModel}<div class="it-prompt-content">${content}</div></div>`;
    }

    case "memory": {
      const memoryScope = props.scope
        ? escapeHtml(String(props.scope))
        : "session";
      return `<div class="it-memory"><span class="it-memory-scope">${memoryScope}</span><span class="it-memory-content">${content}</span></div>`;
    }

    case "assert": {
      const expectExpr = props.expect
        ? `<code class="it-assert-expect">${escapeHtml(String(props.expect))}</code>`
        : "";
      const severity = props.severity
        ? escapeHtml(String(props.severity))
        : "error";
      return `<div class="it-assert it-assert-${severity}"><span class="it-assert-label">ASSERT</span><span class="it-assert-content">${content}</span>${expectExpr}</div>`;
    }

    case "secret":
      // Secrets are NEVER rendered — always redacted
      return `<div class="it-secret"><span class="it-secret-label">SECRET</span><span class="it-secret-value">${"\u2022".repeat(8)}</span></div>`;

    // ─── v2.5 Document Generation Blocks ─────────────────────────────

    case "font":
      // Layout declaration — not rendered visually
      return "";

    case "page":
      // Layout declaration — not rendered visually
      return "";

    case "break":
      // Invisible in web output; forces page break in print only
      return `<div class="it-page-break" aria-hidden="true" style="display:none"></div>`;

    case "history":
      // history: keyword produces no rendered output
      return "";

    case "byline": {
      const author = content;
      const date = props.date ? escapeHtml(String(props.date)) : "";
      const publication = props.publication
        ? escapeHtml(String(props.publication))
        : "";
      const role = props.role ? escapeHtml(String(props.role)) : "";
      const metaParts = [role, date, publication].filter(Boolean);
      return `<div class="it-byline"><span class="it-byline-author">${author}</span>${metaParts.length > 0 ? `<span class="it-byline-meta">${metaParts.join(" · ")}</span>` : ""}</div>`;
    }

    case "epigraph": {
      const by = props.by
        ? `<span class="it-epigraph-by">— ${escapeHtml(String(props.by))}</span>`
        : "";
      return `<blockquote class="it-epigraph"><p>${content}</p>${by}</blockquote>`;
    }

    case "caption":
      return `<figcaption class="it-caption">${content}</figcaption>`;

    case "footnote":
      // Collected by renderBlocks — rendered at end in footnotes section
      return "";

    case "toc":
      // Placeholder — actual TOC is built by renderBlocks scanning sections
      return "";

    case "dedication":
      return `<div class="it-dedication">${content}</div>`;

    // ─── v2.8 Document Trust Blocks ────────────────────────────────────

    case "track":
      // Invisible — metadata only, not rendered
      return "";

    case "meta":
      // Invisible — metadata only, not rendered
      return "";

    // ─── v2.9 Print Layout Blocks (invisible in web output) ──────────

    case "header":
      return "";
    case "footer":
      return "";
    case "watermark":
      return "";

    case "approve": {
      const approveBy = props.by ? escapeHtml(String(props.by)) : "Unknown";
      const approveRole = props.role ? escapeHtml(String(props.role)) : "";
      const approveAt = props.at ? formatTrustDate(String(props.at)) : "";
      // Grid (content | date) keeps the date anchored top-right so a long
      // approval never spills the date onto its own second line.
      return `<div class="it-approval">
        <div class="it-approval__main">
          <span class="it-approval__label">Approved</span>${
            content ? `<span class="it-approval__what">${content}</span>` : ""
          }${
            approveBy
              ? `<span class="it-approval__who">${approveBy}${approveRole ? `, ${approveRole}` : ""}</span>`
              : ""
          }
        </div>
        ${approveAt ? `<span class="it-approval__date">${approveAt}</span>` : ""}
      </div>`;
    }

    // sign: / freeze: render NOTHING inline — they're consolidated into the single
    // trust BAND/stamp (renderTrustBand), so the signer/seal info appears once, in
    // the corner, without a duplicate block taking content space.
    case "sign":
      return "";

    case "freeze":
      return "";

    // certify: — an authority record, consolidated into the trust band like
    // sign:/freeze: (FORMAT-REVIEW T-02). Never rendered inline.
    case "certify":
      return "";

    // route:/require: — the approval policy renders ONCE as the approval-route
    // panel (renderApprovalRoute, injected by renderBlocks), not as raw lines.
    case "route":
    case "require":
      return "";

    case "revision":
      // Should never appear above the history boundary — render as muted if somehow present
      return "";

    // ─── v2.11 Keyword Expansion ───────────────────────────────────────

    case "def": {
      const meaning = props.meaning ? escapeHtml(String(props.meaning)) : "";
      const abbr = props.abbr
        ? ` <span class="it-def-abbr">(${escapeHtml(String(props.abbr))})</span>`
        : "";
      return `<div class="it-def">
        <dt class="it-def-term">${content}${abbr}</dt>
        <dd class="it-def-meaning">${meaning}</dd>
      </div>`;
    }

    case "metric": {
      const val = props.value != null ? escapeHtml(String(props.value)) : "";
      const unit = props.unit ? escapeHtml(String(props.unit)) : "";
      const target = props.target != null ? String(props.target) : "";
      const trend = props.trend ? String(props.trend) : "";
      const period = props.period ? escapeHtml(String(props.period)) : "";

      // A dashboard KPI (has target / trend / period) renders as a boxed card.
      // Everything else is a document total/line (invoice, receipt, statement) and
      // renders as a label-left / value-right row — matching the editor's `itMetric`
      // node, so a template designed in the editor prints identically through core.
      if (!target && !trend && !period) {
        const isTotal = /\b(total|balance due|amount due|grand)\b/i.test(
          String(block.content || ""),
        );
        const valueText = [val, unit].filter(Boolean).join(" ");
        return `<div class="it-metric-row${isTotal ? " it-metric-row--total" : ""}">
        <span class="it-metric-row__label">${content}</span>
        <span class="it-metric-row__value" dir="auto">${valueText}</span>
      </div>`;
      }

      const trendIcon =
        trend === "up"
          ? "↑"
          : trend === "down"
            ? "↓"
            : trend === "stable"
              ? "→"
              : "";
      let colorClass = "it-metric-neutral";
      if (target && val) {
        colorClass =
          Number(val) >= Number(target) ? "it-metric-green" : "it-metric-red";
      }

      return `<div class="it-metric ${colorClass}">
        <div class="it-metric-name">${content}</div>
        <div class="it-metric-value" dir="auto">${val}<span class="it-metric-unit">${unit}</span></div>
        ${target ? `<div class="it-metric-target">Target: ${escapeHtml(target)}</div>` : ""}
        ${trendIcon ? `<div class="it-metric-trend">${trendIcon}</div>` : ""}
        ${period ? `<div class="it-metric-period">${period}</div>` : ""}
      </div>`;
    }

    case "amendment": {
      const amendRef = props.ref ? escapeHtml(String(props.ref)) : "";
      const amendSection = props.section
        ? escapeHtml(String(props.section))
        : "";
      const amendWas = props.was ? escapeHtml(String(props.was)) : "";
      const amendNow = props.now ? escapeHtml(String(props.now)) : "";
      const amendBy = props.by ? escapeHtml(String(props.by)) : "";
      const amendAt = props.at ? formatTrustDate(String(props.at)) : "";
      return `<div class="it-amendment">
        <div class="it-amendment-header">
          <span class="it-amendment-icon">✏️</span>
          <span class="it-amendment-ref">${amendRef}</span>
          <span class="it-amendment-title">${content}</span>
        </div>
        ${amendSection ? `<div class="it-amendment-section">Section: ${amendSection}</div>` : ""}
        ${amendWas ? `<div class="it-amendment-was">Was: ${amendWas}</div>` : ""}
        ${amendNow ? `<div class="it-amendment-now">Now: ${amendNow}</div>` : ""}
        <div class="it-amendment-meta">
          ${amendBy ? `<span class="it-amendment-by">${amendBy}</span>` : ""}
          ${amendAt ? `<span class="it-amendment-at">${amendAt}</span>` : ""}
        </div>
      </div>`;
    }

    case "figure": {
      const figSrc = props.src
        ? escapeHtml(sanitizeUrl(String(props.src)))
        : "";
      const figCaption = props.caption ? escapeHtml(String(props.caption)) : "";
      const figNum = props.num ? escapeHtml(String(props.num)) : "";
      const figWidth = props.width
        ? `width:${escapeHtml(String(props.width))};`
        : "";
      const figAlign = props.align ? String(props.align) : "center";
      const figAlt = props.alt
        ? escapeHtml(String(props.alt))
        : escapeHtml(block.content);
      const numPrefix = figNum ? `Figure ${figNum}: ` : "";
      return `<figure class="it-figure" style="text-align:${escapeHtml(figAlign)};">
        ${figSrc ? `<img src="${figSrc}" alt="${figAlt}" style="${figWidth}max-width:100%;" />` : ""}
        <figcaption class="it-figure-caption">${numPrefix}${figCaption}</figcaption>
      </figure>`;
    }

    case "signline": {
      const sigLabel = props.label
        ? escapeHtml(String(props.label))
        : "Signature";
      const sigRole = props.role ? escapeHtml(String(props.role)) : "";
      const sigDateLine = String(props["date-line"]) === "true";
      const sigWidth = props.width ? escapeHtml(String(props.width)) : "60%";
      return `<div class="it-signline" style="width:${sigWidth};">
        <div class="it-signline-label">${sigLabel}</div>
        <div class="it-signline-rule"></div>
        <div class="it-signline-name">${content}</div>
        ${sigRole ? `<div class="it-signline-role">${sigRole}</div>` : ""}
        ${sigDateLine ? `<div class="it-signline-date">Date: _______________</div>` : ""}
      </div>`;
    }

    case "contact": {
      const cRole = props.role ? escapeHtml(String(props.role)) : "";
      const cEmail = props.email ? String(props.email) : "";
      const cPhone = props.phone ? String(props.phone) : "";
      const cOrg = props.org ? escapeHtml(String(props.org)) : "";
      const cUrl2 = props.url ? String(props.url) : "";
      return `<div class="it-contact">
        <div class="it-contact-name">${content}</div>
        ${cRole ? `<div class="it-contact-role">${cRole}</div>` : ""}
        ${cOrg ? `<div class="it-contact-org">${cOrg}</div>` : ""}
        ${cEmail ? `<div class="it-contact-email" dir="auto"><a href="mailto:${escapeHtml(cEmail)}">${escapeHtml(cEmail)}</a></div>` : ""}
        ${cPhone ? `<div class="it-contact-phone" dir="auto"><a href="tel:${escapeHtml(cPhone)}">${escapeHtml(cPhone)}</a></div>` : ""}
        ${cUrl2 ? `<div class="it-contact-url"><a href="${escapeHtml(sanitizeUrl(cUrl2))}">${escapeHtml(cUrl2)}</a></div>` : ""}
      </div>`;
    }

    case "deadline": {
      const dlDate = props.date ? String(props.date) : "";
      const dlConsequence = props.consequence
        ? escapeHtml(String(props.consequence))
        : "";
      const dlAuthority = props.authority
        ? escapeHtml(String(props.authority))
        : "";
      const dlOwner = props.owner ? escapeHtml(String(props.owner)) : "";

      let dlColorClass = "it-deadline-green";
      if (dlDate) {
        const dlDateObj = new Date(dlDate);
        if (!isNaN(dlDateObj.getTime())) {
          const daysUntil =
            (dlDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntil < 7) dlColorClass = "it-deadline-red";
          else if (daysUntil < 30) dlColorClass = "it-deadline-amber";
        }
      }

      return `<div class="it-deadline ${dlColorClass}">
        <div class="it-deadline-name">${content}</div>
        ${dlDate ? `<div class="it-deadline-date" dir="auto">${escapeHtml(dlDate)}</div>` : ""}
        ${dlConsequence ? `<div class="it-deadline-consequence">${dlConsequence}</div>` : ""}
        ${dlOwner ? `<div class="it-deadline-owner">${dlOwner}</div>` : ""}
        ${dlAuthority ? `<div class="it-deadline-authority">${dlAuthority}</div>` : ""}
      </div>`;
    }

    // Unknown x-ns: extensions that aren't in the registry
    case "extension": {
      const xType = props["x-type"]
        ? escapeHtml(String(props["x-type"]))
        : "unknown";
      const xNs = props["x-ns"] ? escapeHtml(String(props["x-ns"])) : "ext";
      return `<div class="it-extension it-ext-${xNs} it-ext-${xType}" data-x-type="${xType}" data-x-ns="${xNs}"${styleAttr}>${content}</div>`;
    }

    // `math: E = mc^2` — a display equation. Core MARKS it (stays dependency-free);
    // @dotit/math renders the data-tex placeholder. Other custom blocks fall through.
    case "custom": {
      if (props.keyword === "math") {
        const tex = escapeHtml(String(block.content ?? ""));
        return `<div class="it-math-block" data-tex="${tex}">${tex}</div>`;
      }
      // The open vocabulary is first-class: show the author's OWN keyword (not a generic
      // "custom"), expose it via data-keyword, and add a per-keyword class so CSS/`style:`
      // can target it. e.g. `clause:` → [clause], `.intent-custom-clause`, data-keyword="clause".
      const kw = props.keyword != null ? String(props.keyword) : block.type;
      const kwLabel = escapeHtml(kw);
      const kwClass = kw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return `<div class="intent-unknown${kwClass ? ` intent-custom-${kwClass}` : ""}" data-keyword="${kwLabel}">
        <small class="intent-unknown-type">[${kwLabel}]</small> ${content}
      </div>`;
    }

    default:
      return `<div class="intent-unknown">
        <small class="intent-unknown-type">[${block.type}]</small> ${content}
      </div>`;
  }
}

// Helper to slug-ify a section title for anchor links
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Collect all section/sub blocks from a document for TOC
function collectSections(
  blocks: IntentBlock[],
  depth: number,
): Array<{ level: number; content: string; slug: string }> {
  const entries: Array<{ level: number; content: string; slug: string }> = [];
  for (const block of blocks) {
    if (block.type === "section") {
      entries.push({
        level: 1,
        content: block.content,
        slug: slugify(block.content),
      });
      if (depth >= 2 && block.children) {
        for (const child of block.children) {
          if (child.type === "sub") {
            entries.push({
              level: 2,
              content: child.content,
              slug: slugify(child.content),
            });
          }
        }
      }
    }
  }
  return entries;
}

// Collect all footnote blocks from a flat list + nested children
function collectFootnotes(blocks: IntentBlock[]): IntentBlock[] {
  const footnotes: IntentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "footnote") footnotes.push(block);
    if (block.children) footnotes.push(...collectFootnotes(block.children));
  }
  return footnotes;
}

// Render a list of blocks, properly grouping consecutive list/step items
// and recursing into section/sub children.
function renderBlocks(
  blocks: IntentBlock[],
  allBlocks?: IntentBlock[],
  routeCtx?: { panel: string; injected: { v: boolean } },
): string {
  const topBlocks = allBlocks || blocks;
  let html = "";
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Approval-route panel: inject ONCE, at the first route:/require: block in
    // document order (the blocks themselves render nothing — see renderBlock).
    if (
      routeCtx &&
      !routeCtx.injected.v &&
      (block.type === "route" || block.type === "require")
    ) {
      html += routeCtx.panel;
      routeCtx.injected.v = true;
    }

    // TOC block — generate from all sections in the document
    if (block.type === "toc") {
      const depth = Number(block.properties?.depth || 2);
      const title = String(block.properties?.title || "Contents");
      const entries = collectSections(topBlocks, depth);
      let tocHtml = `<nav class="it-toc"><h2 class="it-toc-title">${escapeHtml(title)}</h2><ol>`;
      for (const entry of entries) {
        const indent = entry.level === 2 ? ' class="it-toc-sub"' : "";
        tocHtml += `<li${indent}><a href="#${entry.slug}">${escapeHtml(entry.content)}</a></li>`;
      }
      tocHtml += `</ol></nav>`;
      html += tocHtml;
      i++;
      continue;
    }

    // Collect consecutive list-item blocks into a single <ul>
    if (block.type === "list-item") {
      html += '<ul class="intent-list">';
      while (i < blocks.length && blocks[i].type === "list-item") {
        html += renderBlock(blocks[i]);
        i++;
      }
      html += "</ul>";
      continue;
    }

    // Collect consecutive step-item blocks into a single <ol>
    if (block.type === "step-item") {
      html += '<ol class="intent-list">';
      while (i < blocks.length && blocks[i].type === "step-item") {
        html += renderBlock(blocks[i]);
        i++;
      }
      html += "</ol>";
      continue;
    }

    // Collect consecutive `input:` form fields into a flex row. A field with a
    // `width:` (e.g. 50%) takes that share, so two narrow fields sit side by side;
    // a full-width field wraps to its own line. (width is presentation — excluded
    // from the trust hash — so two-column layout never affects a seal.)
    if (block.type === "input") {
      html += '<div class="it-field-row">';
      while (i < blocks.length && blocks[i].type === "input") {
        html += renderBlock(blocks[i]);
        i++;
      }
      html += "</div>";
      continue;
    }

    // Render the block itself
    html += renderBlock(block);

    // Recurse into children only for structural containers.
    // list-item children hold the original embedded keyword block (content
    // already copied to the list-item), so we do NOT recurse into those.
    if (
      (block.type === "section" || block.type === "sub") &&
      block.children &&
      block.children.length > 0
    ) {
      html += renderBlocks(block.children, topBlocks, routeCtx);
    }

    i++;
  }

  return html;
}

/** Build the approval-route panel context for a document, or undefined when it
 *  declares no route:/require: policy. The panel is injected once by renderBlocks
 *  at the first route:/require: block; the blocks themselves render nothing. */
function buildRouteCtx(
  document: IntentDocument,
): { panel: string; injected: { v: boolean } } | undefined {
  const state = deriveWorkflowState(document);
  if (!state.hasRoute) return undefined;
  return { panel: renderApprovalRoute(state), injected: { v: false } };
}

/** Render the in-file approval route + its DERIVED live state (approved / next /
 *  pending) as a single panel. State comes from deriveWorkflowState, so it always
 *  matches the file — nothing is stored. */
function renderApprovalRoute(state: WorkflowState): string {
  const fulfilled = new Set(state.fulfilled);
  const pending = new Set(state.pending);
  const items = state.required
    .map((req) => {
      const who = escapeHtml(req.match || "approver");
      let cls: string;
      let marker: string;
      let tag = "";
      if (fulfilled.has(req.match)) {
        cls = "is-approved";
        marker = "✓"; // ✓
      } else if (pending.has(req.match)) {
        if (state.next === req.match) {
          cls = "is-next";
          marker = "▶"; // ▶
          tag = "next";
        } else {
          cls = "is-pending";
          marker = "○"; // ○
        }
      } else if (req.optional) {
        cls = "is-optional";
        marker = "○";
        tag = "optional";
      } else {
        // Required but not currently active (its when: condition is false).
        cls = "is-inactive";
        marker = "—"; // —
        tag = req.when ? `when ${escapeHtml(req.when)}` : "not required";
      }
      const tagHtml = tag
        ? ` <span class="it-approval-route__tag">${tag}</span>`
        : "";
      return `<li class="it-approval-route__item ${cls}"><span class="it-approval-route__marker" aria-hidden="true">${marker}</span><span class="it-approval-route__who">${who}</span>${tagHtml}</li>`;
    })
    .join("");
  const status = state.complete ? "Complete" : "In progress";
  const order = escapeHtml(state.order);
  return `<section class="it-approval-route" data-order="${order}" data-complete="${state.complete}"><header class="it-approval-route__head"><span class="it-approval-route__title">Approval route</span><span class="it-approval-route__order">${order}</span><span class="it-approval-route__status">${status}</span></header><ol class="it-approval-route__list">${items}</ol></section>`;
}

// Main HTML renderer function
export function renderHTML(
  document: IntentDocument,
  options?: RenderOptions,
): string {
  if (!document || !document.blocks) return "";

  const prevBare = BARE_RENDER;
  BARE_RENDER = !!options?.bare;
  try {
  const bodyHtml = renderBlocks(document.blocks, undefined, buildRouteCtx(document));

  // Collect and render footnotes at bottom
  const footnotes = collectFootnotes(document.blocks);
  let footnotesHtml = "";
  if (footnotes.length > 0) {
    const items = footnotes
      .map((fn) => {
        const num = escapeHtml(fn.content);
        const text = fn.properties?.text
          ? escapeHtml(String(fn.properties.text))
          : escapeHtml(fn.content);
        return `<li id="fn-${num}" value="${num}">${text}</li>`;
      })
      .join("");
    footnotesHtml = `<div class="it-footnotes"><ol>${items}</ol></div>`;
  }

  const html = bodyHtml + footnotesHtml;

  // v2.10: Resolve theme — from options, from meta, or fall back to corporate
  const themeRef =
    options?.theme ?? document.metadata?.meta?.theme ?? undefined;
  const theme = resolveThemeSync(themeRef);
  const themeCSS = generateThemeCSS(theme, "web");
  // v4.3: scoped `style:` rules — applied after the theme so house styling wins.
  // Bare view drops them entirely (house styling is decoration).
  const docStyleCSS = BARE_RENDER ? "" : documentStyleCSS(document);

  // Unified trust band — the single certification surface (sign:/freeze: never render
  // inline). Shown for a trusted doc, anchored bottom-right of the document; `seal:
  // false` opts out. Skipped in the bare projection (pure content), where the editor's
  // page view supplies its own per-sheet band.
  const isTrusted = document.blocks.some(
    (b) => b.type === "sign" || b.type === "freeze",
  );
  const wantBand =
    !BARE_RENDER && (options?.seal === false ? false : !!options?.seal || isTrusted);
  let bandHtml = "";
  let bandCSS = "";
  if (wantBand) {
    bandHtml = renderTrustBand(documentToSource(document));
    if (bandHtml) {
      bandCSS =
        `.intent-document{position:relative;}` +
        TRUST_BAND_CSS +
        trustBandPositionCss("absolute");
    }
  }

  // Wrap in a container
  const direction =
    document.metadata?.language === "rtl" ? 'dir="rtl"' : 'dir="ltr"';

  return `<div class="intent-document${BARE_RENDER ? " intent-bare" : ""}" ${direction}>
<style>
${DOCUMENT_CSS}${themeCSS}
${docStyleCSS}
${BARE_RENDER ? BARE_RESET_CSS : ""}
${bandCSS}
</style>
${html}${bandHtml}
</div>`;
  } finally {
    BARE_RENDER = prevBare;
  }
}

// Build dynamic CSS from font: and page: blocks
function buildDynamicCSS(doc: IntentDocument): string {
  const fontBlock = doc.blocks.find((b) => b.type === "font");
  const pageBlock = doc.blocks.find((b) => b.type === "page");

  const fontFamily = String(fontBlock?.properties?.family || "Georgia, serif");
  const fontSize = String(fontBlock?.properties?.size || "12pt");
  const leading = String(fontBlock?.properties?.leading || "1.6");
  const rawSize = String(pageBlock?.properties?.size || "A4");
  const orientation = String(pageBlock?.properties?.orientation || "");

  // v2.9: Resolve paper size — named sizes or custom dimensions.
  // v1.4: + orientation (portrait/landscape) and the `A3 landscape` shorthand.
  let pageSize: string;
  let widthHint: string;
  if (rawSize === "custom") {
    const w = String(pageBlock?.properties?.width || "210mm");
    const h = String(pageBlock?.properties?.height || "297mm");
    pageSize = resolvePageSize(`${w} ${h}`, orientation);
    // Width hint for the default-margin heuristic is the resolved leading dim.
    widthHint = pageSize.split(/\s+/)[0] || w;
    pageSize = escapeHtml(pageSize);
  } else {
    const resolved = resolvePageSize(rawSize, orientation);
    widthHint = resolved.split(/\s+/)[0] || resolved;
    pageSize = escapeHtml(resolved);
  }

  // Accept `margin` (singular, what the editor and most authors write) or `margins`.
  // With none set, default by width: a 20mm A4 margin would eat half of an 80mm
  // thermal receipt, so narrow pages (≤120mm) get a tight 4mm default.
  const explicitMargin =
    pageBlock?.properties?.margin ?? pageBlock?.properties?.margins;
  const widthMatch = /(\d+(?:\.\d+)?)\s*mm/.exec(widthHint);
  const widthMm = widthMatch ? parseFloat(widthMatch[1]) : Infinity;
  const margins = String(explicitMargin ?? (widthMm <= 120 ? "4mm" : "20mm"));

  return `@page{size:${pageSize};margin:${escapeHtml(margins)};}body.it-print{font-family:${escapeHtml(fontFamily)};font-size:${escapeHtml(fontSize)};line-height:${escapeHtml(leading)};}`;
}

// Print-optimized HTML renderer
export function renderPrint(
  doc: IntentDocument,
  options?: RenderOptions,
): string {
  if (!doc || !doc.blocks) return "";

  const prevBare = BARE_RENDER;
  BARE_RENDER = !!options?.bare;
  try {
  const bodyHtml = renderBlocks(doc.blocks, undefined, buildRouteCtx(doc));

  // Collect and render footnotes at bottom
  const footnotes = collectFootnotes(doc.blocks);
  let footnotesHtml = "";
  if (footnotes.length > 0) {
    const items = footnotes
      .map((fn) => {
        const num = escapeHtml(fn.content);
        const text = fn.properties?.text
          ? escapeHtml(String(fn.properties.text))
          : escapeHtml(fn.content);
        return `<li id="fn-${num}" value="${num}">${text}</li>`;
      })
      .join("");
    footnotesHtml = `<div class="it-footnotes"><ol>${items}</ol></div>`;
  }

  const html = bodyHtml + footnotesHtml;
  const dynamicCSS = buildDynamicCSS(doc);
  const direction =
    doc.metadata?.language === "rtl" ? 'dir="rtl"' : 'dir="ltr"';

  // v2.10: Resolve theme — fall back to corporate
  const themeRef = options?.theme ?? doc.metadata?.meta?.theme ?? undefined;
  const theme = resolveThemeSync(themeRef);
  const themeCSS = generateThemeCSS(theme, "print");

  // v2.9: Collect print layout
  const layout = collectPrintLayout(doc);

  // v2.9: Build header/footer CSS
  let headerFooterCSS = "";
  if (layout.header) {
    const hp = layout.header.properties || {};
    const left = cssContentValue(String(hp.left ?? ""));
    // Content-only form (`header: ACME Corp`) renders in the center zone —
    // parity with the editor's print path and the llms.txt teaching.
    const center = cssContentValue(
      String(hp.center ?? layout.header.content ?? ""),
    );
    const right = cssContentValue(String(hp.right ?? ""));
    headerFooterCSS += `@page{@top-left{content:${left};}@top-center{content:${center};}@top-right{content:${right};}}`;
    if (String(hp["skip-first"]) === "true") {
      headerFooterCSS += `@page:first{@top-left{content:"";}@top-center{content:"";}@top-right{content:"";}}`;
    }
  }
  if (layout.footer) {
    const fp = layout.footer.properties || {};
    const left = cssContentValue(String(fp.left ?? ""));
    const center = cssContentValue(
      String(fp.center ?? layout.footer.content ?? ""),
    );
    const right = cssContentValue(String(fp.right ?? ""));
    headerFooterCSS += `@page{@bottom-left{content:${left};}@bottom-center{content:${center};}@bottom-right{content:${right};}}`;
    if (String(fp["skip-first"]) === "true") {
      headerFooterCSS += `@page:first{@bottom-left{content:"";}@bottom-center{content:"";}@bottom-right{content:"";}}`;
    }
  }

  // v2.9: Build break declaration CSS
  let breakCSS = "";
  for (const br of layout.breaks) {
    const before = br.properties?.before ? String(br.properties.before) : "";
    const keep = br.properties?.keep ? String(br.properties.keep) : "";
    if (before) {
      breakCSS += `.it-${escapeHtml(before)}{page-break-before:always;}`;
    }
    if (keep) {
      breakCSS += `.it-${escapeHtml(keep)}{break-inside:avoid;}`;
    }
  }

  // v2.9: Watermark HTML element
  let watermarkHtml = "";
  if (layout.watermark && layout.watermark.content && !BARE_RENDER) {
    const wp = layout.watermark.properties || {};
    // escapeHtml blocks quote-breakout, but inside a style="" value a stray `;`
    // would let an attacker inject extra CSS declarations (e.g. an exfiltrating
    // background:url(...)). Strip CSS metacharacters from every value first.
    const color = cssValue(wp.color ? String(wp.color) : "rgba(0,0,0,0.08)");
    const angle = cssValue(wp.angle ? String(wp.angle) : "-45");
    const size = cssValue(wp.size ? String(wp.size) : "80pt");
    watermarkHtml = `<div class="it-watermark" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${escapeHtml(angle)}deg);font-size:${escapeHtml(size)};color:${escapeHtml(color)};z-index:-1;pointer-events:none;white-space:nowrap;">${escapeHtml(layout.watermark.content)}</div>`;
  }

  // v2.9: Print mode class
  const pageBlock = layout.page;
  const printMode = pageBlock?.properties?.["print-mode"]
    ? String(pageBlock.properties["print-mode"])
    : "full";
  const bodyClass =
    printMode === "minimal-ink" ? "it-print it-print-minimal" : "it-print";

  // v2.9: Backward compat — page: header/footer string properties treated as center zone
  let backwardCompatCSS = "";
  if (!layout.header && pageBlock?.properties?.header) {
    const h = cssContentValue(String(pageBlock.properties.header));
    backwardCompatCSS += `@page{@top-center{content:${h};}}`;
  }
  if (!layout.footer && pageBlock?.properties?.footer) {
    const f = cssContentValue(String(pageBlock.properties.footer));
    backwardCompatCSS += `@page{@bottom-center{content:${f};}}`;
  }

  // v2.9: Minimal-ink CSS
  const minimalInkCSS =
    printMode === "minimal-ink"
      ? `
@media print{.it-print-minimal *{background-color:transparent !important;color:black !important;}.it-print-minimal strong,.it-print-minimal b{font-weight:bold;color:black !important;}.it-print-minimal em,.it-print-minimal i{font-style:italic;color:black !important;}.it-print-minimal .it-border{border:1px solid black !important;}}`
      : "";

  // Trust seal — the hash-derived ambient seal stamp, top-right of the first page.
  // AUTO-shown for signed/sealed/certified documents (a printed contract should
  // carry its seal); `seal: false` opts out, `seal: {…}` forces options.
  const isTrusted = doc.blocks.some(
    (b) => b.type === "sign" || b.type === "freeze",
  );
  const wantSeal = options?.seal === false ? false : !!options?.seal || isTrusted;
  let sealHtml = "";
  let sealCSS = "";
  if (wantSeal) {
    // The unified trust band, pinned in the bottom-RIGHT corner so it repeats on
    // EVERY printed page and never takes content space (position:fixed). Shared
    // visual style with every other surface — single source of truth in core.
    sealHtml = renderTrustBand(documentToSource(doc));
    if (sealHtml) {
      sealCSS = TRUST_BAND_CSS + trustBandPositionCss("fixed");
    }
  }

  return `<!DOCTYPE html><html ${direction}><head><meta charset="utf-8"><style>
${dynamicCSS}
${DOCUMENT_CSS}
${themeCSS}
${BARE_RENDER ? "" : documentStyleCSS(doc)}
/* Print: the page box is handled by @page margins, so neutralise the screen
   document container's own max-width/centering/padding. */
.intent-document{max-width:none;margin:0;padding:0;}
${headerFooterCSS}
${backwardCompatCSS}
${breakCSS}
${minimalInkCSS}
${sealCSS}
@page{counter-increment:page;}
@media print{body{margin:0;}.it-page-break{page-break-after:always;}.it-no-print{display:none;}a{text-decoration:none;color:inherit;}}
body.it-print{color:#000;background:#fff;}
body.it-print h1{font-size:1.8em;margin-bottom:0.3em;}
body.it-print h2{font-size:1.3em;margin-top:1.5em;}
body.it-print h3{font-size:1.1em;}
body.it-print p{margin:0 0 0.8em 0;orphans:3;widows:3;}
body.it-print table{width:100%;border-collapse:collapse;margin:1em 0;}
body.it-print th{border-bottom:2px solid #000;padding:4pt 8pt;text-align:start;}
body.it-print td{border-bottom:1px solid #ccc;padding:4pt 8pt;}
/* Keep table rows whole across page breaks so they aren't clipped behind the
   running footer/header, and repeat the table header on every page. */
body.it-print tr{break-inside:avoid;page-break-inside:avoid;}
body.it-print thead{display:table-header-group;}
body.it-print tfoot{display:table-footer-group;}
/* Sections may legitimately span pages; only avoid splitting their headings. */
body.it-print section{break-inside:auto;}
body.it-print h1,body.it-print h2,body.it-print h3{break-after:avoid;page-break-after:avoid;}
body.it-print .intent-callout{border-inline-start:3pt solid #000;padding-inline-start:10pt;margin:1em 0;}
body.it-print .intent-quote{font-style:italic;margin:1em 2em;}
body.it-print .it-byline{font-size:0.9em;color:#333;margin-bottom:1.5em;}
body.it-print .it-byline .it-byline-author{font-weight:bold;display:block;}
body.it-print .it-byline .it-byline-meta{font-size:0.85em;color:#666;}
body.it-print .it-epigraph{font-style:italic;text-align:center;margin:2em 3em;border:none;padding:0;}
body.it-print .it-epigraph .it-epigraph-by{display:block;text-align:end;font-size:0.9em;margin-top:0.5em;}
body.it-print .it-caption{font-size:0.85em;font-style:italic;text-align:center;color:#444;margin-top:0.3em;margin-bottom:1em;}
body.it-print .it-dedication{font-style:italic;text-align:center;margin:4em auto;page-break-after:always;}
body.it-print .it-toc{margin:2em 0;}
body.it-print .it-toc ol{list-style:none;padding:0;}
body.it-print .it-toc li{margin:0.3em 0;}
body.it-print .it-footnotes{border-top:1pt solid #ccc;margin-top:2em;padding-top:0.5em;font-size:0.85em;}
body.it-print .it-footnotes ol{padding-inline-start:1.5em;margin:0;}
body.it-print .it-footnotes li{margin:0.3em 0;}
body.it-print sup.it-fn-ref{font-size:0.7em;vertical-align:super;}
body.it-print .it-page-break{page-break-after:always;break-after:page;height:0;}
body.it-print .intent-task-checkbox{display:none;}
body.it-print .intent-task::before{content:"\\2610 ";margin-right:4pt;}
body.it-print .intent-task-done::before{content:"\\2611 ";}
/* ── v2.11 Print ───────────────────────────────────────── */
body.it-print .it-ref-card{border:none;padding:0;margin:0.5em 0;font-style:italic;}
body.it-print .it-def{margin:0.3em 0;}
body.it-print .it-def-term{font-weight:bold;}
body.it-print .it-def-meaning{padding-inline-start:1.5em;}
body.it-print .it-metric{border:1pt solid #ccc;padding:6pt 10pt;display:inline-block;min-width:100pt;margin:4pt;vertical-align:top;}
body.it-print .it-amendment{border:2pt solid #000;padding:8pt 12pt;margin:1em 0;}
body.it-print .it-amendment-ref{border:1pt solid #000;color:#000;}
body.it-print .it-figure{margin:1em 0;text-align:center;}
body.it-print .it-figure img{max-width:100%;border:1pt solid #ccc;}
body.it-print .it-figure-caption{font-size:0.85em;font-style:italic;text-align:center;margin-top:0.3em;}
body.it-print .it-signline{display:inline-block;width:45%;margin:2em 2%;vertical-align:top;}
body.it-print .it-signline-rule{border-bottom:1pt solid #000;margin-bottom:4pt;}
body.it-print .it-contact{border:none;padding:0;margin:0.3em 0;}
body.it-print .it-deadline{border-inline-start:3pt solid #000;padding-inline-start:8pt;margin:0.5em 0;}
body.it-print .it-deadline-date{font-weight:bold;text-decoration:underline;}
${BARE_RENDER ? BARE_RESET_CSS : ""}
</style></head><body class="${bodyClass}"><div class="intent-document${BARE_RENDER ? " intent-bare" : ""}">${watermarkHtml}${sealHtml}${html}</div></body></html>`;
  } finally {
    BARE_RENDER = prevBare;
  }
}
