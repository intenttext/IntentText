import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEMO_DOCS, type DemoDoc } from "./demoVault";

type ShowcaseMode = "search" | "trust" | "workflow";
type SearchScope = "vault" | "folder";

interface SearchHit {
  file: string;
  file_abs: string;
  line: number;
  block_type: string;
  content: string;
}

interface SearchResponse {
  total_matches: number;
  files: number;
  hits: SearchHit[];
}

interface Props {
  activeTitle?: string;
  folderPath: string | null;
  activeFilePath: string | null;
  onFileOpen: (path: string) => void;
  onLoadDemo: (doc: DemoDoc) => void;
  mode: ShowcaseMode;
  onModeChange: (mode: ShowcaseMode) => void;
}

const PRESET_QUERIES = [
  "type=task owner=Ahmed",
  "type=task due<2026-04-15",
  "type=sign",
  "type=metric",
  "payment terms",
];

export function SearchShowcasePanel({
  activeTitle,
  folderPath,
  activeFilePath,
  onFileOpen,
  onLoadDemo,
  mode,
  onModeChange,
}: Props) {
  const [query, setQuery] = useState("type=task owner=Ahmed");
  const [scope, setScope] = useState<SearchScope>("vault");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [fileCount, setFileCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usingVault = Boolean(folderPath);
  const folderScopePrefix = useMemo(() => {
    if (!folderPath || !activeFilePath) return "";
    if (!activeFilePath.startsWith(folderPath)) return "";
    const rel = activeFilePath.slice(folderPath.length).replace(/^\/+/, "");
    const i = rel.lastIndexOf("/");
    return i >= 0 ? rel.slice(0, i) : "";
  }, [folderPath, activeFilePath]);

  useEffect(() => {
    if (!usingVault || !query.trim()) {
      setHits([]);
      setFileCount(0);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        let res: SearchResponse;
        if (scope === "folder" && folderScopePrefix) {
          res = await invoke<SearchResponse>("search_vault_folder_cmd", {
            query: query.trim(),
            folder: folderScopePrefix,
          });
        } else {
          res = await invoke<SearchResponse>("search_vault_cmd", {
            query: query.trim(),
          });
        }

        if (!cancelled) {
          setHits(res.hits.slice(0, 50));
          setFileCount(res.files);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setHits([]);
          setFileCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, usingVault, scope, folderPath, folderScopePrefix]);

  const demoResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as DemoDoc[];
    return DEMO_DOCS.filter((d) => d.source.toLowerCase().includes(q)).slice(
      0,
      8,
    );
  }, [query]);

  return (
    <aside className="showcase-panel">
      <div className="showcase-panel-header">
        <h3>{usingVault ? "Vault Search" : "Demo Search"}</h3>
        <p>
          {usingVault
            ? "Live query against .it-index (desktop vault mode)."
            : "No folder open yet. Searching built-in demo docs."}
        </p>
        <div
          className="showcase-mode-switch"
          role="tablist"
          aria-label="Showcase modes"
        >
          <button
            className={mode === "search" ? "active" : ""}
            onClick={() => onModeChange("search")}
          >
            Search
          </button>
          <button
            className={mode === "trust" ? "active" : ""}
            onClick={() => onModeChange("trust")}
          >
            Trust
          </button>
          <button
            className={mode === "workflow" ? "active" : ""}
            onClick={() => onModeChange("workflow")}
          >
            Workflow
          </button>
        </div>
      </div>

      <div className="showcase-field">
        <label>Search Query</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="type=task owner=Ahmed payment"
        />
      </div>

      <div className="showcase-chip-row">
        {PRESET_QUERIES.map((preset) => (
          <button
            key={preset}
            className="showcase-chip"
            onClick={() => setQuery(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      {usingVault && (
        <div className="showcase-chip-row" style={{ paddingTop: 0 }}>
          <button
            className={`showcase-chip ${scope === "vault" ? "removable" : ""}`}
            onClick={() => setScope("vault")}
          >
            Full Vault
          </button>
          <button
            className={`showcase-chip ${scope === "folder" ? "removable" : ""}`}
            onClick={() => setScope("folder")}
            disabled={!folderScopePrefix}
            title={
              folderScopePrefix
                ? `Search in ${folderScopePrefix}`
                : "Open a file to scope search to its folder"
            }
          >
            Current Folder
          </button>
        </div>
      )}

      <div className="showcase-statline">
        <span>
          {usingVault
            ? `${hits.length} matches across ${fileCount} files`
            : `${demoResults.length} demo matches`}
        </span>
        <span>
          {loading ? "Searching..." : error ? "Search error" : "Ready"}
        </span>
      </div>

      <div className="showcase-result-list">
        {usingVault &&
          hits.map((h, i) => (
            <button
              key={`${h.file_abs}-${h.line}-${i}`}
              className="showcase-result showcase-result-table"
              onClick={() => onFileOpen(h.file_abs)}
            >
              <div className="showcase-result-top">
                <strong>{h.file}</strong>
                <span>{h.block_type}</span>
              </div>
              <div className="showcase-result-line">
                L{h.line}: {h.content || "(empty)"}
              </div>
            </button>
          ))}

        {!usingVault &&
          demoResults.map((d) => (
            <button
              key={d.id}
              className="showcase-result showcase-result-table"
              onClick={() => onLoadDemo(d)}
            >
              <div className="showcase-result-top">
                <strong>{d.section + "/" + d.id + ".it"}</strong>
                <span>demo</span>
              </div>
              <div className="showcase-result-line">{d.title}</div>
            </button>
          ))}

        {!loading && !error && usingVault && hits.length === 0 && (
          <div className="showcase-empty">No vault matches for this query.</div>
        )}
        {!loading && !error && !usingVault && demoResults.length === 0 && (
          <div className="showcase-empty">No demo matches for this query.</div>
        )}
        {error && <div className="showcase-empty">{error}</div>}
      </div>

      <div className="showcase-current-doc">
        <label>Current editor document</label>
        <div>{activeTitle || "Untitled"}</div>
      </div>
    </aside>
  );
}
