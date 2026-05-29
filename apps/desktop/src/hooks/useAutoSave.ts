import { useEffect, useRef, useState, useCallback } from "react";

const AUTOSAVE_KEY = "it-editor-autosave";
const AUTOSAVE_INTERVAL = 30_000; // 30 seconds

export function useAutoSave(
  content: string,
  setContent: (c: string) => void
) {
  const [hasRestore, setHasRestore] = useState(false);
  const savedRef = useRef<string | null>(null);

  // Check for autosave on mount
  useEffect(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved && saved.trim().length > 0) {
      savedRef.current = saved;
      setHasRestore(true);
    }
  }, []);

  // Auto-save timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (content.trim().length > 0) {
        localStorage.setItem(AUTOSAVE_KEY, content);
      }
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [content]);

  const restore = useCallback(() => {
    if (savedRef.current) {
      setContent(savedRef.current);
    }
    setHasRestore(false);
  }, [setContent]);

  const dismiss = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setHasRestore(false);
  }, []);

  return { hasRestore, restore, dismiss };
}
