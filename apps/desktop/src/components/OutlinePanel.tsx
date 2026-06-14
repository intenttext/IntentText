// OutlinePanel — the document's table of contents (Acrobat-style bookmarks).
// Built from the .it source (title / section / sub, in order); clicking an entry
// scrolls the matching heading into view. Headings render with data-it-type, so
// the Nth outline entry maps to the Nth heading element in document order.
import { useMemo } from "react";
import { X } from "lucide-react";

export interface OutlineEntry {
  level: 1 | 2 | 3;
  text: string;
  index: number; // position among all headings, in document order
}

const HEAD = (kw: string, line: string): string | null => {
  const m = new RegExp(`^${kw}:\\s*(.+?)\\s*(?:\\|.*)?$`).exec(line);
  return m ? m[1].trim() : null;
};

export function buildOutline(source: string): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  let index = 0;
  for (const raw of source.split("\n")) {
    const line = raw.trimStart();
    const t = HEAD("title", line);
    const s = t === null ? HEAD("section", line) : null;
    const u = t === null && s === null ? HEAD("sub", line) : null;
    if (t !== null) out.push({ level: 1, text: t, index: index++ });
    else if (s !== null) out.push({ level: 2, text: s, index: index++ });
    else if (u !== null) out.push({ level: 3, text: u, index: index++ });
  }
  return out;
}

/** Scroll the document heading at `index` (document order) into view. */
export function scrollToHeadingIndex(index: number): void {
  const headings = document.querySelectorAll<HTMLElement>(
    '[data-it-type="title"],[data-it-type="section"],[data-it-type="sub"]',
  );
  headings[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function OutlinePanel(props: {
  source: string;
  onClose: () => void;
}) {
  const entries = useMemo(() => buildOutline(props.source), [props.source]);
  if (entries.length <= 1) return null; // nothing worth navigating

  return (
    <aside className="outline-panel">
      <div className="panel-head">
        <span className="panel-title">Contents</span>
        <button
          className="icon-btn"
          title="Hide contents"
          onClick={props.onClose}
        >
          <X size={14} />
        </button>
      </div>
      <nav className="outline-list">
        {entries.map((e) => (
          <button
            key={e.index}
            className={`outline-row lvl-${e.level}`}
            onClick={() => scrollToHeadingIndex(e.index)}
            title={e.text}
          >
            {e.text}
          </button>
        ))}
      </nav>
    </aside>
  );
}
