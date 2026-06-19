import { IntentDocument, IntentBlock } from "./types";
import { parseIntentText } from "./parser";

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

/** Coerce a merged value to a number for numeric filters (strips grouping/spaces). */
function toFilterNumber(v: unknown): number {
  if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[,\s]/g, ""));
}

/**
 * Apply ONE display filter to a value. The philosophy is "**the ERP computes, `.it`
 * formats**": business math (totals, tax, FX) stays in the ERP and arrives in the merge
 * data; these filters only PRESENT it. All are locale-aware via `Intl` and fail soft
 * (return the value unchanged on a bad arg / non-number), so a template never breaks.
 *   currency:CODE[:locale]  →  1234.5 | currency:QAR        → "QAR 1,234.50"
 *   number[:dp][:locale]    →  1234.5 | number:2           → "1,234.50"
 *   percent[:locale]        →  0.05   | percent            → "5%"
 *   date[:style][:locale]   →  2026-07-01 | date:long      → "July 1, 2026"
 *   upper | lower | trim
 */
function applyMergeFilter(v: unknown, name: string, arg: string): unknown {
  // Empty-segment-safe arg parsing ("".split(":") is [""], not []).
  const parts = arg.split(":");
  const part = (i: number, dflt: string) => parts[i] || dflt;
  switch (name) {
    case "currency": {
      const n = toFilterNumber(v);
      if (!Number.isFinite(n)) return v;
      try {
        return new Intl.NumberFormat(part(1, "en-US"), {
          style: "currency",
          currency: part(0, "USD").toUpperCase(),
        }).format(n);
      } catch {
        return v;
      }
    }
    case "number": {
      const n = toFilterNumber(v);
      if (!Number.isFinite(n)) return v;
      const dp = parts[0];
      const opts: Intl.NumberFormatOptions = dp
        ? { minimumFractionDigits: +dp, maximumFractionDigits: +dp }
        : {};
      try {
        return new Intl.NumberFormat(part(1, "en-US"), opts).format(n);
      } catch {
        return v;
      }
    }
    case "percent": {
      const n = toFilterNumber(v);
      if (!Number.isFinite(n)) return v;
      try {
        return new Intl.NumberFormat(part(0, "en-US"), {
          style: "percent",
          maximumFractionDigits: 2,
        }).format(n);
      } catch {
        return v;
      }
    }
    case "date": {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return v;
      try {
        return new Intl.DateTimeFormat(part(1, "en-US"), {
          dateStyle: part(0, "medium") as "full" | "long" | "medium" | "short",
        }).format(d);
      } catch {
        return v;
      }
    }
    case "upper":
      return String(v).toUpperCase();
    case "lower":
      return String(v).toLowerCase();
    case "trim":
      return String(v).trim();
    default:
      return v; // unknown filter — pass the value through unchanged
  }
}

/** Apply a chain of `| filter:arg` segments (after the path) to a resolved value. */
function applyMergeFilters(value: unknown, filters: string[]): string {
  let v: unknown = value;
  for (const f of filters) {
    const [nameRaw, ...argParts] = f.split(":");
    v = applyMergeFilter(v, nameRaw.trim().toLowerCase(), argParts.join(":").trim());
  }
  return v === undefined || v === null ? "" : String(v);
}

function resolveString(
  str: string,
  data: Record<string, unknown>,
  agentName?: string,
): { resolved: string; hasUnresolved: boolean } {
  // Fast path: no template markers
  if (!str.includes("{{")) return { resolved: str, hasUnresolved: false };

  let hasUnresolved = false;
  const resolved = str.replace(/\{\{([^}]+)\}\}/g, (match, rawExpr) => {
    // `{{ path | filter:arg | filter2 }}` — the path is the first segment, the rest
    // are display filters (currency/number/date/…). Plain `{{path}}` is unchanged.
    const segments = String(rawExpr).split("|");
    const path = segments[0].trim();
    const filters = segments.slice(1).map((s) => s.trim()).filter(Boolean);
    // Reject suspiciously long paths
    if (path.length > 200) {
      hasUnresolved = true;
      return match;
    }

    // Runtime variables — leave as-is (filters don't apply to deferred {{page}} etc.)
    if (RUNTIME_VARIABLES.has(path)) return match;

    // System variables
    if (SYSTEM_VARIABLES.has(path)) {
      const sysVal = getSystemVariable(path);
      if (sysVal !== undefined) return applyMergeFilters(sysVal, filters);
    }

    // Agent variable — resolve from metadata
    if (path === "agent") {
      if (agentName) return applyMergeFilters(agentName, filters);
      hasUnresolved = true;
      return match;
    }

    // Data lookup (supports dot notation and array indices)
    const value = getByPath(data, path);
    if (value !== undefined && value !== null)
      return applyMergeFilters(value, filters);

    // Unresolved data path. In "blank" mode (production printing) render it empty
    // so an invoice never shows a literal `{{customer.phone}}`; in "keep" mode
    // (default) leave the marker visible to aid template debugging.
    hasUnresolved = true;
    return MISSING_MODE === "blank" ? "" : match;
  });
  return { resolved, hasUnresolved };
}

