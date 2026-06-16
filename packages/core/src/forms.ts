/**
 * forms.ts — IntentText Forms: the `.it` fillable-form lifecycle.
 *
 * A form is a `.it` document marked `meta: | type: form` whose `input:` lines (and
 * inline `[ ]{input: key}` spans) are FILLABLE FIELDS — empty boxes a recipient
 * completes in the editor/desktop, not author-side `{{merge}}` variables.
 *
 * The trust twist lives in template.ts and builds on this module: a BLANK or
 * incomplete form is template-like (not signable, like any fill-in blueprint), but
 * a COMPLETE form — every required field has a value — is a final, signable record.
 * So "send a form → fill it → sign it" yields a tamper-evident, queryable document.
 *
 * This module is intentionally regex/string-based (no parser import) so template.ts
 * can use it without a dependency cycle, and so completeness can be checked cheaply
 * from raw source anywhere (editor, desktop, CLI).
 */

import { hasAttachment } from "./attachments";

/** Field types. (attachment added in v2 — see attachments.ts for the container.) */
export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "date",
  "number",
  "choice",
  "checkbox",
  "signature",
  "table",
  "attachment",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface FormField {
  /** Stable identifier used for answers + queries (`key:`; defaults to a slug of the label). */
  key: string;
  /** Human label shown next to the box. */
  label: string;
  /** One of FORM_FIELD_TYPES (free-form string tolerated; defaults to "text"). */
  type: string;
  /** Must be answered for the form to be complete. */
  required: boolean;
  /** Allowed values for `type: choice`. */
  options: string[];
  /** The captured answer ("" = blank). For checkbox: a truthy string = checked. */
  value: string;
  /** True when the field carries a meaningful answer (checkbox: checked). */
  filled: boolean;
  /** Inline `[ ]{input: key}` field vs a block `input:` line. */
  inline: boolean;
}

const META_FORM = /^\s*meta:\s*(?:\|[^\n]*)?\btype:\s*form\b/im;
const TRUTHY = /^(yes|true|on|1|required|checked|x)$/i;

/** Is this source an IntentText FORM (explicit `meta: type: form`)? */
export function isForm(source: string): boolean {
  return !!source && META_FORM.test(source);
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Split a `key: value | key: value` tail (block field props). Lowercased keys. */
function parsePipeProps(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of rest.split("|")) {
    const c = seg.indexOf(":");
    if (c > 0) {
      const k = seg.slice(0, c).trim().toLowerCase();
      if (k) out[k] = seg.slice(c + 1).trim();
    }
  }
  return out;
}

/** Split a `key: value; key: value` span (inline field props). Lowercased keys. */
function parseSemiProps(rest: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of rest.split(";")) {
    const c = seg.indexOf(":");
    if (c > 0) {
      const k = seg.slice(0, c).trim().toLowerCase();
      if (k) out[k] = seg.slice(c + 1).trim();
    }
  }
  return out;
}

function mkField(
  partial: Omit<FormField, "filled">,
): FormField {
  const type = partial.type;
  const v = partial.value;
  const filled =
    type === "checkbox" ? TRUTHY.test(v.trim()) : v.trim().length > 0;
  return { ...partial, filled };
}

/**
 * Extract every fillable field from a `.it` source — block `input:` lines and
 * inline `[value]{input: key; …}` spans, in document order.
 */
export function extractFormFields(source: string): FormField[] {
  if (!source) return [];
  const fields: FormField[] = [];

  // Block fields: `input: <label> | key: … | type: … | required: … | options: … | value: …`
  for (const line of source.split(/\r?\n/)) {
    const m = /^\s*input:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const rest = m[1];
    const firstPipe = rest.indexOf("|");
    const label = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
    const props = firstPipe >= 0 ? parsePipeProps(rest.slice(firstPipe + 1)) : {};
    const type = (props.type || "text").toLowerCase();
    fields.push(
      mkField({
        key: props.key || slug(label) || `field_${fields.length + 1}`,
        label,
        type,
        required: TRUTHY.test((props.required || "").trim()),
        options: (props.options || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        value: props.value ?? "",
        inline: false,
      }),
    );
  }

  // Inline fields: `[<value>]{input: <key>; type: …; required: …; options: …}`
  // (the bracket content is the answer; an empty bracket = blank.)
  const re = /\[([^\]]*)\]\{([^}]*)\}/g;
  let im: RegExpExecArray | null;
  while ((im = re.exec(source)) !== null) {
    const props = parseSemiProps(im[2]);
    if (!("input" in props)) continue; // a normal styled span, not a field
    const value = im[1];
    const type = (props.type || "text").toLowerCase();
    fields.push(
      mkField({
        key: props.input || slug(props.label || value) || `field_${fields.length + 1}`,
        label: props.label || props.input || "",
        type,
        required: TRUTHY.test((props.required || "").trim()),
        options: (props.options || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        value,
        inline: true,
      }),
    );
  }

  return fields;
}

