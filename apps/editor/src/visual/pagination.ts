// Native page pagination for the visual editor.
//
// Instead of masking/clipping content (which HID rows that fell in a page break),
// this inserts a real spacer at each page boundary via ProseMirror widget
// decorations. The spacer occupies the footer + gap + header space and pushes the
// following content onto the next page — content is never hidden, the caret stays in
// document order, and there is no margin-shifting hack.
//
// Page breaks are computed from the natural heights of the top-level blocks, which
// are independent of the spacers themselves, so the computation is stable (idempotent)
// and does not loop.

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface PaginationOptions {
  pageHeight: number; // full page height (px)
  marginTop: number; // header space (px)
  marginBottom: number; // footer space (px)
  gap: number; // grey gap between pages (px)
  header: () => string;
  footer: () => string;
}

const paginationKey = new PluginKey("pagination");

function blockOuterHeight(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return (
    el.offsetHeight +
    parseFloat(cs.marginTop || "0") +
    parseFloat(cs.marginBottom || "0")
  );
}

export const Pagination = Extension.create<PaginationOptions>({
  name: "pagination",

  addOptions() {
    return {
      pageHeight: 1123,
      marginTop: 96,
      marginBottom: 96,
      gap: 24,
      header: () => "",
      footer: () => "",
    };
  },

  addProseMirrorPlugins() {
    const opts = this.options;
    const contentHeight = opts.pageHeight - opts.marginTop - opts.marginBottom;
    const deadZone = opts.marginBottom + opts.gap + opts.marginTop;

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

          const makeSpacer = (
            restHeight: number,
            pageNum: number,
          ): HTMLElement => {
            const el = document.createElement("div");
            el.className = "docs-page-spacer";
            el.contentEditable = "false";
            el.setAttribute("data-it-spacer", "");
            el.style.height = `${restHeight + deadZone}px`;
            el.innerHTML = `
              <div class="docs-pb-rest" style="height:${restHeight + opts.marginBottom}px">
                <div class="docs-pb-footer">
                  <span class="docs-pb-text">${opts.footer()}</span>
                  <span class="docs-pb-num">${pageNum}</span>
                </div>
              </div>
              <div class="docs-pb-gap" style="height:${opts.gap}px"></div>
              <div class="docs-pb-header" style="height:${opts.marginTop}px">
                <span class="docs-pb-text">${opts.header()}</span>
              </div>`;
            return el;
          };

          const recompute = () => {
            const dom = view.dom as HTMLElement;
            const children = Array.from(dom.children).filter(
              (c) => !(c as HTMLElement).hasAttribute?.("data-it-spacer"),
            ) as HTMLElement[];
            const doc = view.state.doc;
            const decos: Decoration[] = [];
            const breaks: number[] = [];

            let pos = 0;
            let used = 0;
            let pageNum = 1;
            for (let i = 0; i < children.length && i < doc.childCount; i++) {
              const h = blockOuterHeight(children[i]);
              const nodeSize = doc.child(i).nodeSize;
              if (used > 0 && used + h > contentHeight) {
                const rest = Math.max(0, contentHeight - used);
                const spacerPos = pos;
                const pn = pageNum; // capture value (footer shows the page ending here)
                breaks.push(spacerPos);
                decos.push(
                  Decoration.widget(spacerPos, () => makeSpacer(rest, pn), {
                    side: -1,
                    key: `pb-${pn}`,
                  }),
                );
                pageNum += 1;
                used = 0;
              }
              used += h;
              pos += nodeSize;
            }

            const sig = breaks.join(",");
            if (sig === lastSig) return;
            lastSig = sig;
            const set = DecorationSet.create(view.state.doc, decos);
            view.dispatch(view.state.tr.setMeta(paginationKey, set));
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
