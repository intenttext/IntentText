// Parser bridge: .it source → VisualBlock[]
// Uses @intenttext/core's parser, then maps to visual block model

import { parseIntentText } from "@intenttext/core";
import type { VisualBlock } from "./types";

/**
 * Parse .it source into an array of VisualBlocks for the visual editor.
 * Each block maps 1:1 to a parsed IntentBlock from core.
 */
export function parseToVisualBlocks(source: string): VisualBlock[] {
  if (!source.trim()) return [];

  const doc = parseIntentText(source);
  const lines = source.split("\n");

  return doc.blocks.map((block) => {
    // Find the original source line for this block (for round-trip fidelity)
    let originalLine: string | undefined;
    if (block.id) {
      // Try to find the line that starts with this keyword
      const idx = lines.findIndex((l) => {
        const trimmed = l.trim();
        return (
          trimmed.startsWith(`${block.type}:`) || trimmed.startsWith("```")
        );
      });
      if (idx >= 0) originalLine = lines[idx];
    }

    // Convert properties values to strings (core may have numbers)
    const props: Record<string, string> = {};
    if (block.properties) {
      for (const [k, v] of Object.entries(block.properties)) {
        props[k] = String(v);
      }
    }

    return {
      id: block.id || `vb-${Math.random().toString(36).slice(2, 8)}`,
      type: block.type,
      content: block.content || "",
      properties: props,
      originalLine,
    };
  });
}

/**
 * Extract metadata from parsed source (title, frozen state etc.)
 */
export function extractDocumentMeta(source: string) {
  if (!source.trim()) return { isFrozen: false, title: "" };

  try {
    const doc = parseIntentText(source);
    const isFrozen = doc.blocks.some((b) => b.type === "freeze");
    const titleBlock = doc.blocks.find((b) => b.type === "title");
    return {
      isFrozen,
      title: titleBlock?.content || "",
    };
  } catch {
    return { isFrozen: false, title: "" };
  }
}
