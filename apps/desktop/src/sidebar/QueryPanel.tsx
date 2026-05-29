import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface QueryResult {
  file: string;
  file_abs: string;
  line: number;
  block_type: string;
  content: string;
}

interface QueryResponse {
  total_matches: number;
  files: number;
  hits: QueryResult[];
}

interface QueryPanelProps {
  folderPath: string | null;
  onFileOpen: (path: string) => void;
}

const BLOCK_TYPES = [
  "any",
  "approve",
  "clause",
  "deadline",
  "def",
  "escalate",
  "freeze",
  "meta",
  "note",
  "obligation",
  "party",
  "require",
  "review",
  "rule",
  "seal",
  "section",
  "sign",
  "status",
  "term",
  "title",
  "warn",
];

export function QueryPanel({ folderPath, onFileOpen }: QueryPanelProps) {
  const [blockType, setBlockType] = useState("any");
  const [byFilter, setByFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("any");
  const [domainFilter, setDomainFilter] = useState("any");
  const [results, setResults] = useState<QueryResult[]>([]);
  const [searching, setSearching] = useState(false);

  const runQuery = useCallback(async () => {
    if (!folderPath) return;
    setSearching(true);

    try {
      // Build search query from filters
      const parts: string[] = [];
      if (blockType !== "any") parts.push(`type=${blockType}`);
      if (byFilter.trim()) parts.push(`by=${byFilter.trim()}`);
      if (statusFilter !== "any") parts.push(`status=${statusFilter}`);
      if (domainFilter !== "any") parts.push(`domain=${domainFilter}`);

      const query = parts.length > 0 ? parts.join(" ") : "";
      if (!query) {
        setResults([]);
        setSearching(false);
        return;
      }

      const res = await invoke<QueryResponse>("search_vault_cmd", {
        query,
      });
      setResults(res.hits);
    } catch (err) {
      console.error("Query failed:", err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [folderPath, blockType, byFilter, statusFilter, domainFilter]);

  if (!folderPath) {
    return (
      <div className="sidebar-empty">
        <p>Open a folder to query</p>
      </div>
    );
  }

  return (
    <div className="query-panel">
      <div className="query-filters">
        <label>
          Type
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value)}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          By
          <input
            type="text"
            placeholder="Name..."
            value={byFilter}
            onChange={(e) => setByFilter(e.target.value)}
          />
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="any">any</option>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="pending">pending</option>
          </select>
        </label>

        <label>
          Domain
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="any">any</option>
            <option value="legal">legal</option>
            <option value="hr">hr</option>
            <option value="finance">finance</option>
            <option value="compliance">compliance</option>
            <option value="healthcare">healthcare</option>
          </select>
        </label>

        <button
          className="query-run-btn"
          onClick={runQuery}
          disabled={searching}
        >
          {searching ? "Searching..." : "Run Query"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="query-result-count">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </div>
      )}

      <div className="query-results">
        {results.map((r, i) => (
          <div
            key={i}
            className="query-result-item"
            onClick={() => onFileOpen(r.file_abs)}
          >
            <div className="query-result-file">
              {r.file} · L{r.line}
            </div>
            <div className="query-result-content">
              [{r.block_type}] {r.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
