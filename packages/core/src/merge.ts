import { IntentDocument, IntentBlock } from "./types";
import { parseIntentText } from "./parser";

// Runtime page variables that should NOT be resolved by mergeData
const RUNTIME_VARIABLES = new Set(["page", "pages"]);

// System variables resolved automatically
const SYSTEM_VARIABLES = new Set(["timestamp", "date", "year"]);

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(key);
      if (!isNaN(idx)) return (current as unknown[])[idx];
      return undefined;
    }
    return (current as Record<string, unknown>)[key];
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
  let hasUnresolved = false;
  const resolved = str.replace(/\{\{([^}]+)\}\}/g, (match, rawPath) => {
    const path = rawPath.trim();

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
 * Merge data into a parsed IntentDocument template.
 * Resolves all {{variable}} references in content, properties, and metadata.
 * Pure function — returns a new document, never mutates the input.
 */
export function mergeData(
  template: IntentDocument,
  data: Record<string, unknown>,
): IntentDocument {
  const agentName = template.metadata?.agent;

  const newBlocks = template.blocks.map((block) =>
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
