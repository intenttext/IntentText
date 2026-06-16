/**
 * form-trust.ts — TWO-PARTY form trust (Forms V2).
 *
 * A sent form has two distinct trust questions, by two different parties:
 *   1. AUTHENTICITY (the author): "is this the real form I was sent, with its fields
 *      and wording unaltered?" — independent of what anyone typed in.
 *   2. COMPLETION (the filler): "are these answers really mine, untampered?"
 *
 * This module answers (1) with a STRUCTURE seal: the author seals the blank form's
 * structure — a hash over the fields/labels/types/required/options but NOT the
 * answer values — and embeds it as a `form-seal:` line. Because the hash ignores
 * answers, it stays valid after the recipient fills the form: a verifier recomputes
 * it on the completed form and confirms the structure was never changed (no field
 * added, no clause reworded, no `required` flipped).
 *
 * Answer (2) is the EXISTING record seal/signature (sealDocument / signDocument in
 * trust.ts) over the completed form — which covers structure + answers + the
 * `form-seal:` line, tying the two layers together. So a fully-trusted returned form
 * carries BOTH: a valid `form-seal:` (author vouches for the structure) and a valid
 * `sign:`/`freeze:` (filler vouches for the answers).
 *
 * Hash-based (integrity + a named authorship claim), mirroring sealDocument. To bind
 * the structure seal to a key, sign the returned structureHash with @dotit/sign.
 */

import { computeDocumentHash } from "./trust";

const FORM_SEAL_RE = /^\s*form-seal:/i;

export interface FormSeal {
  /** Who sealed the structure (the form author/issuer). */
  sealer: string;
  /** The structure hash the author committed to. */
  structureHash: string;
  /** ISO timestamp. */
  at: string;
}

/**
 * Reduce a form to its STRUCTURE — the fields and wording, with every answer
 * stripped: block `input:` values dropped, inline `[answer]{input:…}` emptied,
 * `attach:` blocks (filler-provided files) removed, and trust lines (`form-seal:`)
 * removed so the result is stable across (re)sealing. computeDocumentHash strips the
 * record trust lines (sign/freeze/certify) and NFC-normalizes on top.
 */
export function canonicalFormStructure(source: string): string {
  const lines = (source ?? "")
    .split(/\r?\n/)
    .filter((l) => {
      const t = l.trimStart();
      return !FORM_SEAL_RE.test(t) && !/^attach:/i.test(t);
    })
    .map((l) =>
      /^\s*input:/i.test(l)
        ? // drop a `| value: …` segment (the captured block answer)
          l.replace(/\s*\|\s*value:\s*[^|]*/i, "")
        : l,
    );
  // empty every inline field answer: [answer]{… input …} → []{… input …}
  return lines
    .join("\n")
    .replace(/\[[^\]]*\]\{([^}]*)\}/g, (whole, props) =>
      /\binput\b/i.test(props) ? `[]{${props}}` : whole,
    );
}

/** The structure hash — identical for a blank form and any filled copy of it. */
export function formStructureHash(source: string): string {
  return computeDocumentHash(canonicalFormStructure(source));
}

/** The `form-seal:` line, parsed, or null if the form's structure isn't sealed. */
export function extractFormSeal(source: string): FormSeal | null {
  for (const raw of (source ?? "").split(/\r?\n/)) {
    const t = raw.trimStart();
    if (!FORM_SEAL_RE.test(t)) continue;
    const rest = t.replace(/^form-seal:\s*/i, "");
    const firstPipe = rest.indexOf("|");
    const sealer = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
    const props: Record<string, string> = {};
    if (firstPipe >= 0) {
      for (const seg of rest.slice(firstPipe + 1).split("|")) {
        const c = seg.indexOf(":");
        if (c > 0) props[seg.slice(0, c).trim().toLowerCase()] = seg.slice(c + 1).trim();
      }
    }
    return { sealer, structureHash: props.structure ?? "", at: props.at ?? "" };
  }
  return null;
}

/**
 * Seal a blank form's STRUCTURE (the author, before sending). Adds (or replaces) a
 * `form-seal:` line carrying the structure hash. Unlike record sealing, this is
 * valid on a blank/incomplete form — it vouches for the structure, not the answers.
 */
export function sealFormStructure(
  source: string,
  opts: { sealer: string },
): { source: string; structureHash: string } {
  const structureHash = formStructureHash(source);
  const at = new Date().toISOString();
  const line = `form-seal: ${opts.sealer} | structure: ${structureHash} | at: ${at}`;
  // Replace an existing form-seal: line, else append one.
  const lines = (source ?? "").split(/\r?\n/);
  const idx = lines.findIndex((l) => FORM_SEAL_RE.test(l.trimStart()));
  if (idx >= 0) {
    lines[idx] = line;
    return { source: lines.join("\n"), structureHash };
  }
  const base = (source ?? "").replace(/\n*$/, "");
  return { source: `${base}\n${line}\n`, structureHash };
}

export interface FormStructureVerification {
  /** Does the form carry a `form-seal:` line? */
  sealed: boolean;
  /** Does the current structure hash match the sealed one? */
  intact: boolean;
  sealer?: string;
  /** The structure hash computed now. */
  structureHash?: string;
  /** The structure hash the author committed to. */
  expected?: string;
}

/**
 * Verify a form's structure against its `form-seal:` — does the form (blank or
 * completed) still have the exact fields/wording the author sealed? `intact:false`
 * means the structure was tampered (a field added/removed, a label/required/options
 * changed). Answers and attachments never affect this result.
 */
export function verifyFormStructure(source: string): FormStructureVerification {
  const seal = extractFormSeal(source);
  if (!seal) return { sealed: false, intact: false };
  const structureHash = formStructureHash(source);
  return {
    sealed: true,
    intact: structureHash === seal.structureHash,
    sealer: seal.sealer,
    structureHash,
    expected: seal.structureHash,
  };
}
