// Word-like page pagination for the visual editor.
//
// One continuous contenteditable sheet is visually cut into real pages:
// at each page boundary a non-editable spacer widget renders
//   [filler to the page bottom + footer band] [page gap] [header band]
// and a terminal spacer closes the LAST page with its filler + footer band,
// so every page — first, middle, last — shows its header/footer and keeps its
// exact print height. Content is never hidden or clipped (the old masking bug);
// the caret stays in document order.
//
// Geometry comes from page-geometry.ts (the document's own `page:` block) — the
// same numbers core's @page print CSS uses, which is what makes the editor view
// match the printed PDF page-for-page.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { PageGeometry } from "./page-geometry";
import { resolvePageTokens } from "./page-geometry";

export interface PaginationOptions {
  /** Live geometry — read on every layout pass so doc edits apply instantly. */
  geometry: () => PageGeometry;
  /** Grey gap between page cards (px). */
  gap: number;
  /** Called with the resulting page count after each layout pass. */
  onPages?: (pages: number) => void;
}

const paginationKey = new PluginKey("pagination");

// Renders exactly what print's @page margin box shows: the resolved text,
// horizontally centered, vertically centered in the margin area. No extra
// auto page number — print shows one only when the footer contains {{page}}.
function bandHtml(
  kind: "header" | "footer",
  text: string,
  page: number,
  pages: number,
): string {
  const resolved = resolvePageTokens(text, page, pages);
  return `<div class="docs-pb-${kind}">
      <span class="docs-pb-text">${escapeHtml(resolved)}</span>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Pagination = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return {
      geometry: () =>
        ({
          width: 794,
          height: 1122.52,
          autoHeight: false,
          marginTop: 75.59,
          marginRight: 75.59,
          marginBottom: 75.59,
          marginLeft: 75.59,
          contentHeight: 971.34,
          header: "",
          footer: "",
        }) as PageGeometry,
      gap: 28,
      onPages: undefined,
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;

    return [
      new Plugin({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(paginationKey);
            if (meta) return meta as DecorationSet;
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return paginationKey.getState(state);
          },
        },
        view(view) {
          let raf = 0;
          let lastSig = "";

          // Interior break: close page N (filler + footer), gap, open page N+1 (header).
          const makeBreak = (
            g: PageGeometry,
            restHeight: number,
            page: number,
            pages: number,
          ): HTMLElement => {
            const el = document.createElement("div");
            el.className = "docs-page-spacer";
            el.contentEditable = "false";
            el.setAttribute("data-it-spacer", "");
            el.style.setProperty("--pb-mx-l", `${g.marginLeft}px`);
            el.style.setProperty("--pb-mx-r", `${g.marginRight}px`);
            el.innerHTML = `
              <div class="docs-pb-fill" style="height:${restHeight}px"></div>
              <div class="docs-pb-margin docs-pb-margin-bottom" style="height:${g.marginBottom}px">
                ${bandHtml("footer", g.footer, page, pages)}
              </div>
              <div class="docs-pb-gap" style="height:${opts.gap}px"></div>
              <div class="docs-pb-margin docs-pb-margin-top" style="height:${g.marginTop}px">
                ${bandHtml("header", g.header, page + 1, pages)}
              </div>`;
            return el;
          };

          // Terminal spacer: close the LAST page so it is exactly page-height and
          // shows its footer like every other page.
          const makeTail = (
            g: PageGeometry,
            restHeight: number,
            page: number,
            pages: number,
          ): HTMLElement => {
            const el = document.createElement("div");
            el.className = "docs-page-spacer docs-page-tail";
            el.contentEditable = "false";
            el.setAttribute("data-it-spacer", "");
            el.style.setProperty("--pb-mx-l", `${g.marginLeft}px`);
            el.style.setProperty("--pb-mx-r", `${g.marginRight}px`);
            el.innerHTML = `
              <div class="docs-pb-fill" style="height:${restHeight}px"></div>
              <div class="docs-pb-margin docs-pb-margin-bottom" style="height:${g.marginBottom}px">
                ${bandHtml("footer", g.footer, page, pages)}
              </div>`;
            return el;
          };

          const recompute = () => {
            const g = opts.geometry();
            const dom = view.dom as HTMLElement;
            const doc = view.state.doc;

            // Continuous mode (e.g. `80mm auto` receipts): no pagination at all.
            if (g.autoHeight) {
              if (lastSig !== "auto") {
                lastSig = "auto";
                view.dispatch(
                  view.state.tr.setMeta(paginationKey, DecorationSet.empty),
                );
                opts.onPages?.(1);
              }
              return;
            }

            // Pass 1 — measure where the breaks fall, using RECT positions so
            // CSS margin collapsing is accounted for exactly (summing heights +
            // margins overestimates and drifts off the print engine's breaks).
            // Spacer heights above each block are subtracted to recover each
            // block's "natural" position — stable across re-layouts.
            const domTop = dom.getBoundingClientRect().top;
            const all = Array.from(dom.children) as HTMLElement[];
            const blocks: { natTop: number; natBottom: number }[] = [];
            let spacerAbove = 0;
            for (const c of all) {
              if (c.hasAttribute?.("data-it-spacer")) {
                spacerAbove += c.offsetHeight;
                continue;
              }
              const r = c.getBoundingClientRect();
              blocks.push({
                natTop: r.top - domTop - spacerAbove,
                natBottom: r.bottom - domTop - spacerAbove,
              });
            }

            const breaks: { pos: number; rest: number }[] = [];
            let pos = 0;
            let pageStart = blocks.length ? blocks[0].natTop : 0;
            let lastBottom = pageStart;
            for (let i = 0; i < blocks.length && i < doc.childCount; i++) {
              const b = blocks[i];
              const nodeSize = doc.child(i).nodeSize;
              if (
                b.natTop > pageStart && // never break before the page's first block
                b.natBottom - pageStart > g.contentHeight
              ) {
                breaks.push({
                  pos,
                  rest: Math.max(0, g.contentHeight - (b.natTop - pageStart)),
                });
                pageStart = b.natTop;
              }
              lastBottom = b.natBottom;
              pos += nodeSize;
            }
            const pages = breaks.length + 1;
            const lastRest = Math.max(
              0,
              g.contentHeight - (lastBottom - pageStart),
            );

            const sig =
              breaks.map((b) => `${b.pos}:${Math.round(b.rest)}`).join(",") +
              `|${Math.round(lastRest)}|${pages}|${g.header}|${g.footer}|${Math.round(g.contentHeight)}`;
            if (sig === lastSig) return;
            lastSig = sig;

            // Pass 2 — build decorations with the final page count (so {{pages}}
            // and per-page numbers are correct).
            const decos: Decoration[] = breaks.map((b, idx) =>
              Decoration.widget(
                b.pos,
                () => makeBreak(g, b.rest, idx + 1, pages),
                { side: -1, key: `pb-${idx + 1}-${Math.round(b.rest)}` },
              ),
            );
            decos.push(
              Decoration.widget(
                doc.content.size,
                () => makeTail(g, lastRest, pages, pages),
                { side: 1, key: `pb-tail-${pages}-${Math.round(lastRest)}` },
              ),
            );

            const set = DecorationSet.create(view.state.doc, decos);
            view.dispatch(view.state.tr.setMeta(paginationKey, set));
            opts.onPages?.(pages);
          };

          const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(recompute);
          };

          schedule();
          return {
            update: schedule,
            destroy: () => cancelAnimationFrame(raf),
          };
        },
      }),
    ];
  },
});
