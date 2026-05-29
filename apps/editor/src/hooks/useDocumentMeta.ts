import { useMemo, useCallback, useRef } from "react";
import { parseIntentText } from "@intenttext/core";
import type { IntentDocument } from "@intenttext/core";

export interface DocumentMeta {
  title: string;
  summary: string;
  author: string;
  publication: string;
  date: string;
  fontFamily: string;
  fontSize: string;
  fontLeading: string;
  headingFont: string;
  monoFont: string;
  pageSize: string;
  pageOrientation: string;
  marginTop: string;
  marginLeft: string;
  columns: string;
  columnGap: string;
  header: string;
  footer: string;
  showPageNumbers: boolean;
  pageNumberPosition: string;
  watermarkText: string;
  watermarkOpacity: string;
  watermarkAngle: string;
  watermarkColor: string;
  hasToc: boolean;
  tocDepth: string;
  tocTitle: string;
  theme: string;
}

const DEFAULTS: DocumentMeta = {
  title: "",
  summary: "",
  author: "",
  publication: "",
  date: "",
  fontFamily: "",
  fontSize: "",
  fontLeading: "",
  headingFont: "",
  monoFont: "",
  pageSize: "",
  pageOrientation: "portrait",
  marginTop: "",
  marginLeft: "",
  columns: "1",
  columnGap: "",
  header: "",
  footer: "",
  showPageNumbers: false,
  pageNumberPosition: "footer-center",
  watermarkText: "",
  watermarkOpacity: "0.08",
  watermarkAngle: "-45",
  watermarkColor: "#000000",
  hasToc: false,
  tocDepth: "2",
  tocTitle: "Contents",
  theme: "",
};

function getBlock(doc: IntentDocument | null, type: string) {
  return doc?.blocks.find((b) => b.type === type) ?? null;
}

function prop(
  block: { properties?: Record<string, string | number> } | null,
  key: string,
  fallback = "",
): string {
  const v = block?.properties?.[key];
  return v != null ? String(v) : fallback;
}

export function extractMeta(doc: IntentDocument | null): DocumentMeta {
  if (!doc) return { ...DEFAULTS };

  const titleBlock = getBlock(doc, "title");
  const summaryBlock = getBlock(doc, "summary");
  const bylineBlock = getBlock(doc, "byline");
  const fontBlock = getBlock(doc, "font");
  const pageBlock = getBlock(doc, "page");
  const headerBlock = getBlock(doc, "header");
  const footerBlock = getBlock(doc, "footer");
  const watermarkBlock = getBlock(doc, "watermark");
  const tocBlock = getBlock(doc, "toc");
  const metaBlock = getBlock(doc, "meta");

  return {
    title: titleBlock?.content ?? "",
    summary: summaryBlock?.content ?? "",
    author: prop(bylineBlock, "by", bylineBlock?.content ?? ""),
    publication: prop(bylineBlock, "publication"),
    date: prop(bylineBlock, "date"),
    fontFamily: prop(fontBlock, "family", fontBlock?.content ?? ""),
    fontSize: prop(fontBlock, "size"),
    fontLeading: prop(fontBlock, "leading"),
    headingFont: prop(fontBlock, "heading"),
    monoFont: prop(fontBlock, "mono"),
    pageSize: pageBlock?.content ?? "",
    pageOrientation: prop(pageBlock, "orientation", "portrait"),
    marginTop: prop(pageBlock, "margin-top", prop(pageBlock, "margins")),
    marginLeft: prop(pageBlock, "margin-left"),
    columns: prop(pageBlock, "columns", "1"),
    columnGap: prop(pageBlock, "gap"),
    header: headerBlock?.content ?? prop(pageBlock, "header"),
    footer: footerBlock?.content ?? prop(pageBlock, "footer"),
    showPageNumbers: !!prop(pageBlock, "page-numbers"),
    pageNumberPosition: prop(
      pageBlock,
      "page-number-position",
      "footer-center",
    ),
    watermarkText: watermarkBlock?.content ?? "",
    watermarkOpacity: prop(watermarkBlock, "opacity", "0.08"),
    watermarkAngle: prop(watermarkBlock, "angle", "-45"),
    watermarkColor: prop(watermarkBlock, "color", "#000000"),
    hasToc: !!tocBlock,
    tocDepth: prop(tocBlock, "depth", "2"),
    tocTitle: tocBlock?.content ?? "Contents",
    theme: prop(metaBlock, "theme"),
  };
}

// ─── Block writer utilities ─────────────────────────────────

// The order document-level blocks should appear at the top of the file
const DOC_BLOCK_ORDER = [
  "font",
  "page",
  "header",
  "footer",
  "watermark",
  "meta",
  "title",
  "summary",
  "byline",
  "toc",
];

function buildBlockLine(
  type: string,
  content: string,
  props: Record<string, string>,
): string {
  const parts = [content];
  for (const [k, v] of Object.entries(props)) {
    if (v) parts.push(`${k}: ${v}`);
  }
  const joined = parts.filter(Boolean).join(" | ");
  return joined ? `${type}: ${joined}` : `${type}:`;
}

/**
 * Update or insert a document-level block in the .it source.
 * Returns the new source string.
 */
