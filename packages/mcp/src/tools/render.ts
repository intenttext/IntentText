import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  listBuiltinThemes,
} from "@dotit/core";
import { textResult } from "../types.js";

export function registerRenderTools(server: McpServer): void {
  server.tool(
    "render_html",
    "Render an IntentText source string to styled HTML. " +
      "Returns a complete HTML string ready to display in a browser.",
    {
      source: z.string().describe("IntentText source string (.it format)"),
      theme: z
        .string()
        .optional()
        .describe(
          `Optional built-in theme name (one of: ${listBuiltinThemes().join(", ")})`,
        ),
    },
    async ({ source, theme }) => {
      const doc = parseIntentText(source);
      const html = renderHTML(doc, theme ? { theme } : undefined);
      return textResult(html);
    },
  );

  server.tool(
    "render_print",
    "Render an IntentText document to print-optimised HTML with @media print CSS. " +
      "Applies font: and page: block settings. Suitable for PDF generation.",
    {
      source: z.string().describe("IntentText source string"),
      theme: z
        .string()
        .optional()
        .describe(
          `Optional built-in theme name (one of: ${listBuiltinThemes().join(", ")})`,
        ),
    },
    async ({ source, theme }) => {
      const doc = parseIntentText(source);
      const html = renderPrint(doc, theme ? { theme } : undefined);
      return textResult(html);
    },
  );
}
