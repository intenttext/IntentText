// DocumentView — a first-class, read-only "read like a PDF" view for .it documents.
//
// Unlike the live editor (VisualEditor) — which paginates with ProseMirror widget
// decorations that macOS WKWebView can leave unpainted until a relayout — this view
// renders the document as REAL, separate page-sheet <div>s: white pages on a grey
// desk with gaps, exactly like a PDF reader. Real DOM paints reliably everywhere,
// and the same structure is what we hand to print.
//
// It renders through @dotit/core's renderPrint (the same engine the PDF export and
// editor use, so layout matches print), measures the blocks once at the page
// content width, and packs them into page-height sheets.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  parseIntentText,
  renderPrint,
  renderTrustBand,
  TRUST_BAND_CSS,
} from "@dotit/core";
import { getPageGeometry } from "./page-geometry";

interface Extracted {
  styles: string;
  body: string;
  bodyClass: string;
}

// Pull the <style> blocks + <body> inner HTML out of a renderPrint document, and
// rescope its `body.it-print` rules to our page-body class — so the document's base
// typography applies to the page sheets WITHOUT the styles ever touching the host
// app's <body> (the app body has no it-print class).
function extractPrint(source: string, theme: string, bare: boolean): Extracted {
  let html: string;
  try {
    // seal:false — suppress core's top-right stamp; we render our own unified
    // trust BAND in each page's footer margin instead (see trustBandHtml).
    html = renderPrint(parseIntentText(source), { theme, bare, seal: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { styles: "", body: `<p style="color:#b91c1c">Could not render: ${msg}</p>`, bodyClass: "" };
  }
  const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)]
    .map((m) => m[0])
    .join("\n")
    .replace(/body\.it-print/g, ".docs-view-page-body");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const bodyClass = (html.match(/<body[^>]*class="([^"]*)"/i)?.[1] ?? "").trim();
  return { styles, body, bodyClass };
}

export interface DocumentViewProps {
  /** The `.it` source to render. */
  value: string;
  /** Theme name (corporate | legal | …). */
  theme?: string;
  /** Zoom factor (1 = 100%). */
  zoom?: number;
  /** Render the BARE projection (content + emphasis only, no decoration). */
  bare?: boolean;
}

export function DocumentView({
  value,
  theme = "corporate",
  zoom = 1,
  bare = false,
}: DocumentViewProps) {
  const g = useMemo(() => getPageGeometry(value), [value]);
  const { styles, body, bodyClass } = useMemo(
    () => extractPrint(value, theme, bare),
    [value, theme, bare],
  );
  // Unified trust band (core) — repeated in every page's footer margin (out of flow).
  const band = useMemo(() => renderTrustBand(value), [value]);
  const contentWidth = Math.max(1, g.width - g.marginLeft - g.marginRight);
  const measureRef = useRef<HTMLDivElement>(null);
  // Fallback before measurement: the whole document on one sheet.
  const [pages, setPages] = useState<string[]>([body]);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    // Receipts / auto-height pages: one continuous sheet, no pagination.
    if (g.autoHeight || !Number.isFinite(g.contentHeight)) {
      setPages([body]);
      return;
    }
    // renderPrint wraps the whole document in a single container
    // (<div class="intent-document">). Descend through such single-child wrappers
    // to reach the REAL content blocks — otherwise there's only one giant block
    // and nothing can be split onto a second page. Remember the wrappers so each
    // page can be re-wrapped (preserving their styling/width).
    let container: HTMLElement = el;
    const wrappers: { tag: string; className: string }[] = [];
    while (
      container.children.length === 1 &&
      container.firstElementChild &&
      container.firstElementChild.children.length > 1
    ) {
      const c = container.firstElementChild as HTMLElement;
      wrappers.push({ tag: c.tagName.toLowerCase(), className: c.className });
      container = c;
    }
    const wrap = (inner: string): string => {
      let h = inner;
      for (let i = wrappers.length - 1; i >= 0; i--) {
        const w = wrappers[i];
        h = `<${w.tag}${w.className ? ` class="${w.className}"` : ""}>${h}</${w.tag}>`;
      }
      return h;
    };

    const blocks = Array.from(container.children) as HTMLElement[];
    if (!blocks.length) {
      setPages([body]);
      return;
    }
    // Pack top-level blocks into page-height groups (offsetTop is unscaled layout px).
    const groups: HTMLElement[][] = [[]];
    let pageStart = blocks[0].offsetTop;
    for (const b of blocks) {
      const bottom = b.offsetTop + b.offsetHeight;
      if (b.offsetTop > pageStart && bottom - pageStart > g.contentHeight) {
        groups.push([]);
        pageStart = b.offsetTop;
      }
      groups[groups.length - 1].push(b);
    }
    setPages(groups.map((grp) => wrap(grp.map((b) => b.outerHTML).join(""))));
  }, [body, g.autoHeight, g.contentHeight, contentWidth]);

  return (
    <div className="docs-view">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {/* Trust band VISUAL from core (single source of truth); the .it-trust-band-host
          wrapper supplies on-screen positioning (bottom-right of each sheet). */}
      <style dangerouslySetInnerHTML={{ __html: TRUST_BAND_CSS }} />
      {/* Off-screen measuring column at the exact page content width. */}
      <div
        ref={measureRef}
        className={`docs-view-page-body ${bodyClass}`}
        style={{
          position: "absolute",
          left: -100000,
          top: 0,
          width: contentWidth,
          visibility: "hidden",
          pointerEvents: "none",
        }}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <div className="docs-view-scroll">
        <div
          className="docs-view-stack"
          style={
            zoom !== 1
              ? { transform: `scale(${zoom})`, transformOrigin: "top center" }
              : undefined
          }
        >
          {pages.map((html, i) => (
            <div
              key={i}
              className="docs-view-page"
              style={{
                width: g.width,
                minHeight: g.autoHeight ? undefined : g.height,
                position: "relative",
              }}
            >
              <div
                className={`docs-view-page-body ${bodyClass}`}
                style={{
                  padding: `${g.marginTop}px ${g.marginRight}px ${g.marginBottom}px ${g.marginLeft}px`,
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {band && (
                <div
                  className="it-trust-band-host"
                  style={{
                    right: g.marginRight,
                    bottom: Math.max(6, g.marginBottom * 0.34),
                  }}
                  dangerouslySetInnerHTML={{ __html: band }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