export function updateBlock(
  source: string,
  type: string,
  content: string,
  props: Record<string, string> = {},
): string {
  const lines = source.split("\n");
  const newLine = buildBlockLine(type, content, props);

  // Find existing line of this type
  const existingIdx = lines.findIndex((l) => {
    const match = l.match(/^(\w[\w-]*)\s*:/);
    return match && match[1] === type;
  });

  if (existingIdx !== -1) {
    lines[existingIdx] = newLine;
    return lines.join("\n");
  }

  // Insert at the correct position among document-level blocks
  const orderIdx = DOC_BLOCK_ORDER.indexOf(type);
  if (orderIdx === -1) {
    // Unknown type — insert after last doc block
    lines.splice(0, 0, newLine);
    return lines.join("\n");
  }

  // Find the best insertion point
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\w[\w-]*)\s*:/);
    if (match) {
      const existOrder = DOC_BLOCK_ORDER.indexOf(match[1]);
      if (existOrder !== -1 && existOrder < orderIdx) {
        insertAt = i + 1;
      }
    }
  }

  lines.splice(insertAt, 0, newLine);
  return lines.join("\n");
}

/**
 * Remove all lines of a given block type from the source.
 */
export function removeBlock(source: string, type: string): string {
  return source
    .split("\n")
    .filter((l) => {
      const match = l.match(/^(\w[\w-]*)\s*:/);
      return !(match && match[1] === type);
    })
    .join("\n");
}

/**
 * Hook that provides document metadata and update functions.
 */
export function useDocumentMeta(
  content: string,
  setContent: (s: string) => void,
) {
  const doc = useMemo(() => {
    try {
      return parseIntentText(content);
    } catch {
      return null;
    }
  }, [content]);

  const meta = useMemo(() => extractMeta(doc), [doc]);

  // We need a ref to always have the latest content in callbacks
  const contentRef = useRef(content);
  contentRef.current = content;

  const updateField = useCallback(
    (
      type: string,
      blockContent: string,
      props: Record<string, string> = {},
    ) => {
      const src = contentRef.current;
      if (!blockContent && Object.values(props).every((v) => !v)) {
        setContent(removeBlock(src, type));
        return;
      }
      setContent(updateBlock(src, type, blockContent, props));
    },
    [setContent],
  );

  const setTitle = useCallback(
    (v: string) => updateField("title", v),
    [updateField],
  );

  const setSummary = useCallback(
    (v: string) => updateField("summary", v),
    [updateField],
  );

  const setByline = useCallback(
    (author: string, publication: string, date: string) => {
      if (!author && !publication && !date) {
        setContent(removeBlock(contentRef.current, "byline"));
        return;
      }
      const main = author || "";
      const props: Record<string, string> = {};
      if (publication) props.publication = publication;
      if (date) props.date = date;
      updateField("byline", main, props);
    },
    [updateField, setContent],
  );

  const setFont = useCallback(
    (
      family: string,
      size: string,
      leading: string,
      heading: string,
      mono: string,
    ) => {
      if (!family && !size && !leading && !heading && !mono) {
        setContent(removeBlock(contentRef.current, "font"));
        return;
      }
      const props: Record<string, string> = {};
      if (size) props.size = size;
      if (leading) props.leading = leading;
      if (heading) props.heading = heading;
      if (mono) props.mono = mono;
      updateField("font", family, props);
    },
    [updateField, setContent],
  );

  const setPage = useCallback(
    (
      size: string,
      orientation: string,
      margins: string,
      columns: string,
      gap: string,
    ) => {
      if (!size && !margins && columns === "1" && !gap) {
        setContent(removeBlock(contentRef.current, "page"));
        return;
      }
      const props: Record<string, string> = {};
      if (orientation && orientation !== "portrait")
        props.orientation = orientation;
      if (margins) props.margins = margins;
      if (columns && columns !== "1") props.columns = columns;
      if (gap) props.gap = gap;
      updateField("page", size, props);
    },
    [updateField, setContent],
  );

  const setHeader = useCallback(
    (v: string) => {
      if (!v) {
        setContent(removeBlock(contentRef.current, "header"));
        return;
      }
      updateField("header", v);
    },
    [updateField, setContent],
  );

  const setFooter = useCallback(
    (v: string) => {
      if (!v) {
        setContent(removeBlock(contentRef.current, "footer"));
        return;
      }
      updateField("footer", v);
    },
    [updateField, setContent],
  );

  const setWatermark = useCallback(
    (text: string, opacity: string, angle: string, color: string) => {
      if (!text) {
        setContent(removeBlock(contentRef.current, "watermark"));
        return;
      }
      const props: Record<string, string> = {};
      if (opacity && opacity !== "0.08") props.opacity = opacity;
      if (angle && angle !== "-45") props.angle = angle;
      if (color && color !== "#000000") props.color = color;
      updateField("watermark", text, props);
    },
    [updateField, setContent],
  );

  const setToc = useCallback(
    (enabled: boolean, title: string, depth: string) => {
      if (!enabled) {
        setContent(removeBlock(contentRef.current, "toc"));
        return;
      }
      const props: Record<string, string> = {};
      if (depth && depth !== "2") props.depth = depth;
      updateField("toc", title || "Contents", props);
    },
    [updateField, setContent],
  );

  return {
    meta,
    setTitle,
    setSummary,
    setByline,
    setFont,
    setPage,
    setHeader,
    setFooter,
    setWatermark,
    setToc,
  };
}
