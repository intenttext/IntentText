import { useEffect, useRef, useState } from "react";

const AUTOSAVE_KEY = "it-editor-autosave";
const AUTOSAVE_NAME_KEY = "it-editor-autosave-name";
const DEBOUNCE = 700; // save shortly after you stop typing (Google-Docs feel)

export type SaveState = "saving" | "saved";

export interface Draft {
  content: string;
  filename: string | null;
}

/**
 * Read the last autosaved draft (null when none). The app silently restores it
 * on launch when the editor would otherwise open the default/empty document —
 * no "Restore unsaved work?" prompt. Opening a file or a ?source= link always
 * wins over the draft.
 *
 * WEB-APP ONLY: this localStorage autosave is a convenience of the web editor.
 * It lives in apps/editor (NOT @dotit/editor or @dotit/core), so the desktop app
 * and embedded hosts do NOT inherit it — their persistence belongs to the host
 * (the OS file / the ERP), not the editor component.
 */
export function readDraft(): Draft | null {
  try {
    const content = localStorage.getItem(AUTOSAVE_KEY);
    if (!content || !content.trim()) return null;
    return { content, filename: localStorage.getItem(AUTOSAVE_NAME_KEY) };
  } catch {
    return null;
  }
}

/**
 * Debounced autosave to localStorage (like Google Docs autosaving to Drive):
 * snapshots ~700ms after the last edit and reports a live save state so the UI
 * can show "Saving… / Saved". Downloading to a file is the separate, explicit
 * "save a copy to your device" action.
 */
export function useAutoSave(content: string, filename: string): SaveState {
  const [state, setState] = useState<SaveState>("saved");
  const first = useRef(true);
  useEffect(() => {
    // Don't flash "Saving…" for the initial load / restored draft.
    if (first.current) {
      first.current = false;
      return;
    }
    setState("saving");
    const timer = setTimeout(() => {
      try {
        if (content.trim().length > 0) {
          localStorage.setItem(AUTOSAVE_KEY, content);
          localStorage.setItem(AUTOSAVE_NAME_KEY, filename);
        }
      } catch {
        /* storage full/unavailable — autosave is best-effort */
      }
      setState("saved");
    }, DEBOUNCE);
    return () => clearTimeout(timer);
  }, [content, filename]);
  return state;
}
