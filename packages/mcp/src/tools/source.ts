import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentToSource } from "@intenttext/core";
import type { IntentDocument } from "@intenttext/core";
import { textResult } from "../types.js";

export function registerSourceTools(server: McpServer): void {
  server.tool(
    "document_to_source",
    "Convert an IntentText JSON document back to .it source format. " +
      "Use this when you have a document stored as JSON (e.g. from a database) " +
      "and need to display or edit it as .it text.",
    {
      document: z
        .record(z.string(), z.unknown())
        .describe(
          "An IntentText document JSON object (as produced by parse_intent_text)",
        ),
    },
    async ({ document }) => {
      const source = documentToSource(document as unknown as IntentDocument);
      return textResult(source);
    },
  );
}
