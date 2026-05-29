import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, renderHTML, renderPrint } from "@intenttext/core";
import { textResult } from "../types.js";

export function registerRenderTools(server: McpServer): void {
  server.tool(
    "render_html",
    "Render an IntentText source string to styled HTML. " +
      "Returns a complete HTML string ready to display in a browser.",
    {
      source: z.string().describe("IntentText source string (.it format)"),
    },
    async ({ source }) => {
      const doc = parseIntentText(source);
      const html = renderHTML(doc);
      return textResult(html);
    },
  );

  server.tool(
    "render_print",
    "Render an IntentText document to print-optimised HTML with @media print CSS. " +
      "Applies font: and page: block settings. Suitable for PDF generation.",
    {
      source: z.string().describe("IntentText source string"),
    },
    async ({ source }) => {
      const doc = parseIntentText(source);
      const html = renderPrint(doc);
      return textResult(html);
    },
  );
}
