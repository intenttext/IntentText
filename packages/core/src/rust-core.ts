import type { IntentDocument, ParseOptions } from "./types";
import type { SafeParseOptions, SafeParseResult } from "./parser";
import type { RenderOptions } from "./renderer";
import type { SemanticIssue, SemanticValidationResult } from "./validate";

import {
  parseIntentText as parseIntentTextTs,
  parseIntentTextSafe as parseIntentTextSafeTs,
  _resetIdCounter as resetIdCounterTs,
} from "./parser";
import { renderHTML as renderHTMLTs } from "./renderer";
import { validateDocumentSemantic as validateDocumentSemanticTs } from "./validate";
import { documentToSource as documentToSourceTs } from "./source";
type RustWasmModule = {
  parse_wasm: (source: string) => unknown;
  render_wasm: (doc: unknown) => string;
  to_source_wasm: (doc: unknown) => string;
  validate_wasm: (doc: unknown) => unknown;
};

function loadRustWasm(): RustWasmModule | null {
  try {
    const req: NodeRequire =
      typeof require === "function"
        ? require
        : ((0, eval)("require") as NodeRequire);
    return req("./rust-wasm/intenttext.js") as RustWasmModule;
  } catch {
    return null;
  }
}

function useRustCore(): boolean {
  const globalFlag =
    typeof globalThis !== "undefined"
      ? (globalThis as Record<string, unknown>).__INTENTTEXT_CORE_ENGINE
      : undefined;
  if (globalFlag === "ts") {
    return false;
  }
  if (globalFlag === "rust") {
    return true;
  }
  if (typeof process !== "undefined" && process.env) {
    if (process.env.INTENTTEXT_CORE_ENGINE === "ts") {
      return false;
    }
    if (process.env.INTENTTEXT_CORE_ENGINE === "rust") {
      return true;
    }
  }
  return true;
}

// Rust-backed parser for v3. Options currently fall back to TS behavior.
export function parseIntentText(
  source: string,
  options?: ParseOptions,
): IntentDocument {
  if (!useRustCore()) {
    return parseIntentTextTs(source, options);
  }
  if (options && Object.keys(options).length > 0) {
    return parseIntentTextTs(source, options);
  }
  try {
    const wasm = loadRustWasm();
    if (!wasm) {
      return parseIntentTextTs(source, options);
    }
    return wasm.parse_wasm(source) as IntentDocument;
  } catch {
    return parseIntentTextTs(source, options);
  }
}

export function _resetIdCounter(): void {
  resetIdCounterTs();
}

export function parseIntentTextSafe(
  source: string,
  options?: SafeParseOptions,
): SafeParseResult {
  try {
    const document = parseIntentText(
      source,
      options as ParseOptions | undefined,
    );
    return { document, warnings: [], errors: [] };
  } catch {
    return parseIntentTextSafeTs(source, options);
  }
}

// Rust-backed renderer for default mode. Themed rendering remains in TS path.
export function renderHTML(
  doc: IntentDocument,
  options?: RenderOptions,
): string {
  if (!useRustCore()) {
    return renderHTMLTs(doc, options);
  }
  const metaTheme = doc?.metadata?.meta?.theme;
  if (metaTheme && (!options || Object.keys(options).length === 0)) {
    return renderHTMLTs(doc, options);
  }
  if (options && Object.keys(options).length > 0) {
    return renderHTMLTs(doc, options);
  }
  try {
    const wasm = loadRustWasm();
    if (!wasm) {
      return renderHTMLTs(doc, options);
    }
    return wasm.render_wasm(doc);
  } catch {
    return renderHTMLTs(doc, options);
  }
}

export function documentToSource(doc: IntentDocument): string {
  if (!useRustCore()) {
    return documentToSourceTs(doc);
  }
  try {
    const wasm = loadRustWasm();
    if (!wasm) {
      return documentToSourceTs(doc);
    }
    return wasm.to_source_wasm(doc);
  } catch {
    return documentToSourceTs(doc);
  }
}

export function validateDocumentSemantic(
  doc: IntentDocument,
): SemanticValidationResult {
  if (!useRustCore()) {
    return validateDocumentSemanticTs(doc);
  }
  try {
    const wasm = loadRustWasm();
    if (!wasm) {
      return validateDocumentSemanticTs(doc);
    }

    const diagnostics = wasm.validate_wasm(doc) as Array<{
      severity: "Error" | "Warning" | "Info" | "error" | "warning" | "info";
      code: string;
      message: string;
      line: number;
      column: number;
    }>;

    const issues: SemanticIssue[] = diagnostics.map((d) => {
      const s = String(d.severity).toLowerCase();
      const type: "error" | "warning" | "info" =
        s === "error" ? "error" : s === "warning" ? "warning" : "info";
      return {
        blockId: "",
        blockType: "document",
        type,
        code: String(d.code),
        message: String(d.message),
      };
    });

    return {
      valid: !issues.some((i) => i.type === "error"),
      issues,
    };
  } catch {
    return validateDocumentSemanticTs(doc);
  }
}
