import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  verifyDocumentSignatures,
  verifyCertifications,
  signDocumentCrypto,
  generateSigningKey,
} from "@dotit/sign";
import { jsonResult, safe } from "../types.js";

/**
 * Cryptographic trust tools (@dotit/sign — Ed25519 identity + UTS certification).
 *
 * Trust model exposed here:
 *   - VERIFY operations need no secret and are always safe — an ERP agent can
 *     check who signed a document and whether an authority certified it offline.
 *   - SIGNING requires the caller to supply their OWN private key; it is used
 *     only in-process for this single call and never stored or logged.
 *   - Certification ISSUANCE is deliberately NOT exposed: it belongs to the UTS
 *     authority service (api.uts.qa), whose private key must never leave its
 *     server. This MCP only VERIFIES certifications.
 */
export function registerSignTools(server: McpServer): void {
  server.tool(
    "verify_signatures",
    "Verify every Ed25519 cryptographic signature in an IntentText document " +
      "against its CURRENT content. Read-only and offline — needs no key. Returns " +
      "one entry per sign: line (signer, role, at, public key, valid) plus a count " +
      "of valid signatures and allSignaturesValid. A signature is valid only if it " +
      "matches the current content, so any edit after signing flips it to invalid. " +
      "Lines without crypto fields are reported as text-only approvals " +
      "(cryptographic:false). This is the highest-value enterprise check: it proves " +
      "WHO signed and that the content is unchanged.",
    {
      source: z
        .string()
        .min(1)
        .describe("IntentText source string (.it format) to verify"),
    },
    safe(async ({ source }: { source: string }) => {
      const result = verifyDocumentSignatures(source);
      return jsonResult(result);
    }),
  );

  server.tool(
    "verify_certification",
    "Verify UTS (or other authority) certifications embedded in an IntentText " +
      "document. A certification proves an authority attested that this exact " +
      "content existed at a stated time, from a stated (optionally KYC-verified) " +
      "account/entity. Read-only and offline. Pass trustedKey — the authority's " +
      "PUBLISHED Ed25519 public key (for UTS, fetch it from " +
      "https://api.uts.qa/.well-known/uts-pubkey) — so a forged line with a " +
      "different key is rejected. Without trustedKey, signatureValid is still " +
      "reported but trusted/valid are false (you cannot trust a key you do not " +
      "know). Returns {issuer, account, entity, at, signatureValid, trusted, valid} " +
      "per certify: line. Note: issuing certifications is done by the UTS service, " +
      "never by this MCP.",
    {
      source: z
        .string()
        .min(1)
        .describe("IntentText source string (.it format) to verify"),
      issuer: z
        .string()
        .default("UTS")
        .describe(
          "The certification issuer name to trust. Default: 'UTS' (matches the " +
            "issuer in UTS-issued certify: lines).",
        ),
      trustedKey: z
        .string()
        .optional()
        .describe(
          "The issuer's published Ed25519 public key (base64url, ed25519: prefix " +
            "optional). For UTS, from https://api.uts.qa/.well-known/uts-pubkey. " +
            "Omit to report signature validity without asserting trust.",
        ),
    },
    safe(
      async ({
        source,
        issuer,
        trustedKey,
      }: {
        source: string;
        issuer: string;
        trustedKey?: string;
      }) => {
        const trustedIssuers: Record<string, string> = {};
        if (trustedKey) {
          trustedIssuers[issuer] = trustedKey.replace(/^ed25519:/, "");
        }
        const certifications = verifyCertifications(source, trustedIssuers);
        return jsonResult({
          trustedIssuerProvided: Boolean(trustedKey),
          count: certifications.length,
          certifications,
        });
      },
    ),
  );

  server.tool(
    "sign_document",
    "Add an Ed25519 cryptographic signature to an IntentText document using a " +
      "private key the CALLER supplies. SECURITY: the privateKey is required, is " +
      "used only in-process for this single call, and is NEVER stored, logged, or " +
      "transmitted anywhere. Intended for ERPs that hold their own signing key. " +
      "The signature binds the current content hash, signer name, role, and " +
      "timestamp, and embeds the public key so the document self-verifies offline. " +
      "Idempotent per public key (signing twice with the same key is a no-op). " +
      "Returns the updated .it source. Generate a key first with generate_signing_key.",
    {
      source: z
        .string()
        .min(1)
        .describe("IntentText source string (.it format) to sign"),
      signer: z.string().min(1).describe("Full name of the signer"),
      role: z
        .string()
        .optional()
        .describe("Role and organisation of the signer (e.g. 'CFO, Acme WLL')"),
      privateKey: z
        .string()
        .min(1)
        .describe(
          "The caller's Ed25519 private key (base64url, as produced by " +
            "generate_signing_key). Used in-process only; never stored.",
        ),
    },
    safe(
      async ({
        source,
        signer,
        role,
        privateKey,
      }: {
        source: string;
        signer: string;
        role?: string;
        privateKey: string;
      }) => {
        const result = signDocumentCrypto(source, {
          signer,
          role,
          privateKey,
        });
        return jsonResult({
          signed_source: result.source,
          at: result.at,
          publicKey: result.publicKey,
          note: result.note,
        });
      },
    ),
  );

  server.tool(
    "generate_signing_key",
    "Generate a fresh Ed25519 signing keypair for signing IntentText documents. " +
      "Returns {publicKey, privateKey} as base64url strings. SECURITY: the caller " +
      "MUST store the privateKey securely (e.g. ERP secret store / KMS) — it is " +
      "shown once and never persisted by this server. The publicKey is safe to " +
      "share and is embedded in signatures so documents self-verify. Use the " +
      "privateKey with sign_document.",
    {},
    safe(async () => {
      const key = generateSigningKey();
      return jsonResult({
        publicKey: key.publicKey,
        privateKey: key.privateKey,
        warning:
          "Store privateKey securely. It is not stored by this server and " +
          "cannot be recovered if lost.",
      });
    }),
  );
}
