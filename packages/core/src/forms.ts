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

/** Field types supported in v1. (attachment → v2) */
export const FORM_FIELD_TYPES = [
  "text",
  "textarea",
  "date",
  "number",
  "choice",
  "checkbox",
  "signature",
  "table",
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
 */
export function isFormComplete(source: string): boolean {
  if (!isForm(source)) return false;
  return extractFormFields(source).every(isFieldSatisfied);
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
