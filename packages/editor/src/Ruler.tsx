// Rulers — the Google-Docs strips above and to the left of the page.
//
// Horizontal ruler: shows the page width, ticks in the paper's natural unit
// (A-series → cm, US sizes → in), and DRAGGABLE margin stops on the left and
// right. Dragging a stop rewrites the document's `page:` margins (via
// onMargins), so the shaded zones, the on-screen text column, and the printed
// PDF all move together.
//
// Vertical ruler: the same idea down the left side — top & bottom margin stops.
//
// All px come from page-geometry.ts so the rulers are EXACTLY as long as the
// page sheet and the stops sit exactly on the print margins. Both track zoom
// and the canvas scroll so ticks stay glued to the sheet.

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { PageGeometry } from "./page-geometry";

interface RulerProps {
  geometry: PageGeometry;
  zoom: number;
  /** The scrollable canvas element — the ruler mirrors its scroll. */
  scrollEl: React.RefObject<HTMLDivElement | null>;
  /** Apply new margins (px) when a stop is dragged. Omit → read-only ruler. */
  onMargins?: (next: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }) => void;
  /** Disable dragging (e.g. sealed document). */
  locked?: boolean;
}

interface Tick {
  x: number;
  kind: "minor" | "major";
  label?: string;
}

/** px per ruler unit at zoom 1 (96dpi: 1in = 96px, 1cm = 96/2.54 px). */
const UNIT_PX = { in: 96, cm: 96 / 2.54 } as const;
/** Minor tick step in units (Docs: quarter-inch / half-centimetre). */
const MINOR_STEP = { in: 0.25, cm: 0.5 } as const;

function buildTicks(length: number, unit: "cm" | "in"): Tick[] {
  const unitPx = UNIT_PX[unit];
  const step = MINOR_STEP[unit];
  const out: Tick[] = [];
  const units = length / unitPx;
  for (let u = 0; u <= units + 1e-6; u += step) {
    const isMajor = Math.abs(u - Math.round(u)) < 1e-6;
    out.push({
      x: u * unitPx,
      kind: isMajor ? "major" : "minor",
      label: isMajor && u > 0 ? String(Math.round(u)) : undefined,
    });
  }
  return out;
}

/* ── Horizontal ruler ──────────────────────────────────────────── */

