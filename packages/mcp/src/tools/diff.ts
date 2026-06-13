import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, diffDocuments } from "@dotit/core";
import { jsonResult, safe } from "../types.js";

export function registerDiffTools(server: McpServer): void {
  server.tool(
    "diff_documents",
    "Compare two versions of an IntentText document and return a semantic diff. " +
      "Shows which blocks were added, removed, or modified between versions. " +
      "More meaningful than a line diff — tells you what changed in the document's structure.",
    {
      before: z.string().min(1).describe("The original IntentText source"),
      after: z.string().min(1).describe("The updated IntentText source"),
    },
    safe(async ({ before, after }: { before: string; after: string }) => {
      const docBefore = parseIntentText(before);
      const docAfter = parseIntentText(after);
      const diff = diffDocuments(docBefore, docAfter);
      return jsonResult(diff);
    }),
  );
}
