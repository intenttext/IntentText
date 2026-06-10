// Bridge: IntentText source ↔ TipTap JSON document
// Converts .it source text to TipTap-compatible JSON and back

import { parseIntentText } from "@intenttext/core";
import type { JSONContent } from "@tiptap/core";

/** A TipTap mark on a text node. */
type Mark = {
  type: string;
  attrs?: Record<string, unknown>;
  [k: string]: unknown;
};

// IT keywords that map to dedicated TipTap nodes
const CALLOUT_TYPES = new Set(["tip", "info", "warning", "danger", "success"]);
// Document-level metadata / layout keywords — shown as a chip, not body content.
const META_KEYWORDS = new Set([
  "page",
  "meta",
  "font",
  "header",
  "footer",
  "watermark",
]);
// Tamper-evidence / history keywords — rendered as styled trust chips, with the
// exact source line preserved verbatim for round-trip (the document hash must not
// change from editing in the visual editor).
const TRUST_KEYWORDS = new Set([
  "sign",
  "seal",
  "approve",
  "freeze",
  "amend",
  "amendment",
]);
const HEADING_MAP: Record<string, string> = {
  title: "itTitle",
  section: "itSection",
  sub: "itSub",
};

const KEYWORD_ALIASES: Record<string, string> = {
  note: "text",
  "body-text": "text",
};

// Style keys managed through TipTap marks/attributes.
// These are extracted FROM marks on doc→source, and applied AS marks on source→doc.
// Canonical keys match core's STYLE_PROPERTIES (family/bg/italic), so styling done
// in the editor renders identically through core. Legacy editor keys (style/font/
// bgcolor) are kept so older documents still round-trip.
const MARK_STYLE_KEYS = new Set([
  "weight",
  "italic",
  "underline",
  "strike",
  "color",
  "family",
  "size",
  "bg",
  "valign",
  "align",
  // legacy aliases
  "style",
  "font",
  "bgcolor",
]);

/* ── Helpers ─────────────────────────────────────────────────── */

/** Parse the JSON-encoded props attribute. */
function parseProps(raw: unknown): Record<string, string> {
  if (!raw || raw === "{}") return {};
  try {
    return typeof raw === "string"
      ? JSON.parse(raw)
      : (raw as Record<string, string>) || {};
  } catch {
    return {};
  }
}

/** Format a props object as ' | key: val | key2: val2' (or ''). */
function formatProps(
  props: Record<string, string>,
  exclude?: Set<string>,
): string {
  const entries = Object.entries(props).filter(
    ([k, v]) => v !== undefined && v !== "" && (!exclude || !exclude.has(k)),
  );
  if (entries.length === 0) return "";
  return " | " + entries.map(([k, v]) => `${k}: ${v}`).join(" | ");
}

/**
 * Convert text string to TipTap content nodes.
 * Literal \n (backslash-n) in the source becomes hardBreak nodes.
 */
function textToContent(text: string): JSONContent[] {
  if (!text) return [];
  const parts = text.split("\\n");
  const result: JSONContent[] = [];
  parts.forEach((part, i) => {
    if (part) result.push({ type: "text", text: part });
    if (i < parts.length - 1) result.push({ type: "hardBreak" });
  });
  return result;
}

/** A core inline AST node (subset we map to TipTap marks). */
type InlineNode = {
  type: string;
  value?: string;
  href?: string;
  props?: Record<string, string>;
};

/** Map one core inline node to the TipTap marks it should carry (or null = plain). */
function inlineNodeMarks(node: InlineNode): Mark[] | null {
  switch (node.type) {
    case "bold":
      return [{ type: "bold" }];
    case "italic":
      return [{ type: "italic" }];
    case "strike":
      return [{ type: "strike" }];
    case "code":
      return [{ type: "code" }];
    case "highlight":
      return [{ type: "highlight" }];
    case "styled": {
      const p = node.props || {};
      const marks: Mark[] = [];
      const ts: Record<string, string> = {};
      if (p.weight && p.weight !== "normal") marks.push({ type: "bold" });
      if (p.italic === "true") marks.push({ type: "italic" });
      if (p.underline === "true") marks.push({ type: "underline" });
      if (p.strike === "true") marks.push({ type: "strike" });
      if (p.color) ts.color = p.color;
      if (p.family) ts.fontFamily = p.family;
      if (p.size) ts.fontSize = p.size;
      if (Object.keys(ts).length) marks.push({ type: "textStyle", attrs: ts });
      if (p.bg) marks.push({ type: "highlight", attrs: { color: p.bg } });
      if (p.valign === "sub") marks.push({ type: "subscript" });
      if (p.valign === "super") marks.push({ type: "superscript" });
      return marks.length ? marks : null;
    }
    default:
      return null; // text, mention, tag, date, label, link → plain text
  }
}

