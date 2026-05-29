import { useState, useRef, useEffect, useMemo } from "react";
import { LANGUAGE_REGISTRY } from "@intenttext/core";
import { CATEGORY_META, READ_ONLY_KEYWORDS } from "./types";

interface Props {
  onSelect: (keyword: string) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

// Keywords hidden from the block picker (structural/system-managed)
const HIDDEN_KEYWORDS = new Set([
  "history",
  "track",
  "revision",
  "freeze",
  "row",
]);

export function BlockPicker({ onSelect, onClose, position }: Props) {
  const [search, setSearch] = useState("");
  const [focusIdx, setFocusIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Group keywords by category, filter by search
  const groups = useMemo(() => {
    const q = search.toLowerCase();
    const result: Record<string, typeof LANGUAGE_REGISTRY> = {};

    for (const entry of LANGUAGE_REGISTRY) {
      if (HIDDEN_KEYWORDS.has(entry.canonical)) continue;
      if (
        q &&
        !entry.canonical.includes(q) &&
        !entry.description.toLowerCase().includes(q)
      ) {
        continue;
      }
      const cat = entry.category;
      if (!result[cat]) result[cat] = [];
      result[cat].push(entry);
    }
    return result;
  }, [search]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return Object.values(groups).flat();
  }, [groups]);

  useEffect(() => {
    setFocusIdx(0);
  }, [search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatList[focusIdx]) {
        onSelect(flatList[focusIdx].canonical);
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${focusIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [focusIdx]);

  const categoryOrder = [
    "content",
    "structure",
    "data",
    "identity",
    "agent",
    "trust",
    "layout",
  ];

  let globalIdx = 0;

  return (
    <div
      className="it-block-picker-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="it-block-picker"
        style={
          position
            ? { position: "absolute", top: position.top, left: position.left }
            : undefined
        }
      >
        <div className="it-picker-header">
          <input
            ref={inputRef}
            className="it-picker-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search blocks..."
            spellCheck={false}
          />
          <button className="it-picker-close" onClick={onClose}>
            Esc
          </button>
        </div>
        <div className="it-picker-list" ref={listRef}>
          {categoryOrder.map((cat) => {
            const items = groups[cat];
            if (!items || items.length === 0) return null;
            const meta = CATEGORY_META[cat];
            return (
              <div key={cat} className="it-picker-group">
                <div className="it-picker-group-label">
                  {meta?.icon} {meta?.label || cat}
                </div>
                {items.map((entry) => {
                  const idx = globalIdx++;
                  return (
                    <button
                      key={entry.canonical}
                      className={`it-picker-item ${idx === focusIdx ? "focused" : ""}`}
                      data-idx={idx}
                      onClick={() => onSelect(entry.canonical)}
                      onMouseEnter={() => setFocusIdx(idx)}
                    >
                      <span className="it-picker-kw">{entry.canonical}</span>
                      <span className="it-picker-desc">
                        {entry.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {flatList.length === 0 && (
            <div className="it-picker-empty">No matching blocks</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Inline "+" button that appears between blocks
export function AddBlockButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="it-add-block-zone">
      <button className="it-add-block-btn" onClick={onClick} title="Add block">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
        </svg>
      </button>
    </div>
  );
}
