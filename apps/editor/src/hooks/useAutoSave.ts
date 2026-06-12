import { useEffect } from "react";

const AUTOSAVE_KEY = "it-editor-autosave";
const AUTOSAVE_NAME_KEY = "it-editor-autosave-name";
const AUTOSAVE_INTERVAL = 30_000; // 30 seconds

export interface Draft {
  content: string;
  filename: string | null;
}

/**
 * Read the last autosaved draft (null when none). The app silently restores it
 * on launch when the editor would otherwise open the default/empty document —
 * no "Restore unsaved work?" prompt. Opening a file or a ?source= link always
 * wins over the draft, so a deliberately reopened older file is never
 * clobbered.
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

/** Background autosave: snapshot content + filename every 30s. */
export function useAutoSave(content: string, filename: string) {
  useEffect(() => {
    const timer = setInterval(() => {
      if (content.trim().length > 0) {
        try {
          localStorage.setItem(AUTOSAVE_KEY, content);
          localStorage.setItem(AUTOSAVE_NAME_KEY, filename);
        } catch {
          /* storage full/unavailable — autosave is best-effort */
        }
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [content, filename]);
}
