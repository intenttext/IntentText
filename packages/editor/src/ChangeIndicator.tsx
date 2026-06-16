// ChangeIndicator — ambient "unsaved changes" awareness for the editor.
//
// Clean & professional: invisible when there are no changes; a subtle dot + edit
// count + undo/redo when there are; and a Review panel (a real redline of exactly
// what changed, reusing core's compareVersions + the <Redline> renderer) on demand.
// So a signer always knows precisely what they're about to save or seal.

import { useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { diffDocuments, parseIntentText, compareVersions } from "@dotit/core";
import { Redline } from "./Redline";

export interface ChangeIndicatorProps {
  /** The source as opened / last saved — the diff baseline. */
  original: string;
  /** The current source. */
  current: string;
  /** The TipTap editor, for undo/redo. */
  editor: Editor | null;
  /** Theme for the Review panel's rendered redline. */
  theme?: string;
}

export function ChangeIndicator({
  original,
  current,
  editor,
  theme,
}: ChangeIndicatorProps) {
  const [reviewing, setReviewing] = useState(false);
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

  // Nothing changed → render nothing (the canvas stays pristine).
  if (!dirty) {
    if (reviewing) setReviewing(false);
    return null;
  }

  const canUndo = !!editor && editor.can().undo();
  const canRedo = !!editor && editor.can().redo();

  return (
    <div className="it-change-bar" role="status" aria-live="polite">
      <span className="it-change-dot" aria-hidden="true">
        ●
      </span>
      <span className="it-change-count">
        {count > 0 ? `${count} unsaved ${count === 1 ? "change" : "changes"}` : "unsaved changes"}
      </span>
      <span className="it-change-actions">
        <button
          type="button"
          className="it-change-btn"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!canUndo}
          title="Undo (⌘Z)"
        >
          ⤺ Undo
        </button>
        <button
          type="button"
          className="it-change-btn"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!canRedo}
          title="Redo (⌘⇧Z)"
        >
          ⤻ Redo
        </button>
        <button
          type="button"
          className="it-change-btn it-change-review-btn"
          onClick={() => setReviewing((v) => !v)}
          aria-expanded={reviewing}
        >
          {reviewing ? "Hide changes" : "Review changes"}
        </button>
      </span>

      {reviewing && (
        <div
          className="it-change-review-panel"
          role="dialog"
          aria-label="Review changes"
        >
          <div className="it-change-review-head">
            <strong>Review changes</strong>
            <button
              type="button"
              className="it-change-btn"
              onClick={() => setReviewing(false)}
              aria-label="Close review"
            >
              ✕
            </button>
          </div>
          <div className="it-change-review-body">
            <Redline value={compareVersions(original, current)} readOnly theme={theme} />
          </div>
        </div>
      )}
    </div>
  );
}
