// DocThumb — a small, reliable page-preview thumbnail for an .it file.
//
// It renders the document through core's renderPrint (the SAME engine the
// viewer/print/PDF use, so the thumbnail looks like the real page) scaled way
// down into a tiny page sheet. Two things keep it correct where the old Tauri
// thumbnail went stale ("didn't catch up / hallucinated"):
//   • the cache is keyed on path + mtime, so editing a file refreshes its thumb;
//   • it only reads + renders when scrolled into view (IntersectionObserver),
//     so a big folder doesn't read every file up front.

import { useEffect, useRef, useState } from "react";
import { parseIntentText, renderPrint } from "@dotit/core";
import { readFile } from "../lib/backend";

// Rendered-body cache, keyed on `${path}@${mtime}` so it self-invalidates when
// the file changes on disk. Shared across all thumbnails for the session.
const thumbCache = new Map<string, string>();

const PAGE_W = 794; // ~A4 width in px at 96dpi — matches renderPrint's page box

function buildThumbHtml(source: string): string {
  const full = renderPrint(parseIntentText(source), {});
  const body = full.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  // Rescope the print body rules onto our thumb page (never touch the app body).
  const styles = [...full.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n")
    .replace(/body\.it-print/g, ".doc-thumb-page");
  return `${styles}<div class="doc-thumb-page">${body}</div>`;
}

export function DocThumb({
  path,
  mtime,
}: {
  path: string;
  /** File mtime (seconds) — part of the cache key, so edits refresh the thumb. */
  mtime: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(null);

  // Render lazily — only once the row is (nearly) on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const key = `${path}@${mtime}`;
    const cached = thumbCache.get(key);
    if (cached !== undefined) {
      setHtml(cached);
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const src = await readFile(path);
        const out = buildThumbHtml(src);
        thumbCache.set(key, out);
        if (alive) setHtml(out);
      } catch {
        if (alive) setHtml(""); // unreadable/unparseable — show a blank page
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, path, mtime]);

  return (
    <div className="doc-thumb" ref={ref} aria-hidden>
      {html ? (
        <div
          className="doc-thumb-scale"
          style={{ width: PAGE_W }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
    </div>
  );
}