export function DocsRuler({
  geometry,
  zoom,
  scrollEl,
  onMargins,
  locked = false,
}: RulerProps) {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [drag, setDrag] = useState<null | "left" | "right">(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const onScroll = () => setScrollLeft(el.scrollLeft);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  const ticks = useMemo(
    () => buildTicks(geometry.width, geometry.unit),
    [geometry.width, geometry.unit],
  );

  const onPointerDown = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent) => {
      if (!onMargins || locked) return;
      e.preventDefault();
      setDrag(side);
    },
    [onMargins, locked],
  );

  useEffect(() => {
    if (!drag || !onMargins) return;
    const onMove = (e: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const pageX = (e.clientX - rect.left) / zoom; // → page px
      if (drag === "left") {
        const left = Math.max(0, Math.min(pageX, geometry.width / 2));
        onMargins({ left });
      } else {
        const right = Math.max(0, Math.min(geometry.width - pageX, geometry.width / 2));
        onMargins({ right });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onMargins, zoom, geometry.width]);

  const w = geometry.width * zoom;
  const draggable = !!onMargins && !locked;

  return (
    <div className={`docs-ruler${draggable ? " docs-ruler--draggable" : ""}`}>
      <div
        ref={trackRef}
        className="docs-ruler-track"
        style={{ width: w, transform: `translateX(${-scrollLeft}px)` }}
      >
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
            <span key={i} className="docs-ruler-num" style={{ left: t.x * zoom }}>
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
        {draggable && (
          <>
            <span
              className={`docs-ruler-stop docs-ruler-stop--h${drag === "left" ? " dragging" : ""}`}
              style={{ left: geometry.marginLeft * zoom }}
              onPointerDown={onPointerDown("left")}
              title="Drag to set the left margin"
            />
            <span
              className={`docs-ruler-stop docs-ruler-stop--h${drag === "right" ? " dragging" : ""}`}
              style={{ left: (geometry.width - geometry.marginRight) * zoom }}
              onPointerDown={onPointerDown("right")}
              title="Drag to set the right margin"
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ── Vertical ruler (left side) ────────────────────────────────── */

export function DocsVerticalRuler({
  geometry,
  zoom,
  scrollEl,
  onMargins,
  locked = false,
  /** Extra px between the top of the scroll area and the page sheet top. */
  topOffset = 0,
}: RulerProps & { topOffset?: number }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [drag, setDrag] = useState<null | "top" | "bottom">(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollEl.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  // Auto-height pages (receipts) have no fixed sheet height → no vertical stops.
  const pageH = geometry.autoHeight ? geometry.width * 1.414 : geometry.height;
  const ticks = useMemo(
    () => buildTicks(pageH, geometry.unit),
    [pageH, geometry.unit],
  );

  const onPointerDown = useCallback(
    (side: "top" | "bottom") => (e: React.PointerEvent) => {
      if (!onMargins || locked || geometry.autoHeight) return;
      e.preventDefault();
      setDrag(side);
    },
    [onMargins, locked, geometry.autoHeight],
  );

  useEffect(() => {
    if (!drag || !onMargins) return;
    const onMove = (e: PointerEvent) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      // Measure from the ruler track's TOP origin (not .left — that was the
      // bug that made the top stop jump: it computed a vertical offset against
      // the horizontal origin). Now the top stop tracks the cursor smoothly,
      // exactly like the horizontal ruler measures from rect.left.
      const pageY = (e.clientY - rect.top) / zoom;
      if (drag === "top") {
        const top = Math.max(0, Math.min(pageY, pageH / 2));
        onMargins({ top });
      } else {
        const bottom = Math.max(0, Math.min(pageH - pageY, pageH / 2));
        onMargins({ bottom });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onMargins, zoom, pageH]);

  const h = pageH * zoom;
  const draggable = !!onMargins && !locked && !geometry.autoHeight;

  return (
    <div className="docs-ruler-v">
      <div
        ref={trackRef}
        className="docs-ruler-v-track"
        style={{ height: h, transform: `translateY(${topOffset - scrollTop}px)` }}
      >
        <div
          className="docs-ruler-margin docs-ruler-margin--v"
          style={{ top: 0, height: geometry.marginTop * zoom }}
        />
        <div
          className="docs-ruler-margin docs-ruler-margin--v"
          style={{ bottom: 0, height: geometry.marginBottom * zoom }}
        />
        {ticks.map((t, i) =>
          t.label ? (
            <span key={i} className="docs-ruler-num docs-ruler-num--v" style={{ top: t.x * zoom }}>
              {t.label}
            </span>
          ) : (
            <span
              key={i}
              className={`docs-ruler-tick docs-ruler-tick--v docs-ruler-tick--${t.kind}`}
              style={{ top: t.x * zoom }}
            />
          ),
        )}
        {draggable && (
          <>
            <span
              className={`docs-ruler-stop docs-ruler-stop--v${drag === "top" ? " dragging" : ""}`}
              style={{ top: geometry.marginTop * zoom }}
              onPointerDown={onPointerDown("top")}
              title="Drag to set the top margin"
            />
            <span
              className={`docs-ruler-stop docs-ruler-stop--v${drag === "bottom" ? " dragging" : ""}`}
              style={{ top: (pageH - geometry.marginBottom) * zoom }}
              onPointerDown={onPointerDown("bottom")}
              title="Drag to set the bottom margin"
            />
          </>
        )}
      </div>
    </div>
  );
}
