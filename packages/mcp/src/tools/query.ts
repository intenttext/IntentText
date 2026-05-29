import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, queryDocument } from "@intenttext/core";
import type { SimpleQueryOptions } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerQueryTools(server: McpServer): void {
  server.tool(
    "query_document",
    "Query an IntentText document for specific blocks by type, content, or properties. " +
      "Returns matching blocks as JSON. Use this to extract tasks, steps, decisions, " +
      "or any other block type from a document.",
    {
      source: z.string().describe("IntentText source string"),
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
        .optional()
        .describe("Maximum number of results to return"),
    },
    async ({ source, type, content, section, limit }) => {
      const doc = parseIntentText(source);
      const query: SimpleQueryOptions = {};
      if (type) {
        query.type = type.includes(",")
          ? type.split(",").map((t) => t.trim())
          : type;
      }
      if (content) query.content = content;
      if (section) query.section = section;
      if (limit) query.limit = limit;
      const results = queryDocument(doc, query);
      return jsonResult({ count: results.length, blocks: results });
    },
  );
}
