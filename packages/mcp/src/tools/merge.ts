import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parseAndMerge,
  renderHTML,
  renderPrint,
  documentToSource,
} from "@dotit/core";
import { textResult } from "../types.js";

export function registerMergeTools(server: McpServer): void {
  server.tool(
    "merge_template",
    "Merge an IntentText template (containing {{variable}} placeholders) with a " +
      "data object. Returns the merged .it source with all variables resolved. " +
      "Use this to generate documents from templates.",
    {
      template: z
        .string()
        .describe("IntentText template source with {{variable}} placeholders"),
      data: z
        .record(z.string(), z.unknown())
        .describe("JSON object with values to substitute into the template"),
      render: z
        .enum(["none", "html", "print"])
        .default("none")
        .describe(
          "Optionally render the merged result. Default: none (returns .it source)",
        ),
      missing: z
        .enum(["keep", "blank"])
        .default("keep")
        .describe(
          "Unresolved {{placeholders}}: 'keep' leaves them visible (default), " +
            "'blank' removes them so optional fields never print",
        ),
    },
    async ({ template, data, render, missing }) => {
      const doc = parseAndMerge(template, data as Record<string, unknown>, {
        missing,
      });
      if (render === "html") {
        return textResult(renderHTML(doc));
      }
      if (render === "print") {
        return textResult(renderPrint(doc));
      }
      return textResult(documentToSource(doc));
    },
  );
}
