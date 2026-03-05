import { IntentDocument, IntentBlock } from "./types";
import { flattenBlocks } from "./utils";

export interface QueryClause {
  field: string;
  operator:
    | "="
    | "!="
    | "<"
    | ">"
    | "<="
    | ">="
    | "contains"
    | "startsWith"
    | "exists";
  value?: string | number | boolean;
}

export interface QuerySort {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  where?: QueryClause[];
  sort?: QuerySort[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  blocks: IntentBlock[];
  total: number;
  matched: number;
}

/**
 * Parse a query string into QueryOptions
 * Syntax: "type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10"
 */
export function parseQuery(queryString: string): QueryOptions {
  const options: QueryOptions = { where: [], sort: [] };
  if (typeof queryString !== "string" || queryString.length === 0)
    return options;
  // Cap query length to prevent abuse
  const capped =
    queryString.length > 10_000 ? queryString.slice(0, 10_000) : queryString;
  const parts = capped.trim().split(/\s+/);

  for (const part of parts) {
    // Sort: sort:field:direction
    if (part.startsWith("sort:")) {
      const sortMatch = part.match(/^sort:([^:]+)(?::(asc|desc))?$/i);
      if (sortMatch) {
        options.sort!.push({
          field: sortMatch[1],
          direction: (sortMatch[2] as "asc" | "desc") || "asc",
        });
      }
      continue;
    }

    // Limit: limit:N
    if (part.startsWith("limit:")) {
      const limitMatch = part.match(/^limit:(\d+)$/i);
      if (limitMatch) {
        options.limit = parseInt(limitMatch[1], 10);
      }
      continue;
    }

    // Offset: offset:N
    if (part.startsWith("offset:")) {
      const offsetMatch = part.match(/^offset:(\d+)$/i);
      if (offsetMatch) {
        options.offset = parseInt(offsetMatch[1], 10);
      }
      continue;
    }

    // Clause: field operator value
    // Operators: =, !=, <, >, <=, >=, :contains, :startsWith, ? (exists)
    // Match: field followed by operator, then value
    const clauseMatch = part.match(
      /^([^:=<>!?]+)(=|!=|<=|>=|<|>|:contains|:startsWith|\?)(.*)$/,
    );
    if (clauseMatch) {
      const field = clauseMatch[1];
      const op = clauseMatch[2];
      const val = clauseMatch[3];

      let operator: QueryClause["operator"];
      switch (op) {
        case "=":
          operator = "=";
          break;
        case "!=":
          operator = "!=";
          break;
        case "<":
          operator = "<";
          break;
        case ">":
          operator = ">";
          break;
        case "<=":
          operator = "<=";
          break;
        case ">=":
          operator = ">=";
          break;
        case ":contains":
          operator = "contains";
          break;
        case ":startsWith":
          operator = "startsWith";
          break;
        case "?":
          operator = "exists";
          break;
        default:
          operator = "=";
      }

      options.where!.push({
        field,
        operator,
        value:
          operator === "exists"
            ? undefined
            : parseValue(
                // Strip leading = for :contains and :startsWith syntax like content:contains=value
                (op === ":contains" || op === ":startsWith") &&
                  val.startsWith("=")
                  ? val.slice(1)
                  : val,
              ),
      });
    }
  }

  return options;
}

function parseValue(val: string): string | number | boolean {
  const trimmed = val.trim();
  // Boolean
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  // Number
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  // String (remove quotes if present)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getFieldValue(block: IntentBlock, field: string): unknown {
  // Direct block fields
  if (field === "type") return block.type;
  if (field === "content") return block.content;
  if (field === "id") return block.id;

  // Properties
  if (block.properties && field in block.properties) {
    return block.properties[field];
  }

  // Table data
  if (field === "hasHeaders" && block.table) {
    return !!block.table.headers;
  }
  if (field === "rowCount" && block.table) {
    return block.table.rows.length;
  }

  return undefined;
}

function evaluateClause(block: IntentBlock, clause: QueryClause): boolean {
  const value = getFieldValue(block, clause.field);

  switch (clause.operator) {
    case "exists":
      return value !== undefined;
    case "=":
      return String(value).toLowerCase() === String(clause.value).toLowerCase();
    case "!=":
      return String(value).toLowerCase() !== String(clause.value).toLowerCase();
    case "<":
      return compareValues(value, clause.value) < 0;
    case ">":
      return compareValues(value, clause.value) > 0;
    case "<=":
      return compareValues(value, clause.value) <= 0;
    case ">=":
      return compareValues(value, clause.value) >= 0;
    case "contains":
      return String(value)
        .toLowerCase()
        .includes(String(clause.value).toLowerCase());
    case "startsWith":
      return String(value)
        .toLowerCase()
        .startsWith(String(clause.value).toLowerCase());
    default:
      return false;
  }
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  // Try date comparison for ISO dates
  const dateA = new Date(String(a));
  const dateB = new Date(String(b));
  if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
    return dateA.getTime() - dateB.getTime();
  }
  // String comparison
  return String(a).localeCompare(String(b));
}

