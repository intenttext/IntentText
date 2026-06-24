import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  convertMarkdownToIntentText,
  convertIntentTextToMarkdown,
  convertHtmlToIntentText,
} from "@dotit/core";
import { textResult, safe } from "../types.js";

export function registerConvertTools(server: McpServer): void {
  server.tool(
    "markdown_to_intenttext",
    "Convert Markdown → IntentText (.it). Headings → title/section/sub, fenced code, " +
      "lists, tables, blockquotes, images and links map across; ordinary paragraphs " +
      "become clean BARE prose (text: only when a line would parse as a keyword). " +
      "Use to import Markdown into the typed .it format.",
    {
      markdown: z.string().min(1).describe("The Markdown source to convert"),
    },
    safe(async ({ markdown }: { markdown: string }) =>
      textResult(convertMarkdownToIntentText(markdown)),
    ),
  );

  server.tool(
    "intenttext_to_markdown",
    "Convert IntentText (.it) → clean GitHub-flavored Markdown. Headings, prose, lists, " +
      "task lists, tables, fenced code, blockquotes, images and links map 1:1; typed and " +
      "custom blocks (metric:, clause:, sign:, …) degrade to readable **keyword:** labeled " +
      "lines so no content is lost. Use to export .it for tools or models that expect Markdown.",
    {
      source: z.string().min(1).describe("The IntentText (.it) source to convert"),
    },
    safe(async ({ source }: { source: string }) =>
      textResult(convertIntentTextToMarkdown(source)),
    ),
  );

  server.tool(
    "html_to_intenttext",
    "Convert HTML → IntentText (.it). Headings, paragraphs (as bare prose), lists, tables, " +
      "code, blockquotes, images and links map across; scripts/styles are dropped. " +
      "Use to import an HTML page into the typed .it format.",
    {
      html: z.string().min(1).describe("The HTML source to convert"),
    },
    safe(async ({ html }: { html: string }) =>
      textResult(convertHtmlToIntentText(html)),
    ),
  );
}