// Inline node types that map cleanly to TipTap marks (and thus round-trip exactly).
// Other node types (label, mention, tag, date, link, note, quote, code, footnote)
// carry delimiters that can't be reconstructed from the AST alone, so a line
// containing any of them is kept literal (textToContent) — preserving the source.
const MAPPABLE_INLINE = new Set([
  "text",
  "bold",
  "italic",
  "strike",
  "highlight",
  "styled",
]);

/**
 * Build TipTap content from core's inline AST, so inline marks AND styled spans
 * (`[text]{…}`) become real TipTap marks (partial styling survives the round-trip).
 * If the line mixes in delimiter-bearing nodes (mentions, tags, links, code, …) or
 * has nothing to mark, keep it literal so those tokens round-trip unchanged.
 */
function inlineToContent(
  inline: InlineNode[] | undefined,
  fallbackText: string,
): JSONContent[] {
  if (
    !inline ||
    inline.length === 0 ||
    inline.every((n) => n.type === "text") ||
    !inline.every((n) => MAPPABLE_INLINE.has(n.type))
  ) {
    return textToContent(fallbackText);
  }
  const result: JSONContent[] = [];
  for (const node of inline) {
    const marks = inlineNodeMarks(node);
    const value = node.value ?? "";
    // Preserve literal \n as hardBreaks even inside styled runs.
    const parts = value.split("\\n");
    parts.forEach((part, i) => {
      if (part)
        result.push(marks ? { type: "text", text: part, marks } : { type: "text", text: part });
      if (i < parts.length - 1) result.push({ type: "hardBreak" });
    });
  }
  return result.length ? result : textToContent(fallbackText);
}

/**
 * Apply IT properties as TipTap marks on text content nodes.
 * E.g. weight:bold → bold mark, color:#f00 → textStyle{color}, etc.
 */
function applyPropsAsMarks(
  content: JSONContent[],
  properties: Record<string, string | number> | undefined,
): JSONContent[] {
  if (!properties || content.length === 0) return content;

  const marks: Mark[] = [];
  const tsAttrs: Record<string, string> = {};

  const p = properties;
  // Canonical core keys (family/bg/italic), with legacy editor keys as fallback.
  const family = p.family ?? p.font;
  const bg = p.bg ?? p.bgcolor;
  if (String(p.weight || "").toLowerCase() === "bold")
    marks.push({ type: "bold" });
  if (String(p.italic || "") === "true" || String(p.style || "").toLowerCase() === "italic")
    marks.push({ type: "italic" });
  if (String(p.underline || "") === "true") marks.push({ type: "underline" });
  if (String(p.strike || "") === "true") marks.push({ type: "strike" });
  if (String(p.valign || "") === "sub") marks.push({ type: "subscript" });
  if (String(p.valign || "") === "super") marks.push({ type: "superscript" });
  if (p.color) tsAttrs.color = String(p.color);
  if (family) tsAttrs.fontFamily = String(family);
  if (p.size) tsAttrs.fontSize = String(p.size);
  if (bg) marks.push({ type: "highlight", attrs: { color: String(bg) } });

  if (Object.keys(tsAttrs).length > 0)
    marks.push({ type: "textStyle", attrs: tsAttrs });

  if (marks.length === 0) return content;

  return content.map((n) =>
    n.type === "text"
      ? { ...n, marks: [...((n.marks || []) as Mark[]), ...marks] }
      : n,
  );
}

