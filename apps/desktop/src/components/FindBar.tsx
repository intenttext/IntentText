// FindBar — find-in-document (Cmd+F). Scoped to the rendered document (.docs-
// container), highlights matches with the CSS Custom Highlight API (no DOM
// mutation — safe inside the editor), and scrolls match-to-match. Falls back to
// scroll-only if the Highlight API is unavailable.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

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

export function FindBar({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(0);
  const [pos, setPos] = useState(0); // 0-based index of the current match
  const rangesRef = useRef<Range[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    return clearHighlights;
  }, []);

  // Re-run the search whenever the query changes.
  useEffect(() => {
    const ranges = collectRanges(query);
    rangesRef.current = ranges;
    setCount(ranges.length);
    setPos(0);
    setHighlights(ranges, 0);
    if (ranges[0]) revealRange(ranges[0]);
  }, [query]);

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

  return (
    <div className="find-bar">
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
  );
}
