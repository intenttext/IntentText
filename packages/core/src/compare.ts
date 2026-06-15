/**
 * compare.ts — version compare as REDLINE.
 *
 * `compareVersions(before, after)` diffs two `.it` sources and emits a single `.it`
 * document whose changes are expressed as tracked changes (redline.ts): text only
 * in `before` becomes a deletion, text only in `after` an insertion, shared text
 * stays plain. The result renders through the normal redline path — so the same
 * <Redline> review UI becomes a Word-style "Compare versions" view for free.
 *
 * `acceptChanges` on the result reconstructs the NEW version exactly. `rejectChanges`
 * reconstructs the OLD version's content, but where a WHOLE line was added/removed
 * the collapsed shell (`text:` with no value) remains — span-collapse can't delete a
 * line, only its inserted text. That's fine for review (accept gives the merged
 * doc); for an exact old copy, keep `before`.
 *
 * The diff is line-structured (the `.it` unit) with an inline WORD diff inside a
 * changed line, so a one-word edit shows as one word struck out + one inserted,
 * not a whole paragraph replaced. It targets `keyword: value` lines (the common
 * case); a changed line it can't safely inline-diff falls back to deleting the old
 * value and inserting the new, keeping the keyword. Pure string in/out — no parser
 * round-trip — so it never throws on exotic input.
 */

export interface CompareOptions {
  /** Stamp `by:` on every emitted change (the reviewer/author attribution). */
  by?: string;
}

/** Longest-common-subsequence backtrace over two arrays → an edit script. */
type Op<T> = { tag: "eq" | "del" | "ins"; value: T };

function lcsDiff<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): Op<T>[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      ops.push({ tag: "eq", value: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ tag: "del", value: a[i] });
      i++;
    } else {
      ops.push({ tag: "ins", value: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ tag: "del", value: a[i++] });
  while (j < m) ops.push({ tag: "ins", value: b[j++] });
  return ops;
}

/** Span attribute tail (`; by: …`) shared by every emitted change. */
function attrs(by?: string): string {
  return by ? `; by: ${by}` : "";
}

/** A bracket-span is unsafe to wrap text in if the text already holds `]` or `}`. */
function safeSpanText(s: string): boolean {
  return !s.includes("]") && !s.includes("}");
}

/** Word-level inline diff of two strings → mixed plain / ins / del run. */
function wordDiff(oldVal: string, newVal: string, by?: string): string {
  // Split on whitespace but KEEP it, so spacing round-trips.
  const split = (s: string) => s.split(/(\s+)/).filter((t) => t.length > 0);
  const ops = lcsDiff(split(oldVal), split(newVal), (x, y) => x === y);
  let out = "";
  for (const op of ops) {
    const t = op.value;
    if (/^\s+$/.test(t)) {
      // Whitespace: emit literally for eq; for ins keep it, for del drop it (so
      // accepting/rejecting yields clean spacing).
      if (op.tag !== "del") out += t;
      continue;
    }
    if (op.tag === "eq") out += t;
    else if (op.tag === "ins") out += `[${t}]{track: ins${attrs(by)}}`;
    else out += `[${t}]{track: del${attrs(by)}}`;
  }
  return out;
}

const KV = /^(\s*)([A-Za-z][\w-]*:)\s?(.*)$/;

/** Wrap a whole `kw: value` line's value as a single tracked change. */
function wrapLine(line: string, tag: "ins" | "del", by?: string): string {
  const m = KV.exec(line);
  if (m && m[3].trim() !== "" && safeSpanText(m[3])) {
    return `${m[1]}${m[2]} [${m[3]}]{track: ${tag}${attrs(by)}}`;
  }
  // Non keyword/value line (or unsafe to wrap): best-effort as a text block so the
  // change is still visible, when the content is span-safe; otherwise drop it from
  // the redline (it can't be represented inline) — the other version still shows.
  const text = line.trim();
  if (text !== "" && safeSpanText(text)) {
    return `text: [${text}]{track: ${tag}${attrs(by)}}`;
  }
  return "";
}

/** Render one changed `before`→`after` line pair as an inline word redline. */
function changedLine(before: string, after: string, by?: string): string | null {
  const mb = KV.exec(before);
  const ma = KV.exec(after);
  // Same keyword, simple single-value (no pipe props, span-safe) → inline word diff.
  if (
    mb &&
    ma &&
    mb[2] === ma[2] &&
    !mb[3].includes("|") &&
    !ma[3].includes("|") &&
    safeSpanText(mb[3]) &&
    safeSpanText(ma[3])
  ) {
    return `${ma[1]}${ma[2]} ${wordDiff(mb[3], ma[3], by)}`;
  }
  return null;
}

/**
 * Compare two `.it` versions and return a single `.it` source expressing the
 * difference as tracked changes (redline). Feed the result to renderHTML / the
 * <Redline> UI to review, or acceptChanges/rejectChanges to collapse to the new /
 * old version respectively.
 */
export function compareVersions(
  before: string,
  after: string,
  options?: CompareOptions,
): string {
  const by = options?.by;
  const beforeLines = (before ?? "").split(/\r?\n/);
  const afterLines = (after ?? "").split(/\r?\n/);
  const ops = lcsDiff(beforeLines, afterLines, (x, y) => x === y);

  const out: string[] = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].tag === "eq") {
      out.push(ops[k].value);
      k++;
      continue;
    }
    // Gather a CHANGE BLOCK (a maximal run of non-eq ops). Line-LCS groups it as
    // all deletions then all insertions, so pair them POSITIONALLY: the k-th
    // deleted line is the "before" of the k-th inserted line (a modification);
    // leftover deletions / insertions are pure removes / adds.
    const dels: string[] = [];
    const inss: string[] = [];
    while (k < ops.length && ops[k].tag !== "eq") {
      if (ops[k].tag === "del") dels.push(ops[k].value);
      else inss.push(ops[k].value);
      k++;
    }
    const pairs = Math.min(dels.length, inss.length);
    for (let p = 0; p < pairs; p++) {
      const merged = changedLine(dels[p], inss[p], by);
      if (merged !== null) {
        out.push(merged);
      } else {
        const d = wrapLine(dels[p], "del", by);
        if (d) out.push(d);
        const ins = wrapLine(inss[p], "ins", by);
        if (ins) out.push(ins);
      }
    }
    for (let p = pairs; p < dels.length; p++) {
      const d = wrapLine(dels[p], "del", by);
      if (d) out.push(d);
    }
    for (let p = pairs; p < inss.length; p++) {
      const ins = wrapLine(inss[p], "ins", by);
      if (ins) out.push(ins);
    }
  }

  return out.join("\n");
}
