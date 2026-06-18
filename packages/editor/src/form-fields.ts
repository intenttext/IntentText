// Form-builder field catalog + insertion helper. Powers the Design-mode field
// palette: click a type → a configured `input:` line is added to the form source.
// Field types are the canonical core set (FORM_FIELD_TYPES); `choice` carries
// starter options the author renames.

import { extractFormFields } from "@dotit/core";

export interface FieldDef {
  /** Canonical core field type (see FORM_FIELD_TYPES). */
  type: string;
  /** Palette label + icon. */
  title: string;
  icon: string;
  /** Default field label written into the input: line. */
  label: string;
  /** Default options for choice fields. */
  options?: string;
  /** Short hint shown in the palette. */
  hint: string;
}

// The palette, in a sensible authoring order. `email`/`phone` are text fields with
// a typed hint so FormFill can pick the right input mode without a new core type.
export const FIELD_PALETTE: FieldDef[] = [
  { type: "text", title: "Text", icon: "T", label: "Text field", hint: "Single line" },
  { type: "textarea", title: "Paragraph", icon: "¶", label: "Details", hint: "Multi-line" },
  { type: "number", title: "Number", icon: "#", label: "Amount", hint: "Numeric" },
  { type: "date", title: "Date", icon: "📅", label: "Date", hint: "Date picker" },
  {
    type: "choice",
    title: "Choice",
    icon: "▾",
    label: "Choose one",
    options: "Option A, Option B, Option C",
    hint: "Dropdown",
  },
  { type: "checkbox", title: "Checkbox", icon: "☑", label: "I agree", hint: "Yes / no" },
  { type: "signature", title: "Signature", icon: "✍", label: "Signature", hint: "Sign here" },
  { type: "attachment", title: "Attachment", icon: "📎", label: "Attach file", hint: "Upload" },
];

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "") || "field";

/** Build a single `input:` line for a field def, with a key unique within `source`. */
export function buildFieldLine(def: FieldDef, source: string): string {
  const existing = new Set(
    extractFormFields(source).map((f) => f.key),
  );
  let key = slug(def.label);
  let n = 1;
  while (existing.has(key)) key = `${slug(def.label)}_${++n}`;
  let line = `input: ${def.label} | key: ${key} | type: ${def.type}`;
  if (def.options) line += ` | options: ${def.options}`;
  return line;
}

/**
 * Add a field line to a form's source. Inserts right after the LAST existing
 * `input:` line (so fields stay grouped); if there are none, before the history
 * boundary / trailing helper text, else at the end. Returns the new source.
 */
export function addFieldToSource(source: string, line: string): string {
  const lines = source.replace(/\n+$/, "").split("\n");
  let lastInput = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*input:/i.test(lines[i])) lastInput = i;
  }
  if (lastInput >= 0) {
    lines.splice(lastInput + 1, 0, line);
  } else {
    lines.push("", line);
  }
  return lines.join("\n") + "\n";
}

// ─── Per-field editing (operates on block `input:` lines, by field index) ──────
// Fields are matched by their ORDER in the document (extractFormFields returns them
// in order), so editing works whether or not a field declares an explicit key.

/** Line indices of every block `input:` field, in document order. */
function inputLineIndices(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++)
    if (/^\s*input:/i.test(lines[i])) out.push(i);
  return out;
}

/** Set (or, with an empty value, remove) a `| prop: value` segment on a line. */
function setSegment(line: string, prop: string, value: string): string {
  const re = new RegExp(`\\s*\\|\\s*${prop}:\\s*[^|]*`, "i");
  if (!value) return line.replace(re, "").replace(/\s+$/, "");
  if (re.test(line)) return line.replace(re, ` | ${prop}: ${value}`);
  return `${line.replace(/\s+$/, "")} | ${prop}: ${value}`;
}

/** Replace the LABEL (the text between `input:` and the first `|`). */
function setLabelSegment(line: string, label: string): string {
  return line.replace(/^(\s*input:\s*)([^|]*)/i, `$1${label} `).replace(/\s+\|/, " |");
}

/** Apply an edit to the Nth field. `patch` may set label/type/required/options. */
export function editField(
  source: string,
  index: number,
  patch: {
    label?: string;
    type?: string;
    required?: boolean;
    options?: string;
    /** Layout width, e.g. "50%" (presentation); "" removes it (full width). */
    width?: string;
  },
): string {
  const lines = source.split("\n");
  const idxs = inputLineIndices(lines);
  const li = idxs[index];
  if (li == null) return source;
  let line = lines[li];
  if (patch.label != null) line = setLabelSegment(line, patch.label);
  if (patch.type != null) line = setSegment(line, "type", patch.type);
  if (patch.required != null)
    line = setSegment(line, "required", patch.required ? "true" : "");
  if (patch.options != null) line = setSegment(line, "options", patch.options);
  if (patch.width != null) line = setSegment(line, "width", patch.width);
  lines[li] = line;
  return lines.join("\n");
}

/** Remove the Nth field. */
export function removeField(source: string, index: number): string {
  const lines = source.split("\n");
  const idxs = inputLineIndices(lines);
  const li = idxs[index];
  if (li == null) return source;
  lines.splice(li, 1);
  return lines.join("\n");
}

/** Move the Nth field up (-1) or down (+1) among the fields. */
export function moveField(source: string, index: number, dir: -1 | 1): string {
  const lines = source.split("\n");
  const idxs = inputLineIndices(lines);
  const a = idxs[index];
  const b = idxs[index + dir];
  if (a == null || b == null) return source;
  const tmp = lines[a];
  lines[a] = lines[b];
  lines[b] = tmp;
  return lines.join("\n");
}
