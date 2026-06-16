/**
 * field-logic.ts — conditional + computed form fields (Forms V2).
 *
 * Two field behaviours that keep complex intake forms on `.it` instead of bespoke
 * code:
 *   • CONDITIONAL — `input: VAT no | key: vat | show-if: country = SA` only shows
 *     (and only counts toward completeness) when the condition holds.
 *   • COMPUTED   — `input: Total | key: total | type: number | compute: qty * price`
 *     derives its value from other fields; the recipient never types it.
 *
 * Both run on a SAFE evaluator (no `eval`/`Function`): a tiny recursive-descent
 * arithmetic parser for `compute:` and a single-comparison parser for `show-if:`.
 * Pure (no forms.ts import) so forms.ts can use it without a dependency cycle. The
 * form-level wiring (visibility map, computed values, write-back) lives in forms.ts.
 */

export type CompareOp = "==" | "!=" | ">" | "<" | ">=" | "<=";

export interface Condition {
  key: string;
  op: CompareOp;
  /** The literal compared against (string; numeric comparison when both parse). */
  value: string;
}

/** Parse a `show-if:` expression `key <op> value` (one comparison), or null. */
export function parseCondition(expr: string): Condition | null {
  const m = /^\s*([\w.]+)\s*(>=|<=|!=|==|=|>|<)\s*(.+?)\s*$/.exec(expr ?? "");
  if (!m) return null;
  const op = (m[2] === "=" ? "==" : m[2]) as CompareOp;
  return { key: m[1], op, value: m[3].trim() };
}

const num = (s: string) => parseFloat(String(s ?? "").replace(/,/g, ""));

/** Evaluate a parsed condition against a key→value map. Numeric when both sides parse. */
export function evalCondition(
  cond: Condition | null,
  vars: Record<string, string>,
): boolean {
  if (!cond) return true;
  const a = vars[cond.key] ?? "";
  const b = cond.value;
  const na = num(a);
  const nb = num(b);
  const numeric = Number.isFinite(na) && Number.isFinite(nb);
  switch (cond.op) {
    case "==":
      return numeric ? na === nb : a.trim() === b;
    case "!=":
      return numeric ? na !== nb : a.trim() !== b;
    case ">":
      return numeric ? na > nb : a > b;
    case "<":
      return numeric ? na < nb : a < b;
    case ">=":
      return numeric ? na >= nb : a >= b;
    case "<=":
      return numeric ? na <= nb : a <= b;
    default:
      return true;
  }
}

/** True if a `show-if:` expression holds (an absent/empty expr is always visible). */
export function conditionHolds(
  showIf: string | undefined,
  vars: Record<string, string>,
): boolean {
  if (!showIf || !showIf.trim()) return true;
  return evalCondition(parseCondition(showIf), vars);
}

/**
 * Evaluate a `compute:` arithmetic expression over field values. Supports + - * /,
 * parentheses, numbers and identifiers (resolved from `vars`, commas stripped,
 * non-numeric → 0). SAFE: a hand-written recursive-descent parser, never `eval`.
 * Returns NaN only if the expression is structurally empty.
 */
export function computeValue(
  expr: string,
  vars: Record<string, string>,
): number {
  const tokens = (expr ?? "").match(/\d+\.?\d*|[A-Za-z_][\w.]*|[-+*/()]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  const factor = (): number => {
    const t = peek();
    if (t === "(") {
      eat();
      const v = expr_();
      if (peek() === ")") eat();
      return v;
    }
    if (t === "-") {
      eat();
      return -factor();
    }
    if (t === "+") {
      eat();
      return factor();
    }
    eat();
    if (t === undefined) return 0;
    if (/^\d/.test(t)) return parseFloat(t);
    const v = num(vars[t]);
    return Number.isFinite(v) ? v : 0;
  };
  const term = (): number => {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = eat();
      const r = factor();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  };
  const expr_ = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = eat();
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  if (tokens.length === 0) return NaN;
  const result = expr_();
  return Number.isFinite(result) ? result : 0;
}

/** Format a computed number for display/storage: integers plain, else up to 2 dp. */
export function formatComputed(n: number): string {
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}
