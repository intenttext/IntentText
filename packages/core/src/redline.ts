/**
 * redline.ts — tracked changes (redline) + comments for IntentText.
 *
 * The Word "track changes" workflow, on top of the existing inline bracket-span:
 *   • an INSERTION  is `[new text]{track: ins; by: …; at: …; id: …}`
 *   • a  DELETION   is `[old text]{track: del; by: …; at: …; id: …}`
 *   • a  COMMENT    anchors on `[text]{comment: <id>}` with a `comment:` block
 *     carrying the thread (`comment: <body> | id: <id> | by: … | at: …`).
 *
 * Accepting collapses the marks to clean text (insertions stay, deletions go);
 * rejecting does the opposite. A document with pending changes is "in review",
 * not final — like a blank form, it should not be sealed until resolved.
 *
 * Regex/string-based (no parser dependency) so trust + tooling can use it cheaply.
 */

export type ChangeType = "ins" | "del";

export interface TrackedChange {
  type: ChangeType;
  /** The bracketed text (the inserted text, or the text marked for deletion). */
  text: string;
  by?: string;
  at?: string;
  id?: string;
}

export interface Comment {
  id: string;
  body: string;
  by?: string;
  at?: string;
  resolved: boolean;
}

const SPAN_RE = /\[([^\]]*)\]\{([^}]*)\}/g;

function parseSpanProps(propStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const seg of propStr.split(";")) {
    const c = seg.indexOf(":");
    if (c > 0) {
      const k = seg.slice(0, c).trim().toLowerCase();
      if (k) out[k] = seg.slice(c + 1).trim();
    }
  }
  return out;
}

function changeType(props: Record<string, string>): ChangeType | null {
  const t = (props.track || "").toLowerCase();
  return t === "ins" || t === "del" ? t : null;
}

/** True if the source has any pending tracked changes (insertions or deletions). */
export function hasTrackedChanges(source: string): boolean {
  if (!source) return false;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(source)) !== null) {
    if (changeType(parseSpanProps(m[2]))) return true;
  }
  return false;
}

/** Every pending tracked change, in document order. */
export function extractChanges(source: string): TrackedChange[] {
  const out: TrackedChange[] = [];
  if (!source) return out;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(source)) !== null) {
    const props = parseSpanProps(m[2]);
    const type = changeType(props);
    if (!type) continue;
    out.push({ type, text: m[1], by: props.by, at: props.at, id: props.id });
  }
  return out;
}

function applyChanges(
  source: string,
  accept: boolean,
  ids?: string[],
): string {
  const targeted = ids ? new Set(ids) : null;
  return source.replace(SPAN_RE, (whole, text: string, propStr: string) => {
    const props = parseSpanProps(propStr);
    const type = changeType(props);
    if (!type) return whole; // not a tracked change
    if (targeted && !(props.id && targeted.has(props.id))) return whole; // not selected
    // accept: keep insertions, drop deletions. reject: the opposite.
    const keep = accept ? type === "ins" : type === "del";
    return keep ? text : "";
  });
}

/**
 * Accept tracked changes — insertions become plain text, deletions are removed.
 * Pass `ids` to accept only specific (id-bearing) changes; omit to accept all.
 */
export function acceptChanges(source: string, ids?: string[]): string {
  return applyChanges(source, true, ids);
}

/**
 * Reject tracked changes — insertions are removed, deletions restored as text.
 * Pass `ids` to reject only specific changes; omit to reject all.
 */
export function rejectChanges(source: string, ids?: string[]): string {
  return applyChanges(source, false, ids);
}

// ── Comments ─────────────────────────────────────────────────────────────────

const COMMENT_LINE = /^\s*comment:\s*(.*)$/i;

/** Extract comment threads (the `comment:` blocks). */
export function extractComments(source: string): Comment[] {
  const out: Comment[] = [];
  if (!source) return out;
  for (const line of source.split(/\r?\n/)) {
    const m = COMMENT_LINE.exec(line);
    if (!m) continue;
    const rest = m[1];
    const firstPipe = rest.indexOf("|");
    const body = (firstPipe >= 0 ? rest.slice(0, firstPipe) : rest).trim();
    const props: Record<string, string> = {};
    if (firstPipe >= 0) {
      for (const seg of rest.slice(firstPipe + 1).split("|")) {
        const c = seg.indexOf(":");
        if (c > 0) props[seg.slice(0, c).trim().toLowerCase()] = seg.slice(c + 1).trim();
      }
    }
    out.push({
      id: props.id || "",
      body,
      by: props.by,
      at: props.at,
      resolved: /^(yes|true|1)$/i.test((props.resolved || "").trim()),
    });
  }
  return out;
}

/** Ids of comments anchored in the body via `[text]{comment: id}`. */
export function commentAnchors(source: string): string[] {
  const ids: string[] = [];
  if (!source) return ids;
  SPAN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPAN_RE.exec(source)) !== null) {
    const props = parseSpanProps(m[2]);
    if (props.comment) ids.push(props.comment);
  }
  return ids;
}
