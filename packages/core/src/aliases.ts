/**
 * IntentText Keyword Aliases
 *
 * Generated from LANGUAGE_REGISTRY in language-registry.ts.
 * Do not edit manually — add aliases to language-registry.ts instead.
 *
 * Rules:
 *   - Aliases are input-only. documentToSource always writes canonical keywords.
 *   - Aliases resolve before validation, rendering, and history tracking.
 *   - An alias cannot point to another alias — only to canonical keywords.
 *   - Aliases are case-insensitive (handled by parser before lookup).
 */
import { ALIAS_MAP, EXTENSION_LEGACY_ALIASES } from "./language-registry";

export const ALIASES: Record<string, string> = {
  ...ALIAS_MAP,
  ...EXTENSION_LEGACY_ALIASES,
};
