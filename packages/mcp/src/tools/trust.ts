import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  sealDocument,
  verifyDocument,
  computeDocumentHash,
  parseIntentText,
} from "@dotit/core";
import { jsonResult, safe } from "../types.js";

export function registerTrustTools(server: McpServer): void {
  server.tool(
    "seal_document",
    "Seal an IntentText document for INTEGRITY: append a SHA-256 content hash " +
      "(sign:/seal) and a freeze: marker so later tampering is detectable. This is " +
      "the zero-dependency integrity layer — it proves the content has not changed, " +
      "but NOT cryptographically who sealed it. For provable signer identity, use " +
      "sign_document (Ed25519). Returns the updated source plus the hash and timestamp.",
    {
      source: z.string().min(1).describe("IntentText source string (.it format)"),
      signer: z.string().min(1).describe("Full name of the signer"),
      role: z
        .string()
        .optional()
        .describe("Role and organisation of the signer"),
    },
    safe(
      async ({
        source,
        signer,
        role,
      }: {
        source: string;
        signer: string;
        role?: string;
      }) => {
        const result = sealDocument(source, { signer, role });
        return jsonResult({
          sealed_source: result.source,
          hash: result.hash,
          at: result.at,
        });
      },
    ),
  );

  server.tool(
    "verify_document",
    "Verify the INTEGRITY of a sealed IntentText document: recompute the SHA-256 " +
      "content hash and report whether the document matches its seal (i.e. has not " +
      "been tampered with). This checks content integrity only; to verify WHO signed " +
      "(Ed25519) use verify_signatures, and for authority attestations use " +
      "verify_certification.",
    {
      source: z.string().min(1).describe("IntentText source string (.it format)"),
    },
    safe(async ({ source }: { source: string }) => {
      const result = verifyDocument(source);
      return jsonResult(result);
    }),
  );

  server.tool(
    "compute_hash",
    "Compute the canonical SHA-256 content hash of an IntentText document (the " +
      "same hash used by seal_document and the signature/certification payloads). " +
      "Useful for an ERP to anchor a document in an audit log or external ledger, or " +
      "to compare two documents for content equality. Returns { hash } as " +
      "'sha256:<hex>'.",
    {
      source: z.string().min(1).describe("IntentText source string (.it format)"),
    },
    safe(async ({ source }: { source: string }) => {
      const hash = computeDocumentHash(source);
      return jsonResult({ hash });
    }),
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
    safe(async ({
      source,
      block_id,
      section,
    }: {
      source: string;
      block_id?: string;
      section?: string;
    }) => {
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
    }),
  );
}
