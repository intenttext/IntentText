/**
 * IntentText Keyword Aliases
 *
 * Maps alias keywords to their canonical equivalents.
 * The parser resolves aliases before any processing.
 *
 * TO ADD AN ALIAS:
 *   1. Open this file
 *   2. Add one line: 'alias': 'canonical'
 *   3. Done. No other files need to change.
 *
 * Rules:
 *   - Aliases are input-only. documentToSource always writes canonical keywords.
 *   - Aliases resolve before validation, rendering, and history tracking.
 *   - An alias cannot point to another alias — only to canonical keywords.
 *   - Aliases are case-insensitive (handled by parser before lookup).
 */

export const ALIASES: Record<string, string> = {
  // ── Writer aliases ──────────────────────────────────────────────────────
  text: "note",
  body: "note",
  p: "note",
  paragraph: "note",
  h1: "title",
  h2: "section",
  h3: "sub",
  heading: "section",
  subheading: "sub",
  blockquote: "quote",
  cite: "quote",

  // ── Task aliases ────────────────────────────────────────────────────────
  check: "task",
  todo: "task",
  action: "task",
  item: "task",
  completed: "done",
  finished: "done",

  // ── Policy aliases ───────────────────────────────────────────────────────
  rule: "policy",
  constraint: "policy",
  guard: "policy",
  requirement: "policy",

  // ── Agent / workflow aliases ─────────────────────────────────────────────
  log: "audit",
  lock: "freeze",
  on: "trigger",
  run: "step",
  if: "decision",

  // ── Already exists (backward compat) ────────────────────────────────────
  status: "emit",

  // ── v2.11 ref: aliases ──────────────────────────────────────────────────
  references: "ref",
  see: "ref",
  related: "ref",

  // ── v2.11 def: aliases ──────────────────────────────────────────────────
  define: "def",
  term: "def",
  glossary: "def",

  // ── v2.11 metric: aliases ───────────────────────────────────────────────
  kpi: "metric",
  measure: "metric",
  stat: "metric",

  // ── v2.11 amendment: aliases ────────────────────────────────────────────
  amend: "amendment",
  change: "amendment",

  // ── v2.11 figure: aliases ───────────────────────────────────────────────
  fig: "figure",
  diagram: "figure",
  chart: "figure",

  // ── v2.11 signline: aliases ─────────────────────────────────────────────
  "signature-line": "signline",
  "sign-here": "signline",
  sig: "signline",

  // ── v2.11 contact: aliases ──────────────────────────────────────────────
  person: "contact",
  party: "contact",

  // ── v2.11 deadline: aliases ─────────────────────────────────────────────
  due: "deadline",
  milestone: "deadline",
  "due-date": "deadline",

  // ── v2.11 cite: aliases ─────────────────────────────────────────────────
  citation: "quote",
  source: "quote",
  reference: "quote",

  // ── v2.12 divider: aliases ──────────────────────────────────────────────
  hr: "divider",
  separator: "divider",
};
