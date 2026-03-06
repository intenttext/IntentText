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
};