/** One text run's marks → the IT style props they map to (line-level vocabulary). */
function marksToProps(marks: Mark[] | undefined): Record<string, string> {
  const props: Record<string, string> = {};
  for (const mark of marks || []) {
    switch (mark.type) {
      case "bold":
        props.weight = "bold";
        break;
      case "italic":
        props.italic = "true";
        break;
      case "underline":
        props.underline = "true";
        break;
      case "strike":
        props.strike = "true";
        break;
      case "textStyle":
        if (mark.attrs?.color) props.color = String(mark.attrs.color);
        if (mark.attrs?.fontFamily) props.family = String(mark.attrs.fontFamily);
        if (mark.attrs?.fontSize) props.size = String(mark.attrs.fontSize);
        break;
      case "highlight":
        if (mark.attrs?.color) props.bg = String(mark.attrs.color);
        break;
      case "subscript":
        props.valign = "sub";
        break;
      case "superscript":
        props.valign = "super";
        break;
    }
  }
  return props;
}

/**
 * Serialize ONE text run (with its marks) to .it inline syntax:
 *  - no marks → raw text
 *  - a single semantic mark → the mark char (*bold* _italic_ ~strike~ `code` ^hl^)
 *  - link → [text](href)
 *  - color/font/size, or combined marks → a styled span [text]{ k: v; k: v }
 * This is what lets partial styling round-trip (vs. flattening to the whole line).
 */
function runToInlineText(child: JSONContent): string {
  if (child.type === "hardBreak") return "\\n";
  if (child.type !== "text") return extractText(child);
  const t = child.text || "";
  if (!t) return "";
  const marks = (child.marks || []) as Mark[];
  if (!marks.length) return t;

  const types = new Set(marks.map((m) => m.type));
  const link = marks.find((m) => m.type === "link");
  if (link?.attrs?.href) return `[${t}](${link.attrs.href})`;

  const ts = marks.find((m) => m.type === "textStyle")?.attrs || {};
  const hl = marks.find((m) => m.type === "highlight")?.attrs || {};
  const hasColorFont = !!(ts.color || ts.fontFamily || ts.fontSize || hl.color);
  const semanticCount = ["bold", "italic", "strike", "underline", "code"].filter(
    (k) => types.has(k),
  ).length;

  // Single semantic mark with no color/font and no combining → tidy mark char.
  if (!hasColorFont && semanticCount === 1 && !types.has("underline")) {
    if (types.has("bold")) return `*${t}*`;
    if (types.has("italic")) return `_${t}_`;
    if (types.has("strike")) return `~${t}~`;
    if (types.has("code")) return `\`${t}\``;
  }
  if (!hasColorFont && semanticCount === 0 && types.has("highlight") && !hl.color)
    return `^${t}^`;

  // Everything else (color/font/size, combined marks, underline) → styled span.
  const props = marksToProps(marks);
  const out: string[] = [];
  if (props.color) out.push(`color: ${props.color}`);
  if (props.family) out.push(`family: ${props.family}`);
  if (props.size) out.push(`size: ${props.size}`);
  if (props.weight) out.push(`weight: ${props.weight}`);
  if (props.italic === "true") out.push(`italic: true`);
  if (props.underline) out.push(`underline: true`);
  if (props.strike) out.push(`strike: true`);
  if (props.bg) out.push(`bg: ${props.bg}`);
  if (props.valign) out.push(`valign: ${props.valign}`);
  return out.length ? `[${t}]{ ${out.join("; ")} }` : t;
}

/**
 * Serialize a block's inline content to .it text, plus any block-level style props.
 * Whole-line case (a single uniformly-styled text run) → clean line-level props;
 * partial styling (multiple runs / mixed marks) → inline marks + styled spans.
 * `align` is always block-level.
 */
/** Mark types the serializer can faithfully represent in `.it` (→ core-renderable). */
const SUPPORTED_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
  "textStyle",
  "link",
  "subscript",
  "superscript",
]);

/**
 * Fidelity guard: walk a TipTap doc for mark types the serializer can't represent
 * in `.it` (so they'd be lost on save and wouldn't print through core). Returns the
 * sorted unique unsupported mark types. Normally empty — every toolbar mark is
 * supported and TipTap drops unregistered marks on paste — so this catches
 * regressions (a new mark added without a serializer) rather than everyday use.
 */
export function detectUnsupportedStyling(node: JSONContent): string[] {
  const found = new Set<string>();
  const walk = (n: JSONContent) => {
    for (const m of (n.marks || []) as { type: string }[]) {
      if (!SUPPORTED_MARKS.has(m.type)) found.add(m.type);
    }
    for (const c of n.content || []) walk(c);
  };
  walk(node);
  return [...found].sort();
}

