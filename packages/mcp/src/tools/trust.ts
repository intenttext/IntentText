import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  sealDocument,
  verifyDocument,
  parseIntentText,
} from "@intenttext/core";
import { jsonResult } from "../types.js";

export function registerTrustTools(server: McpServer): void {
  server.tool(
    "seal_document",
    "Seal an IntentText document with a cryptographic signature and freeze it. " +
      "Returns the updated source with sign: and freeze: blocks appended.",
    {
      source: z.string().describe("IntentText source string (.it format)"),
      signer: z.string().describe("Full name of the signer"),
      role: z
        .string()
        .optional()
        .describe("Role and organisation of the signer"),
    },
    async ({ source, signer, role }) => {
      const result = sealDocument(source, { signer, role });
      return jsonResult({
        sealed_source: result.source,
        hash: result.hash,
        at: result.at,
      });
    },
  );

  server.tool(
    "verify_document",
    "Verify the integrity of a sealed IntentText document. " +
      "Checks the cryptographic hash and reports whether the document has been tampered with.",
    {
      source: z.string().describe("IntentText source string (.it format)"),
    },
    async ({ source }) => {
      const result = verifyDocument(source);
      return jsonResult(result);
    },
  );

  server.tool(
    "get_document_history",
    "Get the change history of a tracked IntentText document. " +
      "Returns revision entries showing what changed, who changed it, and when.",
    {
      source: z.string().describe("IntentText source string (.it format)"),
      block_id: z
        .string()
        .optional()
        .describe("Filter history to a specific block ID"),
      section: z
        .string()
        .optional()
        .describe("Filter history to a specific section name"),
    },
    async ({ source, block_id, section }) => {
      const doc = parseIntentText(source, { includeHistorySection: true });
      const history = doc.history;

      if (!history) {
        return jsonResult({
          revisions: [],
          version: doc.metadata?.tracking?.version ?? "unknown",
          error: "No history section found. Is this document tracked?",
        });
      }

      let revisions = history.revisions ?? [];

      if (block_id) {
        revisions = revisions.filter((r) => r.id === block_id);
      }
      if (section) {
        revisions = revisions.filter((r) => r.section === section);
      }

      return jsonResult({
        revisions,
        version: doc.metadata?.tracking?.version ?? "unknown",
        registry: history.registry,
      });
    },
  );
}