/** A required field is satisfied when answered (checkbox: checked). Optional fields always pass. */
function isFieldSatisfied(f: FormField): boolean {
  if (!f.required) return true;
  return f.filled;
}

/**
 * Is every required field answered? (A form with no required fields is complete.)
 * This is the gate template.ts uses to decide a form is a final, signable record.
 *
 * An `attachment` field that claims a value must also have its bytes present in a
 * linked `attach:` block — so you cannot mark a form complete by naming a file you
 * never attached (the sealed hash would then cover a phantom attachment).
 */
export function isFormComplete(source: string): boolean {
  if (!isForm(source)) return false;
  return extractFormFields(source).every((f) => {
    if (!isFieldSatisfied(f)) return false;
    if (f.type === "attachment" && f.filled && !hasAttachment(source, f.key)) {
      return false;
    }
    return true;
  });
}

/** Map of field key → captured answer — the structured, queryable result of a form. */
export function formAnswers(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of extractFormFields(source)) if (f.key) out[f.key] = f.value;
  return out;
}

/** Keys of required fields still missing an answer (for "X fields left" UI). */
export function missingRequiredFields(source: string): string[] {
  return extractFormFields(source)
    .filter((f) => f.required && !f.filled)
    .map((f) => f.key);
}

// Values live in a `| value: …` pipe segment (block) or a `[…]` bracket (inline),
// so a value can't contain a raw `|`, `[`, `]`, or newline — sanitize on write.
function sanitizeBlockValue(v: string): string {
  return v.replace(/[\r\n]+/g, " ").replace(/\|/g, "/").trim();
}
function sanitizeInlineValue(v: string): string {
  return v.replace(/[\r\n]+/g, " ").replace(/[[\]]/g, "").trim();
}

function keyForBlockLine(label: string, props: Record<string, string>): string {
  return props.key || slug(label) || "";
}

/**
 * Write a captured answer for the field `key` back into the source, in place —
 * block `input:` lines get/replace their `| value: …`, inline `[…]{input: key}`
 * spans get their bracket content replaced. Returns the updated source (unchanged
 * if the key isn't found). This is the one mutation the fill UI + programmatic
 * fillers use; rendering/trust then react to the new value.
 */
export function setFieldValue(source: string, key: string, value: string): string {
  if (!source || !key) return source;
  let changed = false;

  // Block fields: rewrite the matching `input:` line.
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*input:\s*)(.*)$/i.exec(lines[i]);
    if (!m) continue;
    const rest = m[2];
    const firstPipe = rest.indexOf("|");
    const label = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
    const props = firstPipe >= 0 ? parsePipeProps(rest.slice(firstPipe + 1)) : {};
    if (keyForBlockLine(label, props) !== key) continue;

    const v = sanitizeBlockValue(value);
    // Re-split the original tail into segments so we can replace/append value:
    // while preserving the other props verbatim (order + spacing of the rest).
    const head = firstPipe >= 0 ? rest.slice(0, firstPipe).trimEnd() : rest.trimEnd();
    const segs = firstPipe >= 0 ? rest.slice(firstPipe + 1).split("|") : [];
    let replaced = false;
    for (let s = 0; s < segs.length; s++) {
      const c = segs[s].indexOf(":");
      if (c > 0 && segs[s].slice(0, c).trim().toLowerCase() === "value") {
        segs[s] = ` value: ${v} `;
        replaced = true;
        break;
      }
    }
    if (!replaced && v) segs.push(` value: ${v} `);
    const tail = segs.length
      ? " | " + segs.map((x) => x.trim()).join(" | ")
      : "";
    lines[i] = `${m[1]}${head}${tail}`;
    changed = true;
    break;
  }
  if (changed) return lines.join("\n");

  // Inline fields: replace the bracket content of [..]{… input: key …}.
  const re = /\[([^\]]*)\]\{([^}]*)\}/g;
  const out = source.replace(re, (whole, _content, propStr) => {
    if (changed) return whole;
    const props = parseSemiProps(propStr);
    if (!("input" in props)) return whole;
    if ((props.input || "") !== key) return whole;
    changed = true;
    return `[${sanitizeInlineValue(value)}]{${propStr}}`;
  });
  return changed ? out : source;
}

/** Apply a batch of key→value answers to the source (the fill UI's "save"). */
export function applyAnswers(
  source: string,
  answers: Record<string, string>,
): string {
  let out = source;
  for (const [k, v] of Object.entries(answers)) out = setFieldValue(out, k, v);
  return out;
}