function inlineToSource(node: JSONContent): {
  text: string;
  props: Record<string, string>;
} {
  const children = node.content || [];
  const align: Record<string, string> =
    node.attrs?.textAlign && node.attrs.textAlign !== "left"
      ? { align: String(node.attrs.textAlign) }
      : {};

  // Whole-line: exactly one text run → keep its style as line-level props.
  if (children.length === 1 && children[0].type === "text") {
    return {
      text: children[0].text || "",
      props: { ...marksToProps(children[0].marks as Mark[]), ...align },
    };
  }
  // Partial styling → marks/spans inline, no block-level style props.
  return { text: children.map(runToInlineText).join(""), props: { ...align } };
}

/**
 * Extract plain text content from a TipTap node (no marks).
 * HardBreak nodes become literal \n (backslash-n). Used for code blocks.
 */
function extractText(node: JSONContent): string {
  if (!node.content) return "";
  return node.content
    .map((child) => {
      if (child.type === "text") return child.text || "";
      if (child.type === "hardBreak") return "\\n";
      return extractText(child);
    })
    .join("");
}

/**
 * Merge mark-derived style props with existing (non-style) props.
 * Mark props override existing style keys; non-style keys are preserved.
 */
function mergeProps(
  existingRaw: unknown,
  markProps: Record<string, string>,
  exclude?: Set<string>,
): Record<string, string> {
  const existing = parseProps(existingRaw);
  // Remove mark-managed keys from existing (they'll come from marks)
  for (const key of MARK_STYLE_KEYS) delete existing[key];
  // Also remove any explicitly excluded keys
  if (exclude) for (const key of exclude) delete existing[key];
  return { ...existing, ...markProps };
}

function normalizeKeyword(keyword: string): string {
  const k = keyword.toLowerCase();
  return KEYWORD_ALIASES[k] || k;
}

function lineKeyword(trimmedLine: string): string | null {
  if (trimmedLine === "---") return "divider";
  const m = trimmedLine.match(/^([a-zA-Z][\w-]*):/);
  if (!m) return null;
  return normalizeKeyword(m[1]);
}

function parsedBlockKeyword(blockType: string): string {
  return normalizeKeyword(blockType);
}

function keywordsMatch(sourceKey: string, parsedKey: string): boolean {
  if (sourceKey === parsedKey) return true;
  // Some callout aliases normalize to info in parser output.
  if (
    sourceKey === "info" &&
    ["tip", "warning", "danger", "success"].includes(parsedKey)
  ) {
    return true;
  }
  if (
    parsedKey === "info" &&
    ["tip", "warning", "danger", "success"].includes(sourceKey)
  ) {
    return true;
  }
  return false;
}

function parseInlineProps(rest: string): {
  content: string;
  properties: Record<string, string>;
} {
  if (!rest) return { content: "", properties: {} };
  const parts = rest.split(" | ");
  let content = parts[0] || "";
  const properties: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const m = seg.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) {
      // Keep literal text segments that are not valid IT pipe props.
      content += ` | ${seg}`;
      continue;
    }
    properties[m[1]] = m[2];
  }

  return { content, properties };
}

function fallbackLineToBlock(trimmedLine: string): {
  type: string;
  content?: string;
  properties?: Record<string, string>;
  inline?: InlineNode[];
} | null {
  if (trimmedLine === "---") return { type: "divider" };
  const m = trimmedLine.match(/^([a-zA-Z][\w-]*):\s*(.*)$/);
  if (!m) return null;

  const type = normalizeKeyword(m[1]);
  const rest = m[2] || "";
  const { content, properties } = parseInlineProps(rest);
  // Parse the content's inline marks/spans (*bold*, [text]{…}) via core so they
  // become TipTap marks. Core preserves {{vars}}, so templates are unaffected.
  let inline: InlineNode[] | undefined;
  try {
    inline = parseIntentText(`text: ${content}`).blocks[0]
      ?.inline as InlineNode[] | undefined;
  } catch {
    inline = undefined;
  }
  return { type, content, properties, inline };
}

/* ── Source → Doc ─────────────────────────────────────────── */

/**
 * Convert IntentText source to TipTap JSON content
 */
