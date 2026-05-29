import { IntentDocument, IntentBlock } from "./types";
import { parseIntentText } from "./rust-core";

// Runtime page variables that should NOT be resolved by mergeData
const RUNTIME_VARIABLES = new Set(["page", "pages"]);

// System variables resolved automatically
const SYSTEM_VARIABLES = new Set(["timestamp", "date", "year"]);

// Property keys that must never be traversed (prototype pollution guard)
const DANGEROUS_PATH_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// Maximum path traversal depth to prevent abuse
const MAX_PATH_DEPTH = 20;

function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  if (keys.length > MAX_PATH_DEPTH) return undefined;

  return keys.reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined;
    if (DANGEROUS_PATH_KEYS.has(key)) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (!isNaN(idx) && idx >= 0 && idx < current.length) return current[idx];
      return undefined;
    }
    if (typeof current === "object") {
      return Object.prototype.hasOwnProperty.call(current, key)
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }
    return undefined;
  }, obj);
}

function getSystemVariable(key: string): string | undefined {
  switch (key) {
    case "timestamp":
      return new Date().toISOString();
    case "date":
      return new Date().toLocaleDateString();
    case "year":
      return String(new Date().getFullYear());
    default:
      return undefined;
  }
}

function resolveString(
  str: string,
  data: Record<string, unknown>,
  agentName?: string,
): { resolved: string; hasUnresolved: boolean } {
  // Fast path: no template markers
  if (!str.includes("{{")) return { resolved: str, hasUnresolved: false };

  let hasUnresolved = false;
  const resolved = str.replace(/\{\{([^}]+)\}\}/g, (match, rawPath) => {
    const path = rawPath.trim();
    // Reject suspiciously long paths
    if (path.length > 200) {
      hasUnresolved = true;
      return match;
    }

    // Runtime variables — leave as-is
    if (RUNTIME_VARIABLES.has(path)) return match;

    // System variables
    if (SYSTEM_VARIABLES.has(path)) {
      const sysVal = getSystemVariable(path);
      if (sysVal !== undefined) return sysVal;
    }

    // Agent variable — resolve from metadata
    if (path === "agent") {
      if (agentName) return agentName;
      hasUnresolved = true;
      return match;
    }

    // Data lookup (supports dot notation and array indices)
    const value = getByPath(data, path);
    if (value !== undefined && value !== null) return String(value);

    hasUnresolved = true;
    return match;
  });
  return { resolved, hasUnresolved };
}

function resolveBlock(
  block: IntentBlock,
  data: Record<string, unknown>,
  agentName?: string,
): IntentBlock {
  const newBlock: IntentBlock = { ...block };
  let blockHasUnresolved = false;

  // Resolve content
  if (newBlock.content) {
    const { resolved, hasUnresolved } = resolveString(
      newBlock.content,
      data,
      agentName,
    );
    newBlock.content = resolved;
    if (hasUnresolved) blockHasUnresolved = true;
  }

  // Resolve originalContent
  if (newBlock.originalContent) {
    const { resolved } = resolveString(
      newBlock.originalContent,
      data,
      agentName,
    );
    newBlock.originalContent = resolved;
  }

  // Resolve properties (string values only)
  if (newBlock.properties) {
    const newProps: Record<string, string | number> = {};
    for (const [key, val] of Object.entries(newBlock.properties)) {
      if (typeof val === "string") {
        const { resolved, hasUnresolved } = resolveString(val, data, agentName);
        newProps[key] = resolved;
        if (hasUnresolved) blockHasUnresolved = true;
      } else {
        newProps[key] = val;
      }
    }
    newBlock.properties = newProps;
  }

  if (blockHasUnresolved) {
    if (!newBlock.properties) newBlock.properties = {};
    newBlock.properties.unresolved = 1;
  }

  // Resolve children recursively
  if (newBlock.children) {
    newBlock.children = newBlock.children.map((child) =>
      resolveBlock(child, data, agentName),
    );
  }

  // Resolve table cells
  if (newBlock.table) {
    newBlock.table = {
      headers: newBlock.table.headers?.map((h) => {
        const { resolved } = resolveString(h, data, agentName);
        return resolved;
      }),
      rows: newBlock.table.rows.map((row) =>
        row.map((cell) => {
          const { resolved } = resolveString(cell, data, agentName);
          return resolved;
        }),
      ),
    };
  }

  // Resolve inline nodes
  if (newBlock.inline) {
    newBlock.inline = newBlock.inline.map((node) => {
      const newNode = { ...node };
      if ("value" in newNode && typeof newNode.value === "string") {
        const { resolved } = resolveString(newNode.value, data, agentName);
        (newNode as { value: string }).value = resolved;
      }
      if ("href" in newNode && typeof newNode.href === "string") {
        const { resolved } = resolveString(
          (newNode as { href: string }).href,
          data,
          agentName,
        );
        (newNode as { href: string }).href = resolved;
      }
      return newNode;
    });
  }

  return newBlock;
}

