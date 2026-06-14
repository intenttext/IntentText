// PageThumbnails — a PDF-style page rail. The editor renders ONE continuous
// sheet (.docs-page) paginated by CSS bands, so each thumbnail is a scaled clone
// of that sheet, clipped to one page's vertical slice. Page metrics are derived
// from the DOM (no editor changes). Clicking a thumbnail scrolls to that page.
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const THUMB_W = 150;
const MAX_THUMBS = 60;

interface PageInfo {
  count: number;
  pageW: number;
  pageH: number;
  zoom: number;
}

function readPageInfo(): PageInfo | null {
  const page = document.querySelector<HTMLElement>(".docs-page");
  if (!page) return null;
  const pageW = page.offsetWidth;
  const totalH = page.offsetHeight;
  if (!pageW || !totalH) return null;
  // page count from the editor's footer line ("N pages · …")
  const footer = document.querySelector(".docs-page-footer")?.textContent ?? "";
  const m = footer.match(/(\d+)\s*pages?/i);
  const count = m ? Math.max(1, parseInt(m[1], 10)) : 1;
  const scaler = document.querySelector<HTMLElement>(".docs-page-scaler");
  const zoom = scaler && pageW ? scaler.offsetWidth / pageW : 1;
  return { count, pageW, pageH: totalH / count, zoom };
}

function jumpToPage(index: number, info: PageInfo): void {
  const canvas = document.querySelector<HTMLElement>(".docs-canvas");
  if (!canvas) return;
  // Proportional within the canvas's own scroll range — robust against zoom and
  // any top offset (pages are uniform height, so page i top ≈ (i/N)·scrollHeight).
  const top = info.count > 0 ? (index / info.count) * canvas.scrollHeight : 0;
  canvas.scrollTo({ top, behavior: "smooth" });
}

function Thumb({ index, info }: { index: number; info: PageInfo }) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const page = document.querySelector<HTMLElement>(".docs-page");
    if (!host || !page) return;
    const s = THUMB_W / info.pageW;
    const clone = page.cloneNode(true) as HTMLElement;
    clone.removeAttribute("contenteditable");
    clone
      .querySelectorAll("[contenteditable]")
      .forEach((e) => e.removeAttribute("contenteditable"));
    // Carry the page margins over explicitly — the content (.tiptap) insets by
    // --page-mx-l/r; if those don't survive the clone the text recentres.
    const cs = getComputedStyle(page);
    for (const v of ["--page-mx-l", "--page-mx-r"]) {
      const val = page.style.getPropertyValue(v) || cs.getPropertyValue(v);
      if (val) clone.style.setProperty(v, val);
    }
    clone.style.transform = `scale(${s})`;
    clone.style.transformOrigin = "top left";
    clone.style.width = `${info.pageW}px`;
    clone.style.margin = "0"; // override .docs-sheet's `margin: 0 auto` (flush-left)
    clone.style.boxShadow = "none";
    const inner = document.createElement("div");
    inner.style.position = "absolute";
    inner.style.left = "0";
    inner.style.top = `${-index * info.pageH * s}px`;
    inner.appendChild(clone);
    host.replaceChildren(inner);
  }, [index, info]);

  return (
    <div className="thumb-item">
      <button
        className="thumb"
        style={{ width: THUMB_W, height: info.pageH * (THUMB_W / info.pageW) }}
        onClick={() => jumpToPage(index, info)}
        title={`Page ${index + 1}`}
      >
        <div className="thumb-clip" ref={hostRef} />
      </button>
      <span className="thumb-num">{index + 1}</span>
    </div>
  );
}

export function PageThumbnails({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<PageInfo | null>(null);
  useEffect(() => {
    const update = () => setInfo(readPageInfo());
    update();
    // re-read after pagination/layout settles
    const t = setTimeout(update, 350);
    return () => clearTimeout(t);
  }, [source]);

  return (
    <aside className="thumbs-panel">
      <div className="panel-head">
        <span className="panel-title">Pages</span>
        <button className="icon-btn" title="Hide pages" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="thumbs-list">
        {info ? (
          Array.from({ length: Math.min(info.count, MAX_THUMBS) }, (_, i) => (
            <Thumb key={i} index={i} info={info} />
          ))
        ) : (
          <div className="panel-empty small">Rendering pages…</div>
        )}
      </div>
    </aside>
  );
}