/** Match a bullet (`- x` / `* x`) or ordered (`1. x`) list line → its item text. */
function listLineMatch(
  trimmed: string,
): { ordered: boolean; text: string } | null {
  const bullet = trimmed.match(/^[-*]\s+(.*)$/);
  if (bullet) return { ordered: false, text: bullet[1] };
  const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
}

/** A TipTap listItem wrapping a single paragraph of the item text. */
function makeListItem(text: string): JSONContent {
  return {
    type: "listItem",
    content: [{ type: "paragraph", content: textToContent(text) }],
  };
}

export function sourceToDoc(source: string): JSONContent {
  if (!source.trim()) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const doc = parseIntentText(source);
  const content: JSONContent[] = [];

  for (const block of doc.blocks) {
    const node = blockToNode(block);
    if (node) content.push(node);
  }

  // Also handle comment lines (// ...) that the parser might skip
  const lines = source.split("\n");
  let blockIdx = 0;
  const result: JSONContent[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Document-level metadata / layout blocks (page:, meta:, font:, header:,
    // footer:, watermark:) are not body content. Render them as a subtle preserved
    // chip (not raw "| size: A4" text) and keep the exact source line for
    // round-trip. Consume the matching parsed block to keep the stream aligned.
    {
      const mkw = lineKeyword(trimmed);
      if (mkw && META_KEYWORDS.has(mkw)) {
        result.push({ type: "itMeta", attrs: { raw: trimmed } });
        const pType = doc.blocks[blockIdx]?.type;
        if (pType && keywordsMatch(mkw, parsedBlockKeyword(pType))) blockIdx++;
        continue;
      }
      // Trust / history blocks → styled chip, exact source preserved.
      if (mkw && TRUST_KEYWORDS.has(mkw)) {
        result.push({ type: "itTrust", attrs: { raw: trimmed, keyword: mkw } });
        const pType = doc.blocks[blockIdx]?.type;
        if (pType && keywordsMatch(mkw, parsedBlockKeyword(pType))) blockIdx++;
        continue;
      }
      // Metric / total → label-left / value-right row, exact source preserved.
      if (mkw === "metric") {
        result.push({ type: "itMetric", attrs: { raw: trimmed } });
        const pType = doc.blocks[blockIdx]?.type;
        if (pType && keywordsMatch(mkw, parsedBlockKeyword(pType))) blockIdx++;
        continue;
      }
    }

    // Group a run of bullet/ordered list lines into one TipTap list node, so
    // lists round-trip as list-items (not generic blocks). docToSource emits
    // `- item` / `N. item` for these.
    const listStart = listLineMatch(trimmed);
    if (listStart) {
      const ordered = listStart.ordered;
      const items: JSONContent[] = [];
      let lj = li;
      while (lj < lines.length) {
        const t = lines[lj].trim();
        const m = t ? listLineMatch(t) : null;
        if (!m || m.ordered !== ordered) break;
        items.push(makeListItem(m.text));
        // If this list item is a top-level block (not a section child), it also
        // sits in `content` — consume it so the trailing append doesn't dupe it.
        const pType = doc.blocks[blockIdx]?.type;
        if (pType === "list-item" || pType === "step-item") blockIdx++;
        lj++;
      }
      result.push({
        type: ordered ? "orderedList" : "bulletList",
        content: items,
      });
      li = lj - 1; // -1: the for-loop will increment
      continue;
    }

    // Group a run of `| a | b | c |` pipe-table lines into one itTable node, so
    // tables render instead of vanishing. The table is a section child (not a
    // top-level block), so we do NOT touch blockIdx. docToSource emits the
    // `| ... |` lines back.
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      (trimmed.match(/\|/g) || []).length >= 3
    ) {
      const rows: string[][] = [];
      let lj = li;
      while (lj < lines.length) {
        const t = lines[lj].trim();
        if (!(t.startsWith("|") && t.endsWith("|"))) break;
        rows.push(
          t
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim()),
        );
        lj++;
      }
      result.push({ type: "itTable", attrs: { rows: JSON.stringify(rows) } });
      li = lj - 1;
      continue;
    }

    // Comment lines
    if (trimmed.startsWith("//")) {
      result.push({
        type: "itComment",
        content: trimmed.slice(2).trim()
          ? [{ type: "text", text: trimmed.slice(2).trim() }]
          : [],
      });
      continue;
    }

    // Code block fence — skip, handled by parser
    if (trimmed.startsWith("```")) continue;

    const sourceKey = lineKeyword(trimmed);

    // Keep text/template lines literal to avoid parser normalization
    // (e.g. markdown marker stripping or placeholder mutation).
    if (sourceKey && (sourceKey === "text" || trimmed.includes("{{"))) {
      const rawBlock = fallbackLineToBlock(trimmed);
      if (rawBlock) {
        const node = blockToNode(rawBlock);
        if (node) result.push(node);

        // Consume matching parsed block to keep parser index aligned.
        if (blockIdx < doc.blocks.length) {
          const parsedKey = parsedBlockKeyword(doc.blocks[blockIdx].type);
          if (keywordsMatch(sourceKey, parsedKey)) {
            blockIdx++;
          }
        }
        continue;
      }
    }

    // If parser produced a block, only consume it when keyword matches current line.
    if (blockIdx < content.length && sourceKey) {
      const nextParsed = doc.blocks[blockIdx];
      const parsedKey = parsedBlockKeyword(nextParsed.type);
      if (keywordsMatch(sourceKey, parsedKey)) {
        result.push(content[blockIdx]);
        blockIdx++;
        continue;
      }
    }

    // Fallback: parse line directly so raw source lines are never dropped.
    const rawBlock = fallbackLineToBlock(trimmed);
    if (rawBlock) {
      const node = blockToNode(rawBlock);
      if (node) result.push(node);
      continue;
    }

    // Final fallback: keep parser progression if nothing else matched.
    if (blockIdx < content.length) {
      result.push(content[blockIdx]);
      blockIdx++;
    }
  }

  // If we missed any blocks, append them
  while (blockIdx < content.length) {
    result.push(content[blockIdx]);
    blockIdx++;
  }

  return {
    type: "doc",
    content: result.length > 0 ? result : [{ type: "paragraph" }],
  };
}

