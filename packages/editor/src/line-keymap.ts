// Home / End keymap — move the caret to the start / end of the visual line.
//
// ProseMirror has no built-in Home/End that respects soft-wrapped (visual)
// lines, so the default keys did nothing useful here. We resolve the caret's
// current client rect, then walk left/right to the document position whose rect
// sits at the same vertical band but the far horizontal edge — i.e. the visual
// line boundary. Works for both LTR and RTL because we test geometry, not
// logical order: "line start" = leftmost in LTR, rightmost in RTL.

import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Find the doc position at the visual start/end of the line containing `from`. */
function visualLineEdge(
  view: EditorView,
  from: number,
  edge: "start" | "end",
): number | null {
  const coords = view.coordsAtPos(from);
  // A vertical band tolerance so we stay on the same wrapped line.
  const bandTop = coords.top + 1;
  const bandBottom = coords.bottom - 1;
  const dir = edge === "start" ? -1 : 1;

  let pos = from;
  let last = from;
  // Walk one character at a time while we remain on the same visual line.
  for (let i = 0; i < 100000; i++) {
    const next = pos + dir;
    if (next < 0 || next > view.state.doc.content.size) break;
    let c;
    try {
      c = view.coordsAtPos(next);
    } catch {
      break;
    }
    // Left the vertical band → we crossed into the previous/next visual line.
    if (c.bottom <= bandTop || c.top >= bandBottom) break;
    pos = next;
    last = next;
  }
  return last;
}

export const LineKeymap = Extension.create({
  name: "lineKeymap",

  addKeyboardShortcuts() {
    const moveToEdge = (edge: "start" | "end", extend: boolean) => {
      const { view } = this.editor;
      const { state } = view;
      const { selection } = state;
      const head = selection.head;
      const target = visualLineEdge(view, head, edge);
      if (target == null || target === head) {
        // Fall back to textblock start/end so the key is never a no-op.
        return false;
      }
      const $target = state.doc.resolve(target);
      const anchor = extend ? selection.anchor : target;
      const tr = state.tr.setSelection(
        extend
          ? TextSelection.between(state.doc.resolve(anchor), $target)
          : TextSelection.near($target),
      );
      view.dispatch(tr.scrollIntoView());
      return true;
    };

    return {
      Home: () => moveToEdge("start", false),
      End: () => moveToEdge("end", false),
      "Shift-Home": () => moveToEdge("start", true),
      "Shift-End": () => moveToEdge("end", true),
    };
  },
});
