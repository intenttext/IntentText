import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, queryDocument, queryBlocks } from "@dotit/core";
import type { SimpleQueryOptions } from "@dotit/core";
import { jsonResult, safe } from "../types.js";

export function registerQueryTools(server: McpServer): void {
  server.tool(
    "query_document",
    "Query an IntentText document for specific blocks. Two ways to query:\n" +
      "1. Structured filters (type / content / section / limit) — simple substring " +
      "and type matching.\n" +
      "2. A raw query string in the 'query' param for richer filtering on block " +
      "properties, e.g. 'type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10'. " +
      "Operators: = != < > <= >= :contains :startsWith ? (exists). Use sort:field:asc|desc " +
      "and limit:N / offset:N. Conditions split on whitespace (values can't contain spaces).\n" +
      "If 'query' is given it takes precedence over the structured filters. " +
      "Returns matching blocks as JSON.",
    {
      source: z.string().min(1).describe("IntentText source string"),
      query: z
        .string()
        .optional()
        .describe(
          "Raw query string, e.g. 'type=task owner=Ahmed due<2026-03-01 " +
            "sort:due:asc limit:10'. Takes precedence over the structured filters.",
        ),
      type: z
        .string()
        .optional()
        .describe(
          "Block type to filter by (e.g. 'task', 'step', 'gate'). " +
            "Comma-separated for multiple types: 'step,gate,decision'",
        ),
      content: z
        .string()
        .optional()
        .describe(
          "Substring to search for in block content (case-insensitive)",
        ),
      section: z
        .string()
        .optional()
        .describe(
          "Only return blocks within this section (substring match on section title)",
        ),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of results to return"),
    },
    safe(
      async ({
        source,
        query,
        type,
        content,
        section,
        limit,
      }: {
        source: string;
        query?: string;
        type?: string;
        content?: string;
        section?: string;
        limit?: number;
      }) => {
        const doc = parseIntentText(source);

        if (query && query.trim().length > 0) {
          const result = queryBlocks(doc, query);
          return jsonResult({
            count: result.matched,
            total: result.total,
            blocks: result.blocks,
          });
        }

        const q: SimpleQueryOptions = {};
        if (type) {
          q.type = type.includes(",")
            ? type.split(",").map((t) => t.trim())
            : type;
        }
        if (content) q.content = content;
        if (section) q.section = section;
        if (limit) q.limit = limit;
        const results = queryDocument(doc, q);
        return jsonResult({ count: results.length, blocks: results });
      },
    ),
  );
}
