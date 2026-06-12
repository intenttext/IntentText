// Horizontal ruler — the Google Docs strip above the page.
//
// Read-only display of the page width and margins, in the unit the paper size
// implies (A-series → cm, Letter/Legal/Tabloid → inches). All numbers come
// from page-geometry.ts (getPageGeometry of the current document), so the
// ruler is always EXACTLY as wide as the page sheet and the shaded zones sit
// exactly on the print margins. Tracks zoom (same scale factor as the page)
// and the canvas' horizontal scroll (translate), so ticks stay glued to the
// sheet at any zoom level.

import { useEffect, useState, useMemo } from "react";
import type { PageGeometry } from "./page-geometry";

interface RulerProps {
  geometry: PageGeometry;
  zoom: number;
  /** The scrollable canvas element — the ruler mirrors its horizontal scroll. */
  scrollEl: React.RefObject<HTMLDivElement | null>;
}

interface Tick {
  /** Position in page px (unscaled). */
  x: number;
  kind: "minor" | "major";
  label?: string;
}

/** px per ruler unit at zoom 1 (96dpi: 1in = 96px, 1cm = 96/2.54 px). */
const UNIT_PX = { in: 96, cm: 96 / 2.54 } as const;
/** Minor tick step in units (Docs: quarter-inch / half-centimetre). */
const MINOR_STEP = { in: 0.25, cm: 0.5 } as const;

export function DocsRuler({ geometry, zoom, scrollEl }: RulerProps) {
  const [scrollLeft, setScrollLeft] = useState(0);

  // Mirror the canvas' horizontal scroll position.
  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  const ticks = useMemo<Tick[]>(() => {
    const unitPx = UNIT_PX[geometry.unit];
    const step = MINOR_STEP[geometry.unit];
    const out: Tick[] = [];
    const units = geometry.width / unitPx;
    for (let u = 0; u <= units + 1e-6; u += step) {
      const isMajor = Math.abs(u - Math.round(u)) < 1e-6;
      out.push({
        x: u * unitPx,
        kind: isMajor ? "major" : "minor",
        label: isMajor && u > 0 ? String(Math.round(u)) : undefined,
      });
    }
    return out;
  }, [geometry.width, geometry.unit]);

  const w = geometry.width * zoom;

  return (
    <div className="docs-ruler" aria-hidden="true">
      <div
        className="docs-ruler-track"
        style={{ width: w, transform: `translateX(${-scrollLeft}px)` }}
      >
        {/* Shaded zones outside the print margins. */}
        <div
          className="docs-ruler-margin"
          style={{ left: 0, width: geometry.marginLeft * zoom }}
        />
        <div
          className="docs-ruler-margin"
          style={{ right: 0, width: geometry.marginRight * zoom }}
        />
        {ticks.map((t, i) =>
          t.label ? (
            <span
              key={i}
              className="docs-ruler-num"
              style={{ left: t.x * zoom }}
            >
              {t.label}
            </span>
          ) : (
            <span
              key={i}
              className={`docs-ruler-tick docs-ruler-tick--${t.kind}`}
              style={{ left: t.x * zoom }}
            />
          ),
        )}
      </div>
    </div>
  );
}