/**
 * Singularize an array name for the loop variable.
 * items → item, products → product, entries → entry
 */
function singularize(name: string): string {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

/**
 * Expand `each:` declarations on table blocks.
 * If a table's last header cell is `each: arrayName` (or `each: arrayName as varName`),
 * the first row is used as a template and expanded once per array item.
 */
function expandEachRows(
  blocks: IntentBlock[],
  data: Record<string, unknown>,
  agentName?: string,
): IntentBlock[] {
  const result: IntentBlock[] = [];

  for (const block of blocks) {
    // Only process table blocks with headers
    if (
      block.type !== "table" ||
      !block.table?.headers ||
      block.table.headers.length === 0
    ) {
      // Recurse into children
      if (block.children && block.children.length > 0) {
        result.push({
          ...block,
          children: expandEachRows(block.children, data, agentName),
        });
      } else {
        result.push(block);
      }
      continue;
    }

    const headers = block.table.headers;
    const lastHeader = headers[headers.length - 1].trim();
    const eachMatch = lastHeader.match(/^each:\s*(.+)$/i);

    if (!eachMatch) {
      result.push(block);
      continue;
    }

    // Parse each directive: "items" or "items as item"
    const eachDirective = eachMatch[1].trim();
    let arrayName: string;
    let loopVar: string;
    if (eachDirective.includes(" as ")) {
      const parts = eachDirective.split(" as ");
      arrayName = parts[0].trim();
      loopVar = parts[1].trim();
    } else {
      arrayName = eachDirective;
      loopVar = singularize(arrayName);
    }

    // Get the data array
    const items = getByPath(data, arrayName);

    // Clean headers: remove the `each:` column
    const cleanHeaders = headers.slice(0, -1);

    if (!Array.isArray(items) || items.length === 0) {
      // Emit header-only table with no rows
      result.push({
        ...block,
        table: {
          headers: cleanHeaders,
          rows: [],
        },
      });
      continue;
    }

    // Template row is the first row
    const templateRow = block.table.rows[0];
    if (!templateRow) {
      result.push({
        ...block,
        table: {
          headers: cleanHeaders,
          rows: [],
        },
      });
      continue;
    }

    // Expand template row for each item
    const expandedRows: string[][] = [];
    for (const item of items) {
      const itemData = { ...data, [loopVar]: item };
      const expandedRow = templateRow.map((cell) => {
        const { resolved } = resolveString(cell, itemData, agentName);
        return resolved;
      });
      expandedRows.push(expandedRow);
    }

    result.push({
      ...block,
      table: {
        headers: cleanHeaders,
        rows: expandedRows,
      },
    });
  }

  return result;
}

/**
 * Merge data into a parsed IntentDocument template.
 * Resolves {{variable}} references in block content, block properties, and
 * metadata.title and metadata.summary. Other metadata fields are not resolved.
 * Pure function — returns a new document, never mutates the input.
 */
export function mergeData(
  template: IntentDocument,
  data: Record<string, unknown>,
): IntentDocument {
  if (!template || !template.blocks) return template;
  if (!data || typeof data !== "object") return template;
  const agentName = template.metadata?.agent;

  // v2.8.1: expand each: table rows before variable resolution
  const expandedBlocks = expandEachRows(template.blocks, data, agentName);

  const newBlocks = expandedBlocks.map((block) =>
    resolveBlock(block, data, agentName),
  );

  // Resolve metadata values
  let newMetadata = template.metadata ? { ...template.metadata } : undefined;
  if (newMetadata) {
    if (newMetadata.title) {
      const { resolved } = resolveString(newMetadata.title, data, agentName);
      newMetadata.title = resolved;
    }
    if (newMetadata.summary) {
      const { resolved } = resolveString(newMetadata.summary, data, agentName);
      newMetadata.summary = resolved;
    }
  }

  return {
    ...template,
    blocks: newBlocks,
    metadata: newMetadata,
  };
}

/**
 * Convenience: parse an .it string and merge data in one call.
 */
export function parseAndMerge(
  source: string,
  data: Record<string, unknown>,
): IntentDocument {
  const template = parseIntentText(source);
  return mergeData(template, data);
}
