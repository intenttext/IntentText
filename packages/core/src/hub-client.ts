/**
 * hub-client.ts — submit a completed form to a collecting endpoint (the Hub).
 *
 * The last step of the form lifecycle: a recipient finishes a form and POSTs it
 * back. This is the small, dependency-free CLIENT half (uses the built-in `fetch`,
 * a web standard in Node 18+ and browsers) — the Hub service that receives, verifies
 * and dashboards submissions is a separate backend (apps/hub).
 *
 * The wire contract is deliberately simple and self-describing, so any backend can
 * accept it:
 *
 *   POST <endpoint>
 *   Content-Type: application/json
 *   {
 *     "source":      "<the full .it source>",   // the record of truth
 *     "answers":     { key: value, … },          // structured, queryable (optional)
 *     "hash":        "sha256:…",                  // the document content hash
 *     "submittedAt": "<ISO instant>",
 *     "formId":      "<optional caller-supplied id>"
 *   }
 *
 * The Hub re-derives everything from `source` (answers/hash are conveniences) and
 * SHOULD verify trust itself — verifyDocument (completion seal) and, for two-party
 * forms, verifyFormStructure (the author's structure seal). Never trust the client's
 * `answers`/`hash` over what `source` actually says.
 */

import { isForm, isFormComplete, formAnswers } from "./forms";
import { contentHashOf } from "./seal";

export interface SubmitOptions {
  /** The Hub (or any) endpoint URL to POST the submission to. */
  endpoint: string;
  /** Extra headers (e.g. Authorization). */
  headers?: Record<string, string>;
  /** Caller-supplied id echoed in the payload (e.g. your form/template id). */
  formId?: string;
  /** Include the structured answers alongside the raw source. Default true. */
  includeAnswers?: boolean;
  /** Refuse to submit an incomplete form. Default true. */
  requireComplete?: boolean;
  /** ISO timestamp to stamp (else `new Date()` at call time). */
  submittedAt?: string;
  /** Injectable fetch (for tests / non-global environments). */
  fetchImpl?: typeof fetch;
}

/** The JSON body POSTed to the endpoint (also useful to build a payload offline). */
export interface SubmissionPayload {
  source: string;
  answers?: Record<string, string>;
  hash: string;
  submittedAt: string;
  formId?: string;
}

export interface SubmitResult {
  ok: boolean;
  /** HTTP status, or 0 if the request never left (validation error / network). */
  status: number;
  /** Parsed response body, when JSON. */
  body?: unknown;
  /** Reason when ok is false. */
  error?: string;
}

/** Build the submission payload from a form source (no network). */
export function buildSubmission(source: string, opts?: Partial<SubmitOptions>): SubmissionPayload {
  return {
    source,
    ...(opts?.includeAnswers === false ? {} : { answers: formAnswers(source) }),
    hash: contentHashOf(source),
    submittedAt: opts?.submittedAt ?? new Date().toISOString(),
    ...(opts?.formId ? { formId: opts.formId } : {}),
  };
}

/**
 * Submit a completed form to `endpoint`. Validates it's a complete form first
 * (unless requireComplete is false), POSTs the SubmissionPayload, and returns a
 * structured result (never throws on an HTTP error — check `ok`).
 */
export async function submitForm(
  source: string,
  opts: SubmitOptions,
): Promise<SubmitResult> {
  if (!isForm(source)) {
    return { ok: false, status: 0, error: "not_a_form" };
  }
  if (opts.requireComplete !== false && !isFormComplete(source)) {
    return { ok: false, status: 0, error: "form_incomplete" };
  }
  const payload = buildSubmission(source, opts);
  const doFetch = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!doFetch) {
    return { ok: false, status: 0, error: "no_fetch_available" };
  }
  try {
    const res = await doFetch(opts.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: JSON.stringify(payload),
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      /* non-JSON response */
    }
    return {
      ok: res.ok,
      status: res.status,
      body,
      ...(res.ok ? {} : { error: `http_${res.status}` }),
    };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network_error" };
  }
}
