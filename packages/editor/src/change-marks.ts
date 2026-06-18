// change-marks — per-row "this line changed" markers.
//
// A read-only ProseMirror decoration: every top-level block that differs from the
// baseline (the version that was opened / last saved) gets an `it-row-changed`
// node decoration; CSS draws a small dot in the margin. It NEVER mutates the
// document — it only decorates — so it can't affect the bytes or the seal.
//
// Set/refresh the baseline by dispatching the "setBaseline" meta on this plugin's
// key (the host does this when a document is opened or saved).

import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const changeMarksKey = new PluginKey("itChangeMarks");

interface ChangeMarksState {
  /** JSON of each baseline top-level node, by index. null = no baseline yet. */
  baseline: string[] | null;
  /** Top-level blocks that currently differ from the baseline. */
  changed: Set<number>;
}

/** Recompute which top-level blocks differ from the baseline (doc-level, so undoing
 *  back to the opened doc yields zero — the source round-trip can't drift it). */
function computeChanged(
  doc: { forEach: (f: (n: { toJSON: () => unknown }, p: number, i: number) => void) => void },
  baseline: string[] | null,
): Set<number> {
  const changed = new Set<number>();
  if (!baseline) return changed;
  doc.forEach((node, _pos, index) => {
    if (JSON.stringify(node.toJSON()) !== baseline[index]) changed.add(index);
  });
  return changed;
}

export const ChangeMarks = Extension.create({
  name: "itChangeMarks",
  addProseMirrorPlugins() {
    return [
      new Plugin<ChangeMarksState>({
        key: changeMarksKey,
        state: {
          init: () => ({ baseline: null, changed: new Set() }),
          apply(tr, value) {
            if (tr.getMeta(changeMarksKey) === "setBaseline") {
              const baseline: string[] = [];
              tr.doc.forEach((n) => baseline.push(JSON.stringify(n.toJSON())));
              return { baseline, changed: new Set<number>() };
            }
            if (!value.baseline) return value;
            if (!tr.docChanged) return value;
            return { baseline: value.baseline, changed: computeChanged(tr.doc, value.baseline) };
          },
        },
        props: {
          decorations(state) {
            const s = changeMarksKey.getState(state);
            if (!s?.changed.size) return null;
            const decos: Decoration[] = [];
            state.doc.forEach((node, pos, index) => {
              if (s.changed.has(index)) {
                decos.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "it-row-changed",
                  }),
                );
              }
            });
            return decos.length ? DecorationSet.create(state.doc, decos) : null;
          },
        },
      }),
    ];
  },
});

/** Number of top-level blocks currently changed from the baseline (0 = clean). */
export function changeCount(editor: Editor): number {
  return changeMarksKey.getState(editor.state)?.changed.size ?? 0;
}

/** Capture the current document as the clean baseline (call on open / save). */
export function setChangeBaseline(editor: Editor): void {
  try {
    editor.view.dispatch(editor.state.tr.setMeta(changeMarksKey, "setBaseline"));
  } catch {
    /* editor not ready */
  }
}
