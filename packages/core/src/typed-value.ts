/**
 * typed-value.ts — the reserved typed-value shape (FORMAT-ROADMAP T-05B).
 *
 * Business documents need numbers a machine can compute on (invoice totals, KPIs,
 * quantities) without bespoke string parsing. The reserved shape is simply the
 * SPEC §2 convention made readable:
 *
 *     metric: Total Due | value: 17325 | unit: QAR     →  money   17325 QAR
 *     metric: VAT       | value: 5      | unit: %       →  percent 5
 *     metric: Investment| value: 3.80M  | unit: QAR     →  money   3800000 QAR
 *     metric: Velocity  | value: 42     | unit: points  →  quantity 42 points
 *
 * `value:` holds the bare magnitude (no thousands separators, no currency symbol;
 * a K/M/B/T magnitude suffix and a trailing % are tolerated); `unit:` holds the
 * currency (ISO-4217) or the unit. This module READS that shape — it never mints a
 * `money` type and never re-serializes: the source string stays the byte-of-record,
 * so reading a typed value can never affect a seal.
 */
import { IntentBlock } from "./types";

export type ValueKind = "money" | "percent" | "quantity" | "number" | "text";

export interface TypedValue {
  /** The source string, verbatim — the byte-of-record. */
  raw: string;
  /** The parsed magnitude (commas stripped, K/M/B/T expanded), or null if non-numeric. */
  number: number | null;
  /** The `unit:` property, trimmed, or null. */
  unit: string | null;
  /** The ISO-4217 currency code when `unit:` is one (else null). */
  currency: string | null;
  kind: ValueKind;
}

const ISO_4217 = /^[A-Z]{3}$/;
const MAGNITUDE: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

/** Parse a `value:` string to a number per the reserved shape, or null if non-numeric. */
export function parseNumericValue(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s || s.includes("{{")) return null; // empty or unresolved template placeholder
  s = s.replace(/,/g, "");
  if (/%$/.test(s)) s = s.slice(0, -1).trim(); // trailing percent
  const mag = s.match(/^([+-]?\d*\.?\d+)\s*([kmbtKMBT])$/);
  const n = mag
    ? parseFloat(mag[1]) * MAGNITUDE[mag[2].toLowerCase()]
    : /^[+-]?\d*\.?\d+$/.test(s)
      ? parseFloat(s)
      : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Interpret a `value:` (+ optional `unit:`) as a typed value. Pure / read-only. */
export function readTypedValue(
  rawValue: string | number | null | undefined,
  unit?: string | null,
): TypedValue {
  const raw = rawValue == null ? "" : String(rawValue);
  const number = parseNumericValue(rawValue);
  const u = unit != null && String(unit).trim() ? String(unit).trim() : null;
  let currency: string | null = null;
  let kind: ValueKind;
  if (number == null) {
    kind = "text";
  } else if (u && ISO_4217.test(u)) {
    currency = u;
    kind = "money";
  } else if (u === "%" || /%\s*$/.test(raw)) {
    kind = "percent";
  } else if (u) {
    kind = "quantity";
  } else {
    kind = "number";
  }
  return { raw, number, unit: u, currency, kind };
}

/** Read a `metric:` block's `value:`/`unit:` as a typed value. */
export function metricTypedValue(block: IntentBlock): TypedValue {
  return readTypedValue(
    block?.properties?.value as string | number | undefined,
    block?.properties?.unit as string | undefined,
  );
}
