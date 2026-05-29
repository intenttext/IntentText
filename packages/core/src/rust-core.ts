// v3.4.0 — Rust/WASM removed. All functions delegate directly to the TS
// implementations. The exported names are kept for backward compatibility.
import type { IntentDocument, ParseOptions } from "./types";
import type { SafeParseOptions, SafeParseResult } from "./parser";
import type { RenderOptions } from "./renderer";
import type { SemanticValidationResult } from "./validate";

import {
  _resetIdCounter as resetTsParserIdCounter,
  parseIntentText as parseIntentTextTs,
  parseIntentTextSafe as parseIntentTextSafeTs,
} from "./parser";
import { renderHTML as renderHtmlTs } from "./renderer";
import { validateDocumentSemantic as validateSemanticTs } from "./validate";
import { documentToSource as documentToSourceTs } from "./source";

// Kept for backward compatibility — no WASM involved.
export type RustCoreInitOptions = {
  wasmUrl?: string;
  forceReload?: boolean;
};

// "hybrid" is the only meaningful mode now (always TS), but kept for compat.
export type RustCoreRuntimeMode = "hybrid" | "rust-only";

export type RustCoreFallbackTelemetry = {
  parser_option_fallback_to_ts: number;
  renderer_option_fallback_to_ts: number;
  renderer_theme_fallback_to_ts: number;
  wasm_load_failure_fallback_to_ts: number;
  wasm_call_failure_fallback_to_ts: number;
};

const ZERO_TELEMETRY: RustCoreFallbackTelemetry = {
  parser_option_fallback_to_ts: 0,
  renderer_option_fallback_to_ts: 0,
  renderer_theme_fallback_to_ts: 0,
  wasm_load_failure_fallback_to_ts: 0,
  wasm_call_failure_fallback_to_ts: 0,
};

export function getRustCoreFallbackTelemetry(): RustCoreFallbackTelemetry {
  return { ...ZERO_TELEMETRY };
}

// No-op: telemetry is always zero in TS-only mode.
export function resetRustCoreFallbackTelemetry(): void {}

export function getRustCoreRuntimeMode(): RustCoreRuntimeMode {
  return "hybrid";
}

// No-op: kept for backward compatibility.
export function setRustCoreRuntimeMode(_mode: RustCoreRuntimeMode): void {}

// No-op: no WASM to initialize. Returns true to signal "ready".
export async function initRustCore(
  _options?: RustCoreInitOptions,
): Promise<boolean> {
  return true;
}

export function isRustCoreInitialized(): boolean {
  return true;
}

export function parseIntentText(
  source: string,
  options?: ParseOptions,
): IntentDocument {
  return parseIntentTextTs(source, options);
}

export function _resetIdCounter(): void {
  resetTsParserIdCounter();
}

export function parseIntentTextSafe(
  source: string,
  options?: SafeParseOptions,
): SafeParseResult {
  return parseIntentTextSafeTs(source, options);
}

export function renderHTML(
  doc: IntentDocument,
  options?: RenderOptions,
): string {
  return renderHtmlTs(doc, options);
}

export function documentToSource(doc: IntentDocument): string {
  return documentToSourceTs(doc);
}

export function validateDocumentSemantic(
  doc: IntentDocument,
): SemanticValidationResult {
  return validateSemanticTs(doc);
}
