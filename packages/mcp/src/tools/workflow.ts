import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, extractWorkflow } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerWorkflowTools(server: McpServer): void {
  server.tool(
    "extract_workflow",
    "Extract the execution graph from an IntentText workflow document. " +
      "Returns steps in topological order, dependency relationships, parallel batches, " +
      "and gate positions. Use this to understand how to execute a workflow before running it.",
    {
      source: z
        .string()
        .describe(
          "IntentText source containing workflow blocks (step:, decision:, gate:, etc.)",
        ),
    },
    async ({ source }) => {
      const doc = parseIntentText(source);
      const workflow = extractWorkflow(doc);
      return jsonResult(workflow);
    },
  );
}
