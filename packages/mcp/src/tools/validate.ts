import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseIntentText, validateDocumentSemantic } from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerValidateTools(server: McpServer): void {
  server.tool(
    "validate_document",
    "Validate an IntentText document for semantic correctness beyond syntax. " +
      "Checks for broken step references, missing required properties, unresolved " +
      "variables, and workflow logic errors. Returns a list of errors and warnings. " +
      "Always call this after generating a workflow document to catch issues before execution.",
    {
      source: z.string().describe("IntentText source string to validate"),
    },
    async ({ source }) => {
      const doc = parseIntentText(source);
      const result = validateDocumentSemantic(doc);
      return jsonResult({
        valid: result.valid,
        error_count: result.issues.filter((i) => i.type === "error").length,
        warning_count: result.issues.filter((i) => i.type === "warning").length,
        issues: result.issues,
      });
    },
  );
}
