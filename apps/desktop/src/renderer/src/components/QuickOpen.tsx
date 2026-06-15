// QuickOpen — Cmd+K fuzzy file switcher across every registered vault. Recents
// first when the query is empty; subsequence fuzzy match otherwise.
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";

interface FileLike {
  path: string;
  name: string;
  isDir?: boolean;
}

/** Subsequence fuzzy score; -1 if `query` isn't a subsequence of `text`. */
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += last === i - 1 ? 3 : 1; // reward consecutive matches
      if (i === 0 || /[\s/_-]/.test(t[i - 1])) score += 2; // word-start bonus
      last = i;
      qi++;
    }
  }
  return qi === q.length ? score - t.length * 0.02 : -1;
}

export function QuickOpen(props: {
  files: FileLike[];
  recent: string[];
  vaultLabelFor: (p: string) => string;
  onOpen: (path: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const all = useMemo(
    () =>
      props.files
        .filter((f) => !f.isDir && f.name.toLowerCase().endsWith(".it"))
        .map((f) => ({ path: f.path, name: f.name.replace(/\.it$/i, "") })),
    [props.files],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const recentSet = new Set(props.recent);
      const recents = props.recent
        .map((p) => all.find((f) => f.path === p))
        .filter((x): x is { path: string; name: string } => !!x);
      const rest = all.filter((f) => !recentSet.has(f.path));
      return [...recents, ...rest].slice(0, 60);
    }
    return all
      .map((f) => ({
        f,
        s: Math.max(fuzzyScore(q, f.name), fuzzyScore(q, f.path) - 4),
      }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.f);
  }, [query, all, props.recent]);

  useEffect(() => setSel(0), [query]);
  useEffect(() => {
    listRef.current
      ?.querySelector(".qo-row.active")
      ?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const choose = (i: number) => {
    const f = results[i];
    if (f) props.onOpen(f.path);
  };

  return (
    <div className="qo-overlay" onMouseDown={props.onClose}>
      <div className="qo-panel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="qo-search">
          <Search size={16} />
          <input
            ref={inputRef}
            className="qo-input"
            placeholder="Open a document…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                choose(sel);
              } else if (e.key === "Escape") {
                e.preventDefault();
                props.onClose();
              }
            }}
          />
        </div>
        <div className="qo-list" ref={listRef}>
          {results.length === 0 && (
            <div className="qo-empty">No matching documents</div>
          )}
          {results.map((f, i) => (
            <button
              key={f.path}
              className={`qo-row${i === sel ? " active" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(i)}
              title={f.path}
            >
              <FileText size={15} className="qo-icon" />
              <span className="qo-name">{f.name}</span>
              <span className="qo-vault">{props.vaultLabelFor(f.path)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