/**
 * Execute a query against an IntentDocument
 */
export function queryBlocks(
  document: IntentDocument,
  options: QueryOptions | string,
): QueryResult {
  if (!document || !document.blocks) {
    return { blocks: [], total: 0, matched: 0 };
  }
  const opts = typeof options === "string" ? parseQuery(options) : options;

  // Start with all blocks (flatten children)
  let blocks = flattenBlocks(document.blocks);

  // Apply WHERE clauses (AND logic)
  if (opts.where && opts.where.length > 0) {
    blocks = blocks.filter((block) =>
      opts.where!.every((clause) => evaluateClause(block, clause)),
    );
  }

  // Apply SORT
  if (opts.sort && opts.sort.length > 0) {
    blocks.sort((a, b) => {
      for (const sort of opts.sort!) {
        const valA = getFieldValue(a, sort.field);
        const valB = getFieldValue(b, sort.field);
        const cmp = compareValues(valA, valB);
        if (cmp !== 0) {
          return sort.direction === "desc" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }

  const matched = blocks.length;

  // Apply OFFSET
  if (opts.offset && opts.offset > 0) {
    blocks = blocks.slice(opts.offset);
  }

  // Apply LIMIT
  if (opts.limit !== undefined && opts.limit >= 0) {
    blocks = blocks.slice(0, opts.limit);
  }

  return {
    blocks,
    total: flattenBlocks(document.blocks).length,
    matched,
  };
}

/**
 * CLI-friendly query formatter
 */
export function formatQueryResult(
  result: QueryResult,
  format: "json" | "table" | "simple" = "simple",
): string {
  switch (format) {
    case "json":
      return JSON.stringify(result, null, 2);
    case "table":
      return formatAsTable(result.blocks);
    case "simple":
    default:
      return result.blocks
        .map(
          (b) =>
            `[${b.type}] ${b.content}${
              b.properties
                ? " | " +
                  Object.entries(b.properties)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(" | ")
                : ""
            }`,
        )
        .join("\n");
  }
}

function formatAsTable(blocks: IntentBlock[]): string {
  if (blocks.length === 0) return "No results";

  const headers = ["ID", "Type", "Content", "Properties"];
  const rows = blocks.map((b) => [
    b.id.slice(0, 8),
    b.type,
    b.content.slice(0, 40),
    Object.entries(b.properties || {})
      .map(([k, v]) => `${k}:${String(v).slice(0, 15)}`)
      .join(", ") || "-",
  ]);

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)),
  );

  const separator =
    "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerRow =
    "| " + headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") + " |";

  const dataRows = rows.map(
    (row) =>
      "| " +
      row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(" | ") +
      " |",
  );

  return [separator, headerRow, separator, ...dataRows, separator].join("\n");
}

// --- queryDocument: simple, intuitive query API ---

export interface SimpleQueryOptions {
  /** Filter by block type or array of types (OR within type list) */
  type?: string | string[];
  /** Filter by content (string = case-insensitive substring, RegExp = regex match) */
  content?: string | RegExp;
  /** Filter by properties — all specified key/value pairs must match */
  properties?: Record<string, string | RegExp>;
  /** Only return blocks within a specific section (match section content) */
  section?: string | RegExp;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Query a document with a simple, intuitive filter API.
 * All conditions are ANDed. Type arrays are ORed.
 * Pure function — returns a new array, never mutates doc.
 */
export function queryDocument(
  doc: IntentDocument,
  query: SimpleQueryOptions = {},
): IntentBlock[] {
  if (!doc || !Array.isArray(doc.blocks)) return [];

  const allBlocks = flattenBlocks(doc.blocks);
  if (Object.keys(query).length === 0) return [...allBlocks];

  // Build section ranges if section filter is specified
  let sectionBlocks: Set<string> | null = null;
  if (query.section !== undefined) {
    sectionBlocks = new Set<string>();
    let inMatchingSection = false;

    for (const block of allBlocks) {
      if (block.type === "section") {
        inMatchingSection = matchValue(block.content, query.section);
      } else if (inMatchingSection) {
        sectionBlocks.add(block.id);
      }
    }
  }

  let results: IntentBlock[] = [];

  for (const block of allBlocks) {
    // Section filter
    if (sectionBlocks !== null && !sectionBlocks.has(block.id)) continue;

    // Type filter
    if (query.type !== undefined) {
      const types = Array.isArray(query.type) ? query.type : [query.type];
      if (!types.includes(block.type)) continue;
    }

    // Content filter
    if (query.content !== undefined) {
      if (!matchValue(block.content || "", query.content)) continue;
    }

    // Properties filter (all must match)
    if (query.properties !== undefined) {
      let allMatch = true;
      for (const [key, expected] of Object.entries(query.properties)) {
        const actual = block.properties?.[key];
        if (actual === undefined || !matchValue(String(actual), expected)) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) continue;
    }

    results.push(block);
  }

  // Apply limit
  if (query.limit !== undefined && query.limit >= 0) {
    results = results.slice(0, query.limit);
  }

  return results;
}

function matchValue(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") {
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
  return pattern.test(text);
}
