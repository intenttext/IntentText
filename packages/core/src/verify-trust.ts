/**
 * verify-trust.ts — one aggregate trust verdict.
 *
 * `verifyDocument` alone checks the SEAL only (body + signatures + appearance +,
 * for v4+ seals, the committed history digest). A user-facing "Verify" must also
 * confirm the approval hash-CHAIN and, for a form, the two-party structure seal —
 * otherwise chain/history tampering can slip past a green seal check. `verifyTrust`
 * runs all three and reduces them to a single `ok` verdict.
 */

import { verifyDocument, VerifyResult } from "./trust";
import { verifyAuditChain, AuditChainResult } from "./audit-chain";
import {
  verifyFormStructure,
  FormStructureVerification,
} from "./form-trust";

export interface TrustVerification {
  /** The single green/red verdict for a "Verify" action: the seal is intact, its
   *  committed audit/history log is unchanged, the approval chain is valid, and
   *  (for a form) the two-party structure seal holds. */
  ok: boolean;
  /** Seal / signature / appearance / committed-history verdict. */
  seal: VerifyResult;
  /** Approval-order (hash-chain) verdict — insert / delete-middle / reorder / edit
   *  of a chained approval is detected. */
  auditChain: AuditChainResult;
  /** Two-party form-structure verdict — present only for a sealed form. */
  form?: FormStructureVerification;
}

/**
 * Verify everything trust-related in one call. Prefer this over `verifyDocument`
 * for any surface that shows the user a trust verdict.
 */
export function verifyTrust(source: string): TrustVerification {
  const seal = verifyDocument(source);
  const auditChain = verifyAuditChain(source);
  const form = verifyFormStructure(source);
  const ok =
    seal.frozen &&
    seal.intact &&
    auditChain.valid &&
    (!form.sealed || form.intact);
  return {
    ok,
    seal,
    auditChain,
    ...(form.sealed ? { form } : {}),
  };
}
