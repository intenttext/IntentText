/**
 * conformance.ts — the named conformance check (FORMAT-ROADMAP T-16).
 *
 * A producer (an ERP, an archive pipeline, a CI job) needs a single yes/no answer:
 * "is this a conformant `.it` document?" This is the read-only gate that answers it,
 * layered over the existing parser diagnostics + semantic validator. It NEVER mutates
 * or rewrites the document — it only reports.
 *
 * Two levels (see SPEC §8):
 *   • lax (default) — parses with NO error-level issues. Unknown keywords are fine
 *     (they pass through as `custom` — that is the open-keyword guarantee, not an error).
 *   • strict        — no errors AND no warnings (e.g. all dates ISO 8601). The level a
 *     publisher certifies when it wants a spotless document.
 *
 * Leaf module: imports parser + validate, imported by neither — no dependency cycle.
 */
import { parseIntentText } from "./parser";
import { validateDocumentSemantic, SemanticIssue } from "./validate";
import { IntentDocument } from "./types";

export type ConformanceLevel = "lax" | "strict";

export interface ConformanceReport {
  /** Does the document meet the requested level? */
  conformant: boolean;
  level: ConformanceLevel;
  /** Count of error-level issues (always fail conformance). */
  errors: number;
  /** Count of warning-level issues (fail only in strict mode). */
  warnings: number;
  /** Every issue found — parser diagnostics + semantic validation, in one list. */
  issues: SemanticIssue[];
}

/**
 * Check whether `.it` source (or an already-parsed document) is conformant.
 * Pure / read-only. Default level is "lax".
 */
export function checkConformance(
  input: string | IntentDocument,
  options: { level?: ConformanceLevel } = {},
): ConformanceReport {
  const level = options.level ?? "lax";
  const doc = typeof input === "string" ? parseIntentText(input) : input;

  const issues: SemanticIssue[] = [...validateDocumentSemantic(doc).issues];

  // Fold parse-time structural diagnostics (unterminated code fence, headers without
  // rows, unknown EXTENSION keyword, …) into the same report shape.
  for (const d of doc.diagnostics ?? []) {
    issues.push({
      blockId: "",
      blockType: "",
      type: d.severity, // "error" | "warning"
      code: d.code,
      message: d.message,
    });
  }

  const errors = issues.filter((i) => i.type === "error").length;
  const warnings = issues.filter((i) => i.type === "warning").length;
  const conformant = level === "strict" ? errors === 0 && warnings === 0 : errors === 0;

  return { conformant, level, errors, warnings, issues };
}
