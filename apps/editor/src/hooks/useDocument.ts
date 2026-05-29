import { useMemo } from "react";
import { parseIntentText, CANONICAL_KEYWORDS } from "@intenttext/core";
import type { IntentDocument } from "@intenttext/core";

interface DocState {
  doc: IntentDocument | null;
  blocks: number;
  lines: number;
  keywords: number;
  words: number;
  errors: string[];
  errorCount: number;
  firstErrorLine: number | null;
}

const KNOWN_KEYWORDS = new Set(CANONICAL_KEYWORDS);

export function useDocument(content: string): DocState {
  return useMemo(() => {
    const lines = content.split("\n").length;
    const words = content.split(/\s+/).filter((w) => w.length > 0).length;

    let doc: IntentDocument | null = null;
    const errors: string[] = [];

    try {
      doc = parseIntentText(content);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    const blocks = doc?.blocks.length ?? 0;

    // Count unique keyword types used
    let keywords = 0;
    if (doc) {
      const usedTypes = new Set(doc.blocks.map((b) => b.type));
      keywords = [...usedTypes].filter((t) => KNOWN_KEYWORDS.has(t)).length;
    }

    // Find first error line
    let firstErrorLine: number | null = null;
    if (doc?.diagnostics && doc.diagnostics.length > 0) {
      for (const d of doc.diagnostics) {
        errors.push(d.message);
        if (firstErrorLine === null && d.line) {
          firstErrorLine = d.line;
        }
      }
    }

    return {
      doc,
      blocks,
      lines,
      keywords,
      words,
      errors,
      errorCount: errors.length,
      firstErrorLine,
    };
  }, [content]);
}
