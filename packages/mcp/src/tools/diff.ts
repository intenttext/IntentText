import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, diffDocuments } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerDiffTools(server: McpServer): void {
  server.tool(
    "diff_documents",
    "Compare two versions of an IntentText document and return a semantic diff. " +
      "Shows which blocks were added, removed, or modified between versions. " +
      "More meaningful than a line diff — tells you what changed in the document's structure.",
    {
      before: z.string().describe("The original IntentText source"),
      after: z.string().describe("The updated IntentText source"),
    },
    async ({ before, after }) => {
      const docBefore = parseIntentText(before);
      const docAfter = parseIntentText(after);
      const diff = diffDocuments(docBefore, docAfter);
      return jsonResult(diff);
    },
  );
}
