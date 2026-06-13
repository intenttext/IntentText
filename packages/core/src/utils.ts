import { IntentBlock } from "./types";

export function flattenBlocks(blocks: IntentBlock[]): IntentBlock[] {
  const result: IntentBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}

/**
 * Idempotently set or remove a property on the document's `meta:` line, working
 * directly on raw `.it` source. Deduplicates any pre-existing copies of the key
 * first, so toggling never produces `meta: | dir: rtl | dir: rtl | …` (the
 * repeat-click corruption seen when the editor blindly appended a segment).
 *
 * - value === null|undefined  → remove the property (drop an empty meta: line).
 * - no meta: line + a value   → insert one after title:/summary:, else prepend.
 *
 * Property keys/values are not pipe-escaped here (meta keys are simple tokens);
 * callers pass plain values like "rtl"/"corporate".
 */
export function upsertMetaProperty(
  source: string,
  key: string,
  value: string | null | undefined,
): string {
  const stripKey = (line: string): string => {
    // Remove every "| key: …" segment for this key (case-insensitive key).
    const re = new RegExp(`\\s*\\|\\s*${key}\\s*:[^|]*`, "gi");
    return line.replace(re, "").trimEnd();
  };

  const lines = source.split("\n");
  const metaIdx = lines.findIndex((l) => /^\s*meta:/i.test(l));

  if (metaIdx !== -1) {
    let cleaned = stripKey(lines[metaIdx]);
    if (value != null && value !== "") {
      cleaned = `${cleaned} | ${key}: ${value}`;
    }
    // If the meta line is now just "meta:" with nothing, drop it.
    if (/^\s*meta:\s*$/i.test(cleaned)) {
      lines.splice(metaIdx, 1);
    } else {
      lines[metaIdx] = cleaned;
    }
    return lines.join("\n");
  }

  // No meta: line. Nothing to remove.
  if (value == null || value === "") return source;

  const newMeta = `meta: | ${key}: ${value}`;
  const anchorIdx = lines.findIndex((l) => /^\s*(title:|summary:)/i.test(l));
  if (anchorIdx !== -1) {
    lines.splice(anchorIdx + 1, 0, newMeta);
    return lines.join("\n");
  }
  return `${newMeta}\n${source}`;
}

/** Read a property from the document's meta: line (first match), or undefined. */
export function getMetaProperty(
  source: string,
  key: string,
): string | undefined {
  const metaLine = source.split("\n").find((l) => /^\s*meta:/i.test(l));
  if (!metaLine) return undefined;
  const m = new RegExp(`\\|\\s*${key}\\s*:\\s*([^|]*)`, "i").exec(metaLine);
  return m ? m[1].trim() : undefined;
}
