import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, parseIntentTextSafe } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerParseTools(server: McpServer): void {
  server.tool(
    "parse_intent_text",
    "Parse an IntentText (.it) source string into a structured JSON document. " +
      "Returns the complete document with metadata and typed blocks array. " +
      "Use this when you have raw .it text and need to inspect or process its structure.",
    {
      source: z.string().describe("The IntentText source string to parse"),
      safe: z
        .boolean()
        .default(true)
        .describe(
          "If true, never throw — returns warnings instead of errors. Default: true",
        ),
    },
    async ({ source, safe }) => {
      if (safe) {
        const result = parseIntentTextSafe(source);
        return jsonResult({
          document: result.document,
          warnings: result.warnings,
          errors: result.errors,
        });
      } else {
        const document = parseIntentText(source);
        return jsonResult(document);
      }
    },
  );
}
