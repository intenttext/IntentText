/**
 * IntentText Keyword Aliases
 *
 * Generated from LANGUAGE_REGISTRY in language-registry.ts.
 * Do not edit manually — add aliases to language-registry.ts instead.
 *
 * Rules:
 *   - Aliases resolve to canonical types for validation, rendering, query, and
 *     history — but documentToSource re-emits the keyword AS WRITTEN
 *     (block.keywordAlias), so round-trips are byte-stable and localized
 *     (e.g. Arabic) documents stay in their language.
 *   - An alias cannot point to another alias — only to canonical keywords.
 *   - Aliases are case-insensitive (handled by parser before lookup).
 */
import { ALIAS_MAP, EXTENSION_LEGACY_ALIASES } from "./language-registry";

export const ALIASES: Record<string, string> = {
  ...ALIAS_MAP,
  ...EXTENSION_LEGACY_ALIASES,
};
