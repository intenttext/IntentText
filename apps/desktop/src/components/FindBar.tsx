// FindBar — find-in-document (Cmd+F). Scoped to the rendered document (.docs-
// container), highlights matches with the CSS Custom Highlight API (no DOM
// mutation — safe inside the editor), and scrolls match-to-match. Falls back to
// scroll-only if the Highlight API is unavailable.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";

/** Edit-mode replace plumbing. When present, the bar grows a Replace row whose
 *  Replace / Replace All operate on the DOCUMENT SOURCE (doc.content) — not the
 *  rendered DOM — via these callbacks, so structure is never corrupted. */
export interface ReplaceApi {
  /** Current document source. */
  getContent: () => string;
  /** Persist the new source through the app's content-update path. */
  setContent: (next: string) => void;
}

/** Count literal (case-insensitive) occurrences of `q` in `text`. */
function countMatches(text: string, q: string): number {
  if (!q) return 0;
  const hay = text.toLowerCase();
  const needle = q.toLowerCase();
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

/** Replace the first case-insensitive occurrence at/after `from`. Returns the
 *  new string and the index just past the replacement, or null if none. */
function replaceFirst(
  text: string,
  q: string,
  repl: string,
  from: number,
): { next: string; at: number } | null {
  if (!q) return null;
  const i = text.toLowerCase().indexOf(q.toLowerCase(), from);
  if (i === -1) return null;
  return {
    next: text.slice(0, i) + repl + text.slice(i + q.length),
    at: i + repl.length,
  };
}

const docRoot = () =>
  document.querySelector<HTMLElement>(".tiptap") ??
  document.querySelector<HTMLElement>(".docs-container");
const highlightRegistry = () =>
  (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
const HighlightCtor = () =>
  (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

function collectRanges(query: string): Range[] {
  const root = docRoot();
  if (!root || !query) return [];
  const q = query.toLowerCase();
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      // Skip text that isn't visually rendered — comments hidden in view mode,
      // or anything inside a display:none element (offsetParent is null then).
      const el = (n as Text).parentElement;
      if (!el || el.offsetParent === null) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode() as Text | null;
  while (node) {
    const lower = (node.nodeValue ?? "").toLowerCase();
    let from = 0;
    let idx = lower.indexOf(q, from);
    while (idx !== -1) {
      const r = document.createRange();
      r.setStart(node, idx);
      r.setEnd(node, idx + q.length);
      ranges.push(r);
      from = idx + q.length;
      idx = lower.indexOf(q, from);
    }
    node = walker.nextNode() as Text | null;
  }
  return ranges;
}

function setHighlights(ranges: Range[], current: number): void {
  const reg = highlightRegistry();
  const Ctor = HighlightCtor();
  if (!reg || !Ctor) return;
  if (ranges.length) reg.set("it-find", new Ctor(...ranges));
  else reg.delete("it-find");
  if (ranges[current]) reg.set("it-find-current", new Ctor(ranges[current]));
  else reg.delete("it-find-current");
}
function clearHighlights(): void {
  const reg = highlightRegistry();
  reg?.delete("it-find");
  reg?.delete("it-find-current");
}
function revealRange(r: Range): void {
  r.startContainer.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

export function FindBar({
  onClose,
  replace,
}: {
  onClose: () => void;
  /** When provided (edit mode), the bar offers source-level find & replace. */
  replace?: ReplaceApi;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [count, setCount] = useState(0);
  const [pos, setPos] = useState(0); // 0-based index of the current match
  const rangesRef = useRef<Range[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return clearHighlights;
  }, []);

  // Re-run the search whenever the query changes. For replace we count against
  // the source string so the count is right even for text the viewer collapses;
  // the DOM highlight is best-effort visual feedback.
  const recount = useCallback(
    (q: string) => {
      const ranges = collectRanges(q);
      rangesRef.current = ranges;
      const n = replace ? countMatches(replace.getContent(), q) : ranges.length;
      setCount(n);
      setPos(0);
      setHighlights(ranges, 0);
      if (ranges[0]) revealRange(ranges[0]);
    },
    [replace],
  );

  useEffect(() => {
    recount(query);
  }, [query, recount]);

  const go = useCallback((dir: 1 | -1) => {
    const ranges = rangesRef.current;
    if (!ranges.length) return;
    setPos((prev) => {
      const next = (prev + dir + ranges.length) % ranges.length;
      setHighlights(ranges, next);
      revealRange(ranges[next]);
      return next;
    });
  }, []);

  // Replace the next match in the SOURCE, then re-sync the highlight overlay.
  const doReplaceOne = useCallback(() => {
    if (!replace || !query) return;
    const res = replaceFirst(replace.getContent(), query, replacement, 0);
    if (!res) return;
    replace.setContent(res.next);
    // The editor re-renders from the new source; re-collect on the next frame.
    requestAnimationFrame(() => recount(query));
  }, [replace, query, replacement, recount]);

  const doReplaceAll = useCallback(() => {
    if (!replace || !query) return;
    let text = replace.getContent();
    let from = 0;
    let changed = false;
    for (;;) {
      const res = replaceFirst(text, query, replacement, from);
      if (!res) break;
      text = res.next;
      from = res.at;
      changed = true;
    }
    if (changed) {
      replace.setContent(text);
      requestAnimationFrame(() => recount(query));
    }
  }, [replace, query, replacement, recount]);

  return (
    <div className={`find-bar${showReplace ? " has-replace" : ""}`}>
      <div className="find-row">
        {replace && (
          <button
            className={`icon-btn${showReplace ? " active" : ""}`}
            title="Toggle Replace"
            onClick={() => setShowReplace((v) => !v)}
          >
            <Replace size={14} />
          </button>
        )}
        <input
          ref={inputRef}
          className="find-input"
          placeholder="Find in document…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <span className="find-count">
          {count ? `${pos + 1}/${count}` : query ? "0/0" : ""}
        </span>
        <button
          className="icon-btn"
          title="Previous (⇧⏎)"
          onClick={() => go(-1)}
          disabled={!count}
        >
          <ChevronUp size={14} />
        </button>
        <button
          className="icon-btn"
          title="Next (⏎)"
          onClick={() => go(1)}
          disabled={!count}
        >
          <ChevronDown size={14} />
        </button>
        <button className="icon-btn" title="Close (Esc)" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {replace && showReplace && (
        <div className="find-row replace-row">
          <input
            className="find-input"
            placeholder="Replace with…"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doReplaceOne();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
          />
          <button
            className="btn small"
            onClick={doReplaceOne}
            disabled={!count}
            title="Replace next match"
          >
            Replace
          </button>
          <button
            className="btn small"
            onClick={doReplaceAll}
            disabled={!count}
            title="Replace all matches"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
