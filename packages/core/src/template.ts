/**
 * template.ts — is this `.it` a TEMPLATE (a blueprint) or a DOCUMENT (final)?
 *
 * This distinction gates the trust workflow. A template is not a finished record:
 * it carries fill-in slots that get resolved by `mergeData` to produce the actual
 * document. Applying trust (seal/sign/certify) to a template is not just pointless
 * but BROKEN — the hash would cover placeholder text, and the later merge changes
 * the content, so any signature would fail to verify on the real output. Trust
 * therefore belongs only on the merged document.
 *
 * A file is a template when ANY of these hold (mirrors validate.ts):
 *   1. it declares `meta: | type: template` (the explicit, canonical marker);
 *   2. it has `input:` fields (interactive fill-in slots);
 *   3. it carries unresolved merge variables `{{ … }}`;
 *   4. it has pending tracked changes (redlines) — the content is "in review",
 *      not final, until those are accepted/rejected (see redline.ts).
 *
 * IMPORTANT: an EMPTY value (`client:` with nothing after it) is NOT a template
 * signal. A final document may legitimately leave a field blank, and it must stay
 * trustable. Only `{{ }}` placeholders / input fields / the explicit marker count.
 * The print tokens `{{page}}` and `{{pages}}` are render-time, not merge variables,
 * so they never make a document a template.
 */

import { isForm, isFormComplete } from "./forms";
import { hasTrackedChanges } from "./redline";

const META_TEMPLATE = /^\s*meta:\s*(?:\|[^\n]*)?\btype:\s*template\b/im;
const INPUT_BLOCK = /^\s*input:/im;
const MERGE_VAR = /\{\{\s*([^}]+?)\s*\}\}/g;

/** True if the source carries a merge variable other than the print tokens. */
export function hasUnresolvedMergeVars(source: string): boolean {
  const re = new RegExp(MERGE_VAR);
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[1].trim().toLowerCase();
    if (name === "page" || name === "pages") continue; // render-time tokens
    return true;
  }
  return false;
}

/**
 * Is this source a TEMPLATE (outside the trust workflow)? Explicit
 * `meta: type: template`, `input:` fields, or unresolved `{{ }}` variables.
 * Empty property values do NOT count.
 *
 * FORMS are the deliberate exception: a `meta: type: form` document whose required
 * fields are ALL filled is a COMPLETE form — a final, signable record, not a
 * blueprint. A blank/incomplete form is still template-like (an unfilled form is a
 * fill-in slot, same as any template). See forms.ts.
 */
export function isTemplate(source: string): boolean {
  if (!source) return false;
  if (META_TEMPLATE.test(source)) return true;
  if (hasUnresolvedMergeVars(source)) return true;
  // Pending tracked changes mean the document is still "in review": its content is
  // ambiguous (does the reader see the insertion or the deletion?). Sealing it would
  // fix an unresolved state. Accept/reject all changes first, then trust the result.
  if (hasTrackedChanges(source)) return true;
  // A form's trust status is governed by completeness, not by the presence of
  // `input:` fields (every form has them).
  if (isForm(source)) return !isFormComplete(source);
  if (INPUT_BLOCK.test(source)) return true;
  return false;
}

/**
 * Throw if `source` is a template — the guard for trust operations. `op` names
 * the refused action for the error message (e.g. "sealed", "signed").
 */
export function assertNotTemplate(source: string, op: string): void {
  if (isTemplate(source)) {
    throw new Error(
      `This is a template, so it cannot be ${op}. Templates are blueprints with ` +
        `fill-in slots ({{ … }} / input: / meta: type: template); trust applies only ` +
        `to the final document. Merge it with data (mergeData) first, then ${op.replace(/ed$/, "")} the result.`,
    );
  }
}
