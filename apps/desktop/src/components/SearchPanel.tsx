// SearchPanel — FEDERATED search across every registered vault using the core
// query engine. Mix free text with filters, e.g.:
//   type=invoice status=Unpaid
//   owner:contains=sara due<2026-07-01 sort:due:asc limit:20
// Results are grouped by document and tagged with the vault they came from,
// with a sealed badge; clicking a result opens the document in the viewer.

import { forwardRef, useCallback, useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { readFile } from "../lib/backend";
import { searchVaults } from "../lib/search";
import type { SearchFile, SearchSummary } from "../lib/search";
import type { VaultsApi } from "../hooks/useVaults";

export const SearchPanel = forwardRef<
  HTMLInputElement,
  {
    api: VaultsApi;
    onOpenFile: (path: string) => void;
  }
>(function SearchPanel({ api, onOpenFile }, inputRef) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchSummary | null>(null);
  const [busy, setBusy] = useState(false);

  // The corpus to search: the active vault when scoped, otherwise every vault.
  const corpus = useMemo<SearchFile[]>(() => {
    const collect = (
      files: { path: string; relativePath: string; modified: number }[],
      label: string,
    ): SearchFile[] =>
      files.map((f) => ({
        path: f.path,
        relativePath: f.relativePath,
        modified: f.modified,
        vaultLabel: label,
      }));

    if (api.scope === "all") {
      return api.vaults.flatMap((v) => collect(v.itFiles, v.label));
    }
    const v = api.activeVault;
    return v ? collect(v.itFiles, v.label) : [];
  }, [api.scope, api.vaults, api.activeVault]);

  const scopeName =
    api.scope === "all" ? "all folders" : (api.activeVault?.label ?? "");

  const runSearch = useCallback(async () => {
    if (!query.trim() || corpus.length === 0) {
      setResult(null);
      return;
    }
    setBusy(true);
    try {
      setResult(await searchVaults(corpus, readFile, query));
    } finally {
      setBusy(false);
    }
  }, [corpus, query]);

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

  const empty = corpus.length === 0;

  return (
    <div className="search-panel">
      <div className="panel-head">
        <span className="panel-title">Search {scopeName}</span>
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
            empty ? "Add a folder first" : "type=invoice status=Unpaid …"
          }
          disabled={empty}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="btn primary small"
          type="submit"
          disabled={empty || busy}
        >
          {busy ? "…" : "Find"}
        </button>
      </form>
      <div className="search-hint">
        Filters: <code>type=</code> <code>status=</code> <code>owner=</code>{" "}
        <code>field?</code> <code>field:contains=</code> <code>&lt; &gt;</code>{" "}
        <code>sort:f:asc</code> <code>limit:N</code> — plus free text.
      </div>

      {result && (
        <div className="search-meta">
          {result.totalMatches} match{result.totalMatches === 1 ? "" : "es"} in{" "}
          {result.filesMatched} of {result.filesScanned} docs ·{" "}
          {result.elapsedMs} ms
          {result.parseFailures > 0 && (
            <span className="muted"> · {result.parseFailures} unreadable</span>
          )}
        </div>
      )}

      <div className="search-results">
        {grouped.map(([path, hits]) => {
          const head = hits[0];
          return (
            <div key={path} className="search-file">
              <button
                className="search-file-head"
                onClick={() => onOpenFile(path)}
                title={path}
              >
                <span className="search-file-title">
                  {head.title || head.relativePath.replace(/\.it$/i, "")}
                  {head.sealed && (
                    <Lock size={11} className="trust-icon trust-sealed" />
                  )}
                </span>
                <span className="search-file-meta">
                  <span className="search-vault">{head.vaultLabel}</span>
                  {head.docType && (
                    <span className="search-doctype">{head.docType}</span>
                  )}
                </span>
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
          );
        })}
        {result && result.hits.length === 0 && (
          <div className="panel-empty">
            <p>No matches.</p>
          </div>
        )}
      </div>
    </div>
  );
});
