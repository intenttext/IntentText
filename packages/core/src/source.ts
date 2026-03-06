import { IntentDocument, IntentBlock } from "./types";

/**
 * Canonical property order for specific block types.
 * Properties not in the list are appended alphabetically.
 */
const PROPERTY_ORDER: Record<string, string[]> = {
  step: ["tool", "input", "output", "depends", "id", "status", "timeout"],
  task: ["owner", "due", "priority", "status"],
  done: ["owner", "time"],
  decision: ["if", "then", "else"],
  trigger: ["event", "condition"],
  loop: ["over", "do", "max"],
  wait: ["timeout", "fallback"],
  parallel: ["steps", "join"],
  retry: ["max", "delay", "backoff"],
  gate: ["approver", "timeout"],
  call: ["to", "input", "output"],
  handoff: ["from", "to"],
  emit: ["event", "data"],
  policy: [
    "if",
    "always",
    "never",
    "action",
    "requires",
    "notify",
    "priority",
    "scope",
    "after",
    "id",
  ],
  image: ["at", "caption", "width", "height"],
  link: ["to"],
  ref: ["to"],
  embed: ["to"],
  quote: ["by"],
  font: ["size", "family", "weight", "color"],
  page: ["size", "margin", "orientation"],
};

/** Properties that are internal / default-valued and should be skipped. */
const SKIP_INTERNAL = new Set(["id"]);

/** Header block types that should be emitted first. */
const HEADER_TYPES = new Set(["agent", "context", "font", "page"]);

/**
 * Convert a parsed IntentDocument back to .it source text.
 * Pure function — does not mutate the input.
 *
 * Round-trip guarantee: parseIntentText(documentToSource(doc)) produces
 * blocks with identical types, content, and properties (IDs may differ).
 */
export function documentToSource(doc: IntentDocument): string {
  if (!doc || !Array.isArray(doc.blocks)) return "";

  const lines: string[] = [];

  // Separate header blocks from content blocks
  const headerBlocks: IntentBlock[] = [];
  const contentBlocks: IntentBlock[] = [];

  for (const block of doc.blocks) {
    if (HEADER_TYPES.has(block.type)) {
      headerBlocks.push(block);
    } else {
      contentBlocks.push(block);
    }
  }

  // Emit header blocks first, in canonical order
  const headerOrder = ["agent", "context", "font", "page"];
  for (const hType of headerOrder) {
    for (const block of headerBlocks) {
      if (block.type === hType) {
        lines.push(serializeBlock(block));
      }
    }
  }

  // Blank line after headers if any were emitted
  if (headerBlocks.length > 0 && contentBlocks.length > 0) {
    lines.push("");
  }

  // Emit content blocks
  for (const block of contentBlocks) {
    const serialized = serializeBlock(block);
    lines.push(serialized);

    // Emit children (for sections)
    if (block.children && block.children.length > 0) {
      for (const child of block.children) {
        lines.push(serializeBlock(child));
      }
    }
  }

  return lines.join("\n");
}

function serializeBlock(block: IntentBlock): string {
  const type = block.type;

  // Special case: divider
  if (type === "divider") return "---";

  // Special case: break
  if (type === "break") return "break:";

  // Special case: toc — keyword + properties only
  if (type === "toc") {
    const props = serializeProperties(block);
    return props ? `toc: ${props}` : "toc:";
  }

  // Special case: code block
  if (type === "code") {
    return "```\n" + block.content + "\n```";
  }

  // Special case: table — reconstruct pipe table
  if (type === "table" && block.table) {
    return serializeTable(block);
  }

  // Get content text — prefer originalContent to preserve inline formatting
  const content = block.originalContent ?? block.content ?? "";

  // Build the line
  const propStr = serializeProperties(block);
  if (propStr) {
    return `${type}: ${content} | ${propStr}`;
  }
  return content ? `${type}: ${content}` : `${type}:`;
}

function serializeProperties(block: IntentBlock): string {
  const props = block.properties;
  if (!props) return "";

  const keys = Object.keys(props).filter((k) => {
    if (SKIP_INTERNAL.has(k)) return false;
    // Skip status if it's the default "pending"
    if (k === "status" && props[k] === "pending") return false;
    return true;
  });

  if (keys.length === 0) return "";

  // Sort by canonical order for this block type, then alphabetically
  const order = PROPERTY_ORDER[block.type];
  if (order) {
    const orderMap = new Map(order.map((k, i) => [k, i]));
    keys.sort((a, b) => {
      const ia = orderMap.get(a) ?? 999;
      const ib = orderMap.get(b) ?? 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
  } else {
    keys.sort();
  }

  return keys.map((k) => `${k}: ${props[k]}`).join(" | ");
}

function serializeTable(block: IntentBlock): string {
  const lines: string[] = [];
  const table = block.table!;

  if (table.headers && table.headers.length > 0) {
    lines.push(`headers: ${table.headers.join(" | ")}`);
  }

  for (const row of table.rows) {
    lines.push(`row: ${row.join(" | ")}`);
  }

  return lines.join("\n");
}
