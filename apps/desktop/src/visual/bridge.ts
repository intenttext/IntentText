// Bridge: IntentText source ↔ TipTap JSON document
// Converts .it source text to TipTap-compatible JSON and back

import { parseIntentText } from "@intenttext/core";
import type { JSONContent } from "@tiptap/core";

// IT keywords that map to dedicated TipTap nodes
const CALLOUT_TYPES = new Set(["tip", "info", "warning", "danger", "success"]);
const HEADING_MAP: Record<string, string> = {
  title: "itTitle",
  section: "itSection",
  sub: "itSub",
};

// Style keys managed through TipTap marks/attributes.
// These are extracted FROM marks on doc→source, and applied AS marks on source→doc.
const MARK_STYLE_KEYS = new Set([
  "weight",
  "style",
  "underline",
  "strike",
  "color",
  "font",
  "bgcolor",
  "align",
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

/**
 * Apply IT properties as TipTap marks on text content nodes.
 * E.g. weight:bold → bold mark, color:#f00 → textStyle{color}, etc.
 */
function applyPropsAsMarks(
  content: JSONContent[],
  properties: Record<string, string | number> | undefined,
): JSONContent[] {
  if (!properties || content.length === 0) return content;

  type Mark = {
    type: string;
    attrs?: Record<string, unknown>;
    [k: string]: unknown;
  };
  const marks: Mark[] = [];
  const tsAttrs: Record<string, string> = {};

  const p = properties;
  if (String(p.weight || "").toLowerCase() === "bold")
    marks.push({ type: "bold" });
  if (String(p.style || "").toLowerCase() === "italic")
    marks.push({ type: "italic" });
  if (String(p.underline || "") === "true") marks.push({ type: "underline" });
  if (String(p.strike || "") === "true") marks.push({ type: "strike" });
  if (p.color) tsAttrs.color = String(p.color);
  if (p.font) tsAttrs.fontFamily = String(p.font);
  if (p.bgcolor)
    marks.push({ type: "highlight", attrs: { color: String(p.bgcolor) } });

  if (Object.keys(tsAttrs).length > 0)
    marks.push({ type: "textStyle", attrs: tsAttrs });

  if (marks.length === 0) return content;

  return content.map((n) =>
    n.type === "text"
      ? { ...n, marks: [...((n.marks || []) as Mark[]), ...marks] }
      : n,
  );
}

/**
 * Extract TipTap marks from a block node's content as IT property pairs.
 * Also reads textAlign from node attrs.
 */
function extractMarksAsProps(node: JSONContent): Record<string, string> {
  const props: Record<string, string> = {};
  if (!node.content) return props;

  for (const child of node.content) {
    if (child.type !== "text" || !child.marks) continue;
    for (const mark of child.marks) {
      switch (mark.type) {
        case "bold":
          props.weight = "bold";
          break;
        case "italic":
          props.style = "italic";
          break;
        case "underline":
          props.underline = "true";
          break;
        case "strike":
          props.strike = "true";
          break;
        case "textStyle":
          if (mark.attrs?.color) props.color = mark.attrs.color;
          if (mark.attrs?.fontFamily) props.font = mark.attrs.fontFamily;
          break;
        case "highlight":
          if (mark.attrs?.color) props.bgcolor = mark.attrs.color;
          break;
      }
    }
  }

  // TextAlign from node attributes (set by TextAlign extension)
  if (node.attrs?.textAlign && node.attrs.textAlign !== "left") {
    props.align = node.attrs.textAlign;
  }

  return props;
}

/**
 * Extract text content from a TipTap node.
 * HardBreak nodes become literal \n (backslash-n).
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

/* ── Source → Doc ─────────────────────────────────────────── */

/**
 * Convert IntentText source to TipTap JSON content
 */
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

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

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

    // Use the next parsed block
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
}): JSONContent | null {
  const { type, content, properties } = block;
  const text = content || "";

  // Build text content with hardBreak support, then apply marks from properties
  let textContent = textToContent(text);
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
  // Lists → flatten each item to a separate text: line
  if (node.type === "bulletList" && node.content) {
    return node.content.flatMap((item) => {
      if (!item.content) return [];
      return item.content.map((child) => {
        const t = extractText(child);
        const mp = extractMarksAsProps(child);
        return `text: • ${t}${formatProps(mp)}`;
      });
    });
  }
  if (node.type === "orderedList" && node.content) {
    let idx = 1;
    return node.content.flatMap((item) => {
      if (!item.content) return [];
      return item.content.map((child) => {
        const t = extractText(child);
        const mp = extractMarksAsProps(child);
        return `text: ${idx++}. ${t}${formatProps(mp)}`;
      });
    });
  }

  const line = nodeToLine(node);
  return line !== null ? [line] : [];
}

function nodeToLine(node: JSONContent): string | null {
  const text = extractText(node);
  const markProps = extractMarksAsProps(node);

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
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }

    case "itDivider":
      return "divider:";

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
