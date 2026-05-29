// Serializer: VisualBlock[] → .it source text
// Uses the block model to produce valid .it syntax

import type { VisualBlock } from "./types";

// Multi-line content keywords that use fenced code blocks
const FENCED_KEYWORDS = new Set(["code"]);

/**
 * Serialize an array of VisualBlocks back to .it source text.
 */
export function serializeBlocks(blocks: VisualBlock[]): string {
  return blocks.map(serializeBlock).join("\n");
}

function serializeBlock(block: VisualBlock): string {
  const { type, content, properties } = block;

  // Code blocks use fenced syntax
  if (FENCED_KEYWORDS.has(type)) {
    const lang = properties.lang || "";
    const title = properties.title ? ` | title: ${properties.title}` : "";
    return `\`\`\`${lang}${title}\n${content}\n\`\`\``;
  }

  // Build pipe properties
  const propParts = Object.entries(properties)
    .filter(
      ([k, v]) => v !== undefined && v !== "" && k !== "id" && k !== "status",
    )
    .map(([k, v]) => `${k}: ${v}`);

  const propString = propParts.length > 0 ? " | " + propParts.join(" | ") : "";

  // Columns/row use pipe-delimited content differently
  if (type === "columns" || type === "row") {
    // Content already contains pipe-delimited values
    return `${type}: ${content}`;
  }

  return `${type}: ${content}${propString}`;
}

/**
 * Create a new empty block for a given keyword type
 */
export function createEmptyBlock(type: string): VisualBlock {
  const id = `vb-${Math.random().toString(36).slice(2, 8)}`;

  const defaults: Record<string, () => VisualBlock> = {
    text: () => ({ id, type, content: "New paragraph", properties: {} }),
    title: () => ({ id, type, content: "Untitled", properties: {} }),
    summary: () => ({ id, type, content: "Document summary", properties: {} }),
    section: () => ({ id, type, content: "New Section", properties: {} }),
    sub: () => ({ id, type, content: "Subsection", properties: {} }),
    quote: () => ({ id, type, content: "Quote text", properties: { by: "" } }),
    tip: () => ({ id, type, content: "Helpful tip", properties: {} }),
    info: () => ({ id, type, content: "Information", properties: {} }),
    warning: () => ({ id, type, content: "Warning message", properties: {} }),
    danger: () => ({ id, type, content: "Danger notice", properties: {} }),
    success: () => ({ id, type, content: "Success message", properties: {} }),
    code: () => ({
      id,
      type,
      content: "// code here",
      properties: { lang: "js" },
    }),
    image: () => ({ id, type, content: "", properties: { src: "", alt: "" } }),
    link: () => ({ id, type, content: "Link text", properties: { to: "" } }),
    cite: () => ({
      id,
      type,
      content: "Source title",
      properties: { url: "" },
    }),
    def: () => ({ id, type, content: "Term — Definition", properties: {} }),
    figure: () => ({
      id,
      type,
      content: "",
      properties: { src: "", caption: "" },
    }),
    contact: () => ({
      id,
      type,
      content: "Name",
      properties: { role: "", email: "" },
    }),
    metric: () => ({
      id,
      type,
      content: "Metric Name",
      properties: { value: "0", unit: "" },
    }),
    deadline: () => ({
      id,
      type,
      content: "Deadline",
      properties: { date: "", owner: "" },
    }),
    divider: () => ({ id, type, content: "", properties: {} }),
    break: () => ({ id, type, content: "", properties: {} }),
    ref: () => ({ id, type, content: "Referenced document", properties: {} }),
    columns: () => ({
      id,
      type,
      content: "Column A | Column B | Column C",
      properties: {},
    }),
    row: () => ({
      id,
      type,
      content: "Value 1 | Value 2 | Value 3",
      properties: {},
    }),
    input: () => ({
      id,
      type,
      content: "Field name",
      properties: { type: "text" },
    }),
    output: () => ({ id, type, content: "Result", properties: {} }),
    step: () => ({ id, type, content: "Step description", properties: {} }),
    gate: () => ({ id, type, content: "Gate condition", properties: {} }),
    trigger: () => ({ id, type, content: "Event trigger", properties: {} }),
    signal: () => ({ id, type, content: "Signal name", properties: {} }),
    decision: () => ({ id, type, content: "Decision", properties: {} }),
    task: () => ({ id, type, content: "Task description", properties: {} }),
    approve: () => ({ id, type, content: "Approved", properties: { by: "" } }),
    sign: () => ({ id, type, content: "Signed", properties: { by: "" } }),
    freeze: () => ({ id, type, content: "Document sealed", properties: {} }),
    amendment: () => ({
      id,
      type,
      content: "Amendment",
      properties: { section: "", was: "", now: "" },
    }),
    meta: () => ({ id, type, content: "", properties: { type: "document" } }),
    context: () => ({
      id,
      type,
      content: "Context information",
      properties: {},
    }),
    page: () => ({ id, type, content: "", properties: { size: "A4" } }),
    header: () => ({ id, type, content: "Header text", properties: {} }),
    footer: () => ({ id, type, content: "Footer text", properties: {} }),
  };

  if (defaults[type]) return defaults[type]();
  return { id, type, content: "", properties: {} };
}
