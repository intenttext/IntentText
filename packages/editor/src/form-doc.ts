// A small line-oriented model of a FORM's `.it` source for the visual designer.
// Forms are line-per-block, so each structural block (title / section / sub /
// description / field) maps to one source line we can show, edit, reorder, and
// delete directly — without touching the trust lines, layout, or comments that
// live in the same file (those are preserved untouched).

export type RowKind = "title" | "section" | "sub" | "text" | "field" | "info";

export interface DesignRow {
  /** Source line index (0-based). */
  line: number;
  kind: RowKind;
  /** Editable text — the content before the first `|`. */
  label: string;
  /** Pipe properties (fields/info). */
  props: Record<string, string>;
  /** Input type for field rows. */
  fieldType?: string;
}

// Keywords the designer SHOWS + lets you edit. Everything else (meta/page/font/
// style/header/footer/sign/freeze/comments/history…) is preserved but hidden.
const SHOWN = new Set(["title", "section", "sub", "text", "input", "info"]);
const HISTORY = /^\s*(history:|history$|---\s*$)/i;

function leadKw(line: string): string {
  const m = line.match(/^\s*([A-Za-z][\w-]*)\s*:/);
  return m ? m[1].toLowerCase() : "";
}

function parseProps(seg: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const part of seg.split("|")) {
    const m = part.match(/^\s*([A-Za-z][\w-]*)\s*:\s*([\s\S]*?)\s*$/);
    if (m) props[m[1].toLowerCase()] = m[2];
  }
  return props;
}

/** Parse the SHOWN structural rows of a form, in document order. */
export function parseDesignRows(source: string): DesignRow[] {
  const rows: DesignRow[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trimStart();
    if (HISTORY.test(line)) break; // never touch the audit log
    if (t === "" || t.startsWith("//")) continue;
    const kw = leadKw(line);
    // Bare prose (no keyword) is a description paragraph.
    if (!kw) {
      rows.push({ line: i, kind: "text", label: t, props: {} });
      continue;
    }
    if (!SHOWN.has(kw)) continue; // hidden block (meta/page/sign/…)
    const rest = line.slice(line.indexOf(":") + 1);
    const firstPipe = rest.indexOf("|");
    const label = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
    const props = firstPipe >= 0 ? parseProps(rest.slice(firstPipe + 1)) : {};
    const kind: RowKind =
      kw === "input" ? "field" : (kw as RowKind);
    rows.push({
      line: i,
      kind,
      label,
      props,
      fieldType: kind === "field" ? (props.type || "text").toLowerCase() : undefined,
    });
  }
  return rows;
}

// ── Line edits (all return a new source string) ──────────────────────────────

/** Replace the editable label/content of a line (text between keyword and first |). */
export function setRowLabel(source: string, line: number, label: string): string {
  const lines = source.split("\n");
  if (lines[line] == null) return source;
  const l = lines[line];
  if (!leadKw(l)) {
    lines[line] = label; // bare prose — the whole line is the text
  } else {
    lines[line] = l.replace(
      /^(\s*[A-Za-z][\w-]*:\s*)([^|]*)/,
      (_m, head) => `${head}${label}${/\|/.test(l) ? " " : ""}`,
    ).replace(/\s+\|/, " |");
  }
  return lines.join("\n");
}

/** Set (or, with "", remove) a `| prop: value` segment on a line. */
export function setRowProp(
  source: string,
  line: number,
  prop: string,
  value: string,
): string {
  const lines = source.split("\n");
  if (lines[line] == null) return source;
  const re = new RegExp(`\\s*\\|\\s*${prop}:\\s*[^|]*`, "i");
  let l = lines[line];
  if (!value) l = l.replace(re, "").replace(/\s+$/, "");
  else if (re.test(l)) l = l.replace(re, ` | ${prop}: ${value}`);
  else l = `${l.replace(/\s+$/, "")} | ${prop}: ${value}`;
  lines[line] = l;
  return lines.join("\n");
}

/** Remove a line. */
export function removeRowLine(source: string, line: number): string {
  const lines = source.split("\n");
  if (lines[line] == null) return source;
  lines.splice(line, 1);
  return lines.join("\n");
}

/** Move the line at `from` to just before the line at `to` (drag-reorder). */
export function moveRowLine(source: string, from: number, to: number): string {
  const lines = source.split("\n");
  if (lines[from] == null || from === to) return source;
  const [moved] = lines.splice(from, 1);
  // After removing `from`, indices above it shift down by one.
  const dest = to > from ? to - 1 : to;
  lines.splice(Math.max(0, Math.min(lines.length, dest)), 0, moved);
  return lines.join("\n");
}

/** Insert a new block line just after `afterLine` (or at end when afterLine < 0). */
export function insertRowAfter(
  source: string,
  afterLine: number,
  newLine: string,
): string {
  const lines = source.replace(/\n+$/, "").split("\n");
  // Default insert point: before the history boundary, else end.
  let at = afterLine >= 0 ? afterLine + 1 : lines.length;
  if (afterLine < 0) {
    const h = lines.findIndex((l) => HISTORY.test(l));
    if (h !== -1) at = h;
  }
  lines.splice(at, 0, newLine);
  return lines.join("\n") + "\n";
}