function blockToNode(block: {
  type: string;
  content?: string;
  properties?: Record<string, string | number>;
  inline?: InlineNode[];
}): JSONContent | null {
  const { type, content, properties, inline } = block;
  const text = content || "";

  // Build content from the inline AST (so *bold*, [text]{…} spans → real marks),
  // then layer any line-level style props (whole-line styling) as marks on top.
  let textContent = inlineToContent(inline, text);
  textContent = applyPropsAsMarks(textContent, properties);

  // Serialize all props to JSON string for TipTap attrs (used by extensions.ts buildStyle)
  const propsJson = properties
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(properties).map(([k, v]) => [k, String(v)]),
        ),
      )
    : "{}";

  // textAlign from 'align' property (for TipTap TextAlign extension)
  const textAlign = properties?.align ? String(properties.align) : undefined;

  // Title, Section, Sub → dedicated heading nodes
  if (type in HEADING_MAP) {
    return {
      type: HEADING_MAP[type],
      attrs: { props: propsJson, ...(textAlign && { textAlign }) },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Summary
  if (type === "summary") {
    return {
      type: "itSummary",
      attrs: { props: propsJson, ...(textAlign && { textAlign }) },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Text / body-text → paragraph
  if (type === "text" || type === "body-text") {
    return {
      type: "paragraph",
      ...(textAlign && { attrs: { textAlign } }),
      content: textContent.length ? textContent : undefined,
    };
  }

  // Callouts
  if (CALLOUT_TYPES.has(type)) {
    const variant =
      type === "info" ? String(properties?.type || "info").toLowerCase() : type;
    const safeVariant = CALLOUT_TYPES.has(variant) ? variant : "info";

    return {
      type: "itCallout",
      attrs: { variant: safeVariant, props: propsJson },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Quote
  if (type === "quote") {
    return {
      type: "itQuote",
      attrs: {
        by: properties?.by ? String(properties.by) : "",
        props: propsJson,
        ...(textAlign && { textAlign }),
      },
      content: textContent.length ? textContent : undefined,
    };
  }

  // Code (no marks on code blocks)
  if (type === "code") {
    return {
      type: "itCode",
      attrs: {
        lang: properties?.lang ? String(properties.lang) : "",
        props: propsJson,
      },
      content: text ? [{ type: "text", text }] : undefined,
    };
  }

  // Divider
  if (type === "divider") {
    return { type: "itDivider" };
  }

  // Break (page break)
  if (type === "break") {
    return { type: "itBreak" };
  }

  // All other keywords → generic block
  const propStr = properties
    ? Object.entries(properties)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ")
    : "";

  return {
    type: "itGenericBlock",
    attrs: { keyword: type, properties: propStr, props: propsJson },
    content: textContent.length ? textContent : undefined,
  };
}

/* ── Doc → Source ─────────────────────────────────────────── */

/**
 * Convert TipTap JSON back to IntentText source
 */
export function docToSource(doc: JSONContent): string {
  if (!doc.content) return "";

  const lines: string[] = [];

  for (const node of doc.content) {
    lines.push(...nodeToLines(node));
  }

  return lines.join("\n");
}

/** Convert a single TipTap node to one or more IT source lines. */
function nodeToLines(node: JSONContent): string[] {
  // Lists → canonical `.it` bullet syntax so they round-trip as list-items, not
  // text. `- item` parses back to a list-item; `N. item` to a step-item.
  if (node.type === "bulletList" && node.content) {
    return node.content.flatMap((item) => {
      if (!item.content) return [];
      return item.content.map((child) => {
        const { text: t, props: mp } = inlineToSource(child);
        return `- ${t}${formatProps(mp)}`;
      });
    });
  }
  if (node.type === "orderedList" && node.content) {
    let idx = 1;
    return node.content.flatMap((item) => {
      if (!item.content) return [];
      return item.content.map((child) => {
        const { text: t, props: mp } = inlineToSource(child);
        return `${idx++}. ${t}${formatProps(mp)}`;
      });
    });
  }

  const line = nodeToLine(node);
  return line !== null ? [line] : [];
}

function nodeToLine(node: JSONContent): string | null {
  const { text, props: markProps } = inlineToSource(node);

  switch (node.type) {
    case "itTitle": {
      const merged = mergeProps(node.attrs?.props, markProps);
      return `title: ${text}${formatProps(merged)}`;
    }

    case "itSummary": {
      const merged = mergeProps(node.attrs?.props, markProps);
      return `summary: ${text}${formatProps(merged)}`;
    }

    case "itSection": {
      const merged = mergeProps(node.attrs?.props, markProps);
      return `section: ${text}${formatProps(merged)}`;
    }

    case "itSub": {
      const merged = mergeProps(node.attrs?.props, markProps);
      return `sub: ${text}${formatProps(merged)}`;
    }

    case "paragraph":
      return `text: ${text}${formatProps(markProps)}`;

    case "itCallout": {
      const variant = node.attrs?.variant || "tip";
      const merged = mergeProps(
        node.attrs?.props,
        markProps,
        new Set(["variant"]),
      );
      if (variant === "info") {
        return `info: ${text}${formatProps(merged)}`;
      }
      return `info: ${text} | type: ${variant}${formatProps(merged, new Set(["type"]))}`;
    }

    case "itQuote": {
      const by = node.attrs?.by;
      const byPart = by ? ` | by: ${by}` : "";
      const merged = mergeProps(node.attrs?.props, markProps, new Set(["by"]));
      return `quote: ${text}${byPart}${formatProps(merged)}`;
    }

    case "itCode": {
      const lang = node.attrs?.lang || "";
      // Code is literal — never apply inline marks/spans.
      return `\`\`\`${lang}\n${extractText(node)}\n\`\`\``;
    }

    case "itDivider":
      return "divider:";

    case "itTable": {
      let rows: string[][] = [];
      try {
        rows = JSON.parse(node.attrs?.rows || "[]");
      } catch {
        rows = [];
      }
      return rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    }

    case "itMeta":
      return node.attrs?.raw || "";

    case "itTrust":
      return node.attrs?.raw || "";

    case "itMetric":
      return node.attrs?.raw || "";

    case "itBreak":
      return "break:";

    case "itComment":
      return text ? `// ${text}` : "//";

    case "itGenericBlock": {
      const kw = node.attrs?.keyword || "text";
      const merged = mergeProps(node.attrs?.props, markProps);
      return `${kw}: ${text}${formatProps(merged)}`;
    }

    default:
      return text ? `text: ${text}${formatProps(markProps)}` : null;
  }
}
