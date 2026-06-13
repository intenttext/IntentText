// trust.ts — trust lifecycle operations on .it source text.
//
// Seal/verify are cryptographic and live in @dotit/core. Track / approve /
// sign insert the corresponding trust blocks at the conventional position
// (after front-matter, before history/freeze).

import { sealDocument, verifyDocument } from "@dotit/core";
import type { SealResult, VerifyResult } from "@dotit/core";

const FRONT_MATTER = new Set([
  "font",
  "page",
  "header",
  "footer",
  "watermark",
  "meta",
  "title",
  "summary",
  "byline",
  "toc",
]);

function keywordOf(line: string): string | null {
  const m = line.match(/^(\w[\w-]*)\s*:/);
  return m ? m[1] : null;
}

function insertAfterFrontMatter(source: string, line: string): string {
  const lines = source.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const kw = keywordOf(lines[i]);
    if (kw && FRONT_MATTER.has(kw)) insertAt = i + 1;
  }
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

function insertBeforeHistory(source: string, line: string): string {
  const lines = source.split("\n");
  let insertAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const kw = keywordOf(lines[i]);
    if (kw === "history" || kw === "freeze") {
      insertAt = i;
      break;
    }
  }
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function startTracking(source: string, docId?: string): string {
  const id = docId?.trim() || `doc-${Date.now()}`;
  return insertAfterFrontMatter(source, `track: ${id} | at: ${today()}`);
}

export function addSignature(source: string, by: string, role?: string): string {
  let line = `sign: ${by}`;
  if (role?.trim()) line += ` | role: ${role.trim()}`;
  line += ` | at: ${today()}`;
  return insertBeforeHistory(source, line);
}

export function addApproval(
  source: string,
  by: string,
  role?: string,
  note?: string,
): string {
  let line = `approve: ${by}`;
  if (role?.trim()) line += ` | role: ${role.trim()}`;
  line += ` | at: ${today()}`;
  if (note?.trim()) line += ` | note: ${note.trim()}`;
  return insertBeforeHistory(source, line);
}

export function seal(
  source: string,
  signer: string,
  role?: string,
): SealResult {
  return sealDocument(source, { signer, role: role?.trim() || undefined });
}

export function verify(source: string): VerifyResult {
  return verifyDocument(source);
}
