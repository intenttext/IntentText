// Re-export wrapper used by rust-core.ts to access the pure TypeScript parser
// implementation without going through the public dist/parser.js shim.
//
// At compile time tsc resolves types from here → ./parser (the real source).
// At build time, scripts/shim-parser-runtime.cjs overwrites the compiled
// dist/parser-ts.js with the original tsc output for dist/parser.js BEFORE the
// shim replaces it.  This guarantees that at runtime rust-core's fallback path
// calls the actual TS parser rather than the routing shim (which would cause
// an infinite recursion: rust-core → parser shim → rust-core → …).
export {
  _resetIdCounter,
  detectHistoryBoundary,
  parseIntentText,
  parseIntentTextSafe,
  DEFAULT_SAFE_PARSE_OPTIONS,
} from "./parser";
export type { SafeParseOptions, SafeParseResult } from "./parser";
