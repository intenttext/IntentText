import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  parseIntentText,
  renderHTML,
  renderPrint,
  listBuiltinThemes,
} from "@dotit/core";
import { textResult, safe } from "../types.js";

export function registerRenderTools(server: McpServer): void {
  server.tool(
    "render_html",
    "Render an IntentText source string to styled HTML. " +
      "Returns a complete HTML string ready to display in a browser.",
    {
      source: z.string().min(1).describe("IntentText source string (.it format)"),
      theme: z
        .string()
        .optional()
        .describe(
          `Optional built-in theme name (one of: ${listBuiltinThemes().join(", ")})`,
        ),
    },
    safe(async ({ source, theme }: { source: string; theme?: string }) => {
      const doc = parseIntentText(source);
      const html = renderHTML(doc, theme ? { theme } : undefined);
      return textResult(html);
    }),
  );

  server.tool(
    "render_print",
    "Render an IntentText document to print-ready (paged) HTML with @media print CSS, " +
      "applying font:, page:, and divider settings. This is the MCP path to a printable " +
      "document: pass this HTML to any HTML-to-PDF renderer (e.g. @dotit/pdf server-side, " +
      "or the browser print dialog). The MCP itself does not run a headless browser, so it " +
      "returns print-ready HTML rather than a PDF binary.",
    {
      source: z.string().min(1).describe("IntentText source string"),
      theme: z
        .string()
        .optional()
        .describe(
          `Optional built-in theme name (one of: ${listBuiltinThemes().join(", ")})`,
        ),
    },
    safe(async ({ source, theme }: { source: string; theme?: string }) => {
      const doc = parseIntentText(source);
      const html = renderPrint(doc, theme ? { theme } : undefined);
      return textResult(html);
    }),
  );
}