/** How to render a `{{path}}` that resolves to nothing. Set per mergeData() call. */
let MISSING_MODE: "keep" | "blank" = "keep";

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

  // Resolve the byte-faithful record of a MERGED prose paragraph. The parser
  // collapses consecutive `text:` lines into one block but keeps the original
  // per-line sub-blocks in `_merged`; documentToSource re-emits THOSE verbatim.
  // Without resolving them, a merged template serialized back to source keeps its
  // {{tokens}} in multi-line paragraphs — so it still reads as isTemplate() and
  // can't be sealed. Resolve them exactly like content (mirrors _liftedLines).
  if (newBlock._merged && newBlock._merged.length > 0) {
    newBlock._merged = newBlock._merged.map((part) =>
      resolveBlock(part, data, agentName),
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
 * Resolves {{variable}} references in block content, block properties,
 * metadata.title, metadata.summary, the `meta:` property-bag (metadata.meta),
 * and verbatim lifted source lines. Pure function — returns a new document,
 * never mutates the input.
 */
export interface MergeOptions {
  /**
   * How to render a `{{path}}` with no matching data:
   *  - "keep" (default): leave the literal marker — useful while authoring templates.
   *  - "blank": render empty — use for finished documents (invoices, receipts) so a
   *    missing optional field never prints `{{customer.phone}}`.
   */
  missing?: "keep" | "blank";
}

export function mergeData(
  template: IntentDocument,
  data: Record<string, unknown>,
  options?: MergeOptions,
): IntentDocument {
  if (!template || !template.blocks) return template;
  if (!data || typeof data !== "object") return template;
  MISSING_MODE = options?.missing ?? "keep";
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
    // Resolve the `meta:` property-bag values. These are lifted into
    // metadata.meta (not emitted as a block), so resolveBlock never sees them;
    // without this a `meta: | date: {{invoice.date}}` keeps its literal token
    // after merge and the document stays isTemplate()===true (cannot be sealed).
    // The canonical serializer reconstructs `meta:` from this map.
    if (newMetadata.meta) {
      const resolvedMeta: Record<string, string> = {};
      for (const [k, v] of Object.entries(newMetadata.meta)) {
        if (typeof v === "string") {
          resolvedMeta[k] = resolveString(v, data, agentName).resolved;
        } else {
          resolvedMeta[k] = v;
        }
      }
      newMetadata.meta = resolvedMeta;
    }
  }

  // Resolve {{…}} inside verbatim lifted lines (meta:/track: lines lifted for
  // lossless round-trip). The lossless serializer re-emits `l.text` byte-for-byte,
  // so the resolved metadata.meta above is NOT enough on its own: the merged
  // SOURCE would still carry the token. resolveString only rewrites {{…}}
  // occurrences, leaving the rest of the line intact.
  let newLifted = template._liftedLines;
  if (newLifted && newLifted.length > 0) {
    newLifted = newLifted.map((l) => {
      if (!l.text.includes("{{")) return l;
      const resolved = resolveString(l.text, data, agentName).resolved;
      return resolved === l.text ? l : { ...l, text: resolved };
    });
  }

  return {
    ...template,
    blocks: newBlocks,
    metadata: newMetadata,
    _liftedLines: newLifted,
  };
}

/**
 * Convenience: parse an .it string and merge data in one call.
 */
export function parseAndMerge(
  source: string,
  data: Record<string, unknown>,
  options?: MergeOptions,
): IntentDocument {
  const template = parseIntentText(source);
  return mergeData(template, data, options);
}
