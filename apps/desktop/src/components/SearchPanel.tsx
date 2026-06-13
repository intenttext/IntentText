// SearchPanel — workspace-wide search over .it documents using the core
// query engine. Mix free text with filters, e.g.:
//   type=task status=open onboarding
//   owner:contains=sara due<2026-07-01

import { forwardRef, useCallback, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { readFile } from "../lib/backend";
import { searchWorkspace } from "../lib/search";
import type { SearchSummary } from "../lib/search";
import type { Workspace } from "../hooks/useWorkspace";

export const SearchPanel = forwardRef<
  HTMLInputElement,
  {
    workspace: Workspace | null;
    onOpenFile: (path: string) => void;
  }
>(function SearchPanel({ workspace, onOpenFile }, inputRef) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const runSearch = useCallback(async () => {
    if (!workspace || !query.trim()) {
      setResult(null);
      return;
    }
    setBusy(true);
    try {
      const summary = await searchWorkspace(
        workspace.itFiles,
        readFile,
        query,
      );
      setResult(summary);
    } finally {
      setBusy(false);
    }
  }, [workspace, query]);

  const grouped = useMemo(() => {
    if (!result) return [];
    const byFile = new Map<string, typeof result.hits>();
    for (const hit of result.hits) {
      const list = byFile.get(hit.path) ?? [];
      list.push(hit);
      byFile.set(hit.path, list);
    }
    return [...byFile.entries()];
  }, [result]);

  return (
    <div className="search-panel">
      <div className="panel-head">
        <span className="panel-title">Search</span>
      </div>

      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
      >
        <Search size={14} className="search-icon" />
        <input
          ref={inputRef}
          className="search-input"
          placeholder={
            workspace ? "type=task status=open …" : "Choose a workspace first"
          }
          disabled={!workspace}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="btn primary small"
          type="submit"
          disabled={!workspace || busy}
        >
          {busy ? "…" : "Find"}
        </button>
      </form>
      <div className="search-hint">
        Filters: <code>type=</code> <code>status=</code> <code>owner=</code>{" "}
        <code>field?</code> <code>field:contains=</code> <code>&lt; &gt;</code>{" "}
        — plus free text.
      </div>

      {result && (
        <div className="search-meta">
          {result.totalMatches} match{result.totalMatches === 1 ? "" : "es"} in{" "}
          {result.filesMatched} of {result.filesScanned} files ·{" "}
          {result.elapsedMs} ms
          {result.parseFailures > 0 && (
            <span className="muted"> · {result.parseFailures} unreadable</span>
          )}
        </div>
      )}

      <div className="search-results">
        {grouped.map(([path, hits]) => (
          <div key={path} className="search-file">
            <button
              className="search-file-head"
              onClick={() => onOpenFile(path)}
              title={path}
            >
              {hits[0].title || hits[0].relativePath}
              <span className="muted"> — {hits[0].relativePath}</span>
            </button>
            {hits.map((hit, i) => (
              <button
                key={`${path}:${i}`}
                className="search-hit"
                onClick={() => onOpenFile(path)}
              >
                <span className={`hit-type kw-${hit.blockType}`}>
                  {hit.blockType}
                </span>
                <span className="hit-snippet">{hit.snippet}</span>
                {hit.line != null && (
                  <span className="hit-line">:{hit.line}</span>
                )}
              </button>
            ))}
          </div>
        ))}
        {result && result.hits.length === 0 && (
          <div className="panel-empty">
            <p>No matches.</p>
          </div>
        )}
      </div>
    </div>
  );
});
