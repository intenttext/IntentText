// ChangeIndicator — a small "unsaved changes" chip, not a bar.
//
// Invisible when the document is byte-identical to the version that was opened
// (so typing then deleting back to the same text clears it). When there ARE real
// changes it shows a compact chip: a count, undo / redo, and "Reset to original".

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { diffDocuments, parseIntentText } from "@dotit/core";

export interface ChangeIndicatorProps {
  /** The source as opened / last saved — the diff baseline. */
  original: string;
  /** The current source. */
  current: string;
  /** The TipTap editor, for undo/redo. */
  editor: Editor | null;
  /** Restore the document to `original` (Reset to original). */
  onReset?: () => void;
}

export function ChangeIndicator({
  original,
  current,
  editor,
  onReset,
}: ChangeIndicatorProps) {
  // Byte-exact: identical text → no changes, even if the user typed and undid it.
  const dirty = current !== original;

  const count = useMemo(() => {
    if (!dirty) return 0;
    try {
      const d = diffDocuments(parseIntentText(original), parseIntentText(current));
      return d.added.length + d.removed.length + d.modified.length;
    } catch {
      return 0;
    }
  }, [original, current, dirty]);

  // Clean → render nothing (the chip only appears when there are real changes).
  if (!dirty) return null;

  const canUndo = !!editor && editor.can().undo();
  const canRedo = !!editor && editor.can().redo();

  return (
    <span className="it-change-chip" role="status" aria-live="polite">
      <span className="it-change-dot" aria-hidden="true">
        ●
      </span>
      <span className="it-change-count">
        {count > 0 ? `${count} ${count === 1 ? "change" : "changes"}` : "edited"}
      </span>
      <button
        type="button"
        className="it-change-btn"
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        aria-label="Undo"
      >
        ⤺
      </button>
      <button
        type="button"
        className="it-change-btn"
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
      >
        ⤻
      </button>
      <button
        type="button"
        className="it-change-btn it-change-reset"
        onClick={onReset}
        disabled={!onReset}
        title="Discard all changes and restore the opened version"
      >
        Reset
      </button>
    </span>
  );
}
