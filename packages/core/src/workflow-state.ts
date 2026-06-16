/**
 * workflow-state.ts — in-file approval routing, DERIVED (never stored).
 *
 * The moat: a `.it` document carries its own approval workflow, and its live
 * state is DERIVED from the file — so the document is the single source of truth
 * and can never drift from a separate database.
 *
 * A document declares its approval policy with `route:` + `require:` lines:
 *
 *     route: sequential                       # or `parallel` (default: sequential)
 *     require: manager
 *     require: finance | when: amount > 100000
 *     require: legal
 *
 * and collects fulfillment as ordinary `approve:` lines (already part of the
 * trust model, inside the sealed body):
 *
 *     approve: Reviewed | by: Sarah | role: manager | at: 2026-03-20
 *
 * `workflowState(source)` then DERIVES `{ pending, next, complete, … }` purely
 * from those lines — nothing is stored, so re-deriving always matches the file.
 * Conditional requirements (`when:`) are evaluated against the document's own
 * values (metric:/meta:) on the same safe, no-`eval` evaluator forms use.
 *
 * `route:`/`require:` are interpreted here; the parser preserves them verbatim as
 * `custom` blocks (unknown-keyword guarantee), so they round-trip byte-for-byte
 * and a sealed document keeps its hash.
 */

import { parseIntentText } from "./parser";
import { IntentDocument, IntentBlock } from "./types";
import { parseCondition, evalCondition } from "./field-logic";
import { flattenBlocks } from "./utils";

export interface RequiredApprover {
  /** The role (or name) token from `require: <token>` — matched against an
   *  approve: line's `role:` or `by:`. */
  match: string;
  /** Conditional: this approver is only required while the condition holds
   *  (evaluated against the document's own metric:/meta values). */
  when?: string;
  /** `require: X | optional: yes` — informational; never blocks completion. */
  optional: boolean;
}

export interface ApprovalRoute {
  order: "sequential" | "parallel";
  required: RequiredApprover[];
}

export interface WorkflowState {
  /** True when the document declares a `route:`/`require:` policy. */
  hasRoute: boolean;
  order: "sequential" | "parallel";
  /** The declared requirements, verbatim. */
  required: RequiredApprover[];
  /** Requirements currently in force (their `when:` holds, or none). */
  active: RequiredApprover[];
  /** Active required match-tokens that have a matching approval. */
  fulfilled: string[];
  /** Active required (non-optional) match-tokens still awaiting approval,
   *  in declared order. */
  pending: string[];
  /** Sequential: the first pending approver. Parallel/none: null. */
  next: string | null;
  /** True when every active, required approver has approved. */
  complete: boolean;
}

const norm = (s: unknown): string =>
  String(s ?? "")
    .trim()
    .toLowerCase();

/** Extract the `route:`/`require:` policy from a document (custom blocks). */
export function extractRoute(doc: IntentDocument): ApprovalRoute | null {
  const isKw = (b: IntentBlock, kw: string) =>
    b.type === "custom" && norm(b.properties?.keyword) === kw;

  // Flatten so route:/require: are found wherever they sit (incl. under sections).
  const all = flattenBlocks(doc.blocks);
  const routeBlock = all.find((b) => isKw(b, "route"));
  const requireBlocks = all.filter((b) => isKw(b, "require"));
  if (!routeBlock && requireBlocks.length === 0) return null;

  const orderRaw = norm(routeBlock?.content) || norm(routeBlock?.properties?.order);
  const order: ApprovalRoute["order"] =
    orderRaw === "parallel" ? "parallel" : "sequential";

  const required: RequiredApprover[] = requireBlocks.map((b) => ({
    match: norm(b.content) || norm(b.properties?.role) || norm(b.properties?.by),
    when: b.properties?.when != null ? String(b.properties.when) : undefined,
    optional: norm(b.properties?.optional) === "yes" || norm(b.properties?.optional) === "true",
  }));

  return { order, required };
}

/**
 * Build a name→value map from the document's own data (metric: labels/keys and
 * meta: properties), used to evaluate `when:` conditions like `amount > 100000`.
 */
function documentValues(doc: IntentDocument): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  for (const b of flattenBlocks(doc.blocks)) {
    if (b.type === "metric") {
      const label = norm(b.content);
      const v = b.properties?.value;
      if (label && v != null) values[label] = String(v);
      const key = b.properties?.key;
      if (key != null && v != null) values[norm(key)] = String(v);
    }
  }
  const meta = doc.metadata?.meta;
  if (meta) for (const [k, v] of Object.entries(meta)) values[norm(k)] = String(v);
  return values;
}

/** True when a requirement is currently in force (its `when:` holds, or none). */
function isActive(req: RequiredApprover, values: Record<string, string>): boolean {
  if (!req.when || !req.when.trim()) return true;
  // Unresolvable conditions default to ACTIVE — never silently drop a required
  // approval because a value was missing.
  const cond = parseCondition(req.when);
  if (!cond) return true;
  return evalCondition(cond, values);
}

/**
 * Derive the live approval state of a document from its `route:`/`require:`
 * policy and its `approve:` lines. Pure: re-deriving always matches the file.
 */
export function workflowState(source: string): WorkflowState {
  const doc = parseIntentText(source);
  const route = extractRoute(doc);

  if (!route) {
    return {
      hasRoute: false,
      order: "sequential",
      required: [],
      active: [],
      fulfilled: [],
      pending: [],
      next: null,
      complete: true, // no policy → nothing outstanding
    };
  }

  const values = documentValues(doc);

  // Who has actually approved — collect role and by tokens from approve: lines.
  const approvedTokens = new Set<string>();
  for (const b of flattenBlocks(doc.blocks)) {
    if (b.type === "approve") {
      if (b.properties?.role) approvedTokens.add(norm(b.properties.role));
      if (b.properties?.by) approvedTokens.add(norm(b.properties.by));
    }
  }

  const active = route.required.filter((r) => isActive(r, values));
  const fulfilled: string[] = [];
  const pending: string[] = [];
  for (const req of active) {
    if (approvedTokens.has(req.match)) fulfilled.push(req.match);
    else if (!req.optional) pending.push(req.match);
  }

  return {
    hasRoute: true,
    order: route.order,
    required: route.required,
    active,
    fulfilled,
    pending,
    next: route.order === "sequential" ? (pending[0] ?? null) : null,
    complete: pending.length === 0,
  };
}
