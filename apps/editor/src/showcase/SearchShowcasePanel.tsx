import { useMemo, useState } from "react";
import { parseIntentText } from "@intenttext/core";
import { DEMO_DOCS, type DemoDoc } from "./demoVault";

interface Props {
  activeTitle?: string;
  onLoadDemo: (doc: DemoDoc) => void;
  mode: "search" | "trust" | "workflow";
  onModeChange: (mode: "search" | "trust" | "workflow") => void;
}

type FilterToken = {
  field: string;
  op: "=" | "!=" | "<" | ">";
  value: string;
  raw: string;
};

type MatchRow = {
  doc: DemoDoc;
  type: string;
  content: string;
  props: string;
};

const PRESET_QUERIES = [
  "type=task owner=Ahmed",
  "type=task due<2026-04-15",
  "type=sign",
  "type=metric",
  "payment terms",
];

function parseDateToScore(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return Number(`${iso[1]}${iso[2]}${iso[3]}`);
  }

  const uk = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (uk) {
    return Number(`${uk[3]}${uk[2]}${uk[1]}`);
  }

  return null;
}

function parseQuery(query: string): {
  filters: FilterToken[];
  freeText: string;
} {
  const tokenRe = /([a-zA-Z_][\w-]*)\s*(=|!=|<|>)\s*([^\s]+)/g;
  const filters: FilterToken[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(query)) !== null) {
    filters.push({
      field: m[1].toLowerCase(),
      op: m[2] as FilterToken["op"],
      value: m[3],
      raw: m[0],
    });
  }

  const freeText = query.replace(tokenRe, " ").replace(/\s+/g, " ").trim();
  return { filters, freeText };
}

function passesFilter(
  filter: FilterToken,
  block: {
    type: string;
    content?: string;
    properties?: Record<string, unknown>;
  },
): boolean {
  const valueLower = filter.value.toLowerCase();

  const getField = () => {
    if (filter.field === "type") return block.type;
    if (filter.field === "content") return block.content || "";
    return String(block.properties?.[filter.field] || "");
  };

  const fieldValue = String(getField()).trim();
  const fieldLower = fieldValue.toLowerCase();

  if (filter.op === "=") return fieldLower === valueLower;
  if (filter.op === "!=") return fieldLower !== valueLower;

  const leftDate = parseDateToScore(fieldValue);
  const rightDate = parseDateToScore(filter.value);
  if (leftDate != null && rightDate != null) {
    return filter.op === "<" ? leftDate < rightDate : leftDate > rightDate;
  }

  return filter.op === "<" ? fieldLower < valueLower : fieldLower > valueLower;
}

function propsSummary(props: Record<string, unknown> | undefined): string {
  if (!props) return "";
  const keys = ["owner", "due", "priority", "status", "by", "role"];
  return keys
    .filter((k) => props[k] != null && String(props[k]).trim() !== "")
    .map((k) => `${k}: ${String(props[k])}`)
    .join(" · ");
}

export function SearchShowcasePanel({
  activeTitle,
  onLoadDemo,
  mode,
  onModeChange,
}: Props) {
  const [query, setQuery] = useState("type=task owner=Ahmed");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const indexed = useMemo(() => {
    return DEMO_DOCS.map((doc) => {
      try {
        const parsed = parseIntentText(doc.source);
        return { doc, parsed, error: null as string | null };
      } catch (err) {
        return {
          doc,
          parsed: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });
  }, []);

  const parsedQuery = useMemo(() => parseQuery(query), [query]);

  const results = useMemo(() => {
    const words = parsedQuery.freeText
      .toLowerCase()
      .split(" ")
      .map((w) => w.trim())
      .filter(Boolean);

    const out: MatchRow[] = [];

    for (const item of indexed) {
      if (!item.parsed) continue;
      for (const block of item.parsed.blocks) {
        const filtersOk = parsedQuery.filters.every((f) =>
          passesFilter(f, block),
        );
        if (!filtersOk) continue;

        const haystack =
          `${block.type} ${block.content || ""} ${JSON.stringify(block.properties || {})}`.toLowerCase();
        const textOk = words.every((w) => haystack.includes(w));
        if (!textOk) continue;

        out.push({
          doc: item.doc,
          type: block.type,
          content: block.content || "",
          props: propsSummary(block.properties),
        });
      }
    }

    return out.slice(0, 30);
  }, [indexed, parsedQuery]);

  const groupedCount = useMemo(() => {
    const s = new Set(results.map((r) => r.doc.id));
    return s.size;
  }, [results]);

  const removeFilter = (raw: string) => {
    const cleaned = query.replace(raw, " ").replace(/\s+/g, " ").trim();
    setQuery(cleaned);
  };

  return (
    <aside className="showcase-panel">
      <div className="showcase-panel-header">
        <h3>Vault Search</h3>
        <p>Typed query + fuzzy text across seeded vault docs.</p>
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

      <div className="showcase-chip-row" style={{ paddingTop: 8 }}>
        {parsedQuery.filters.map((f, i) => (
          <button
            key={`${f.raw}-${i}`}
            className="showcase-chip removable"
            onClick={() => removeFilter(f.raw)}
            title="Remove filter"
          >
            {f.field}
            {f.op}
            {f.value} ×
          </button>
        ))}
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

      <div className="showcase-statline">
        <span>
          {results.length} matches across {groupedCount} files
        </span>
        <span className="showcase-view-toggle">
          <button
            className={viewMode === "table" ? "active" : ""}
            onClick={() => setViewMode("table")}
          >
            table
          </button>
          <button
            className={viewMode === "cards" ? "active" : ""}
            onClick={() => setViewMode("cards")}
          >
            cards
          </button>
        </span>
      </div>

      <div className="showcase-result-list">
        {results.map((r, i) => {
          const rowCls =
            viewMode === "table"
              ? "showcase-result showcase-result-table"
              : "showcase-result showcase-result-card";
          return (
            <button
              key={`${r.doc.id}-${i}`}
              className={rowCls}
              onClick={() => onLoadDemo(r.doc)}
            >
              <div className="showcase-result-top">
                <strong>{r.doc.section + "/" + r.doc.id + ".it"}</strong>
                <span>{r.type}</span>
              </div>
              <div className="showcase-result-line">
                {r.content || "(empty)"}
              </div>
              {r.props && <div className="workflow-dep">{r.props}</div>}
            </button>
          );
        })}
        {results.length === 0 && (
          <div className="showcase-empty">No matches for current filters.</div>
        )}
      </div>

      <div className="showcase-current-doc">
        <label>Current editor document</label>
        <div>{activeTitle || "Untitled"}</div>
      </div>

      <div className="showcase-actions">
        {DEMO_DOCS.map((doc) => (
          <button key={doc.id} onClick={() => onLoadDemo(doc)}>
            Open {doc.section}/{doc.id}
          </button>
        ))}
      </div>
    </aside>
  );
}
