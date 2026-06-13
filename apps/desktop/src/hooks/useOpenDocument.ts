// useOpenDocument — the currently open document: open/save/save-as, dirty
// tracking, and debounced autosave to disk.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ask, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { basename, readFile, writeFile } from "../lib/backend";

const AUTOSAVE_DELAY_MS = 1200;

export interface OpenDocument {
  /** Absolute path on disk; null for a new, never-saved document. */
  path: string | null;
  name: string;
  content: string;
  dirty: boolean;
  /** Epoch ms of the last successful write. */
  savedAt: number | null;
}

export interface OpenDocumentApi {
  doc: OpenDocument | null;
  openPath: (path: string) => Promise<void>;
  newDocument: () => Promise<void>;
  setContent: (content: string) => void;
  /** Replace content and persist immediately (used by trust operations). */
  applyAndSave: (content: string) => Promise<void>;
  save: () => Promise<boolean>;
  saveAs: () => Promise<boolean>;
  closeDocument: () => Promise<void>;
}

const STARTER = `title: Untitled Document
summary:

section: Overview
note: Start typing, or use the ribbon to format your document.
`;

export function useOpenDocument(opts: {
  defaultDir?: string | null;
  onSaved?: (path: string) => void;
}): OpenDocumentApi {
  const [doc, setDoc] = useState<OpenDocument | null>(null);
  const docRef = useRef<OpenDocument | null>(null);
  docRef.current = doc;
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const writeNow = useCallback(async (): Promise<boolean> => {
    const d = docRef.current;
    if (!d || !d.path) return false;
    try {
      await writeFile(d.path, d.content);
      setDoc((prev) =>
        prev && prev.path === d.path
          ? { ...prev, dirty: prev.content !== d.content, savedAt: Date.now() }
          : prev,
      );
      optsRef.current.onSaved?.(d.path);
      return true;
    } catch (err) {
      console.error("Failed to save:", err);
      return false;
    }
  }, []);

  const saveAs = useCallback(async (): Promise<boolean> => {
    const d = docRef.current;
    if (!d) return false;
    const target = await saveDialog({
      defaultPath: d.path ?? `${optsRef.current.defaultDir ?? ""}/${d.name}`,
      filters: [{ name: "IntentText", extensions: ["it"] }],
    });
    if (!target) return false;
    try {
      await writeFile(target, d.content);
      setDoc((prev) =>
        prev
          ? {
              ...prev,
              path: target,
              name: basename(target),
              dirty: false,
              savedAt: Date.now(),
            }
          : prev,
      );
      optsRef.current.onSaved?.(target);
      return true;
    } catch (err) {
      console.error("Failed to save as:", err);
      return false;
    }
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const d = docRef.current;
    if (!d) return false;
    if (d.path) return writeNow();
    return saveAs();
  }, [writeNow, saveAs]);

  /** Returns false when the user cancels switching away from unsaved work. */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    const d = docRef.current;
    if (!d || !d.dirty) return true;
    if (d.path) {
      // Files on disk are autosaved; flush any pending edit and move on.
      await writeNow();
      return true;
    }
    const discard = await ask(
      `"${d.name}" has unsaved changes. Discard them?`,
      { title: "Unsaved Changes", kind: "warning" },
    );
    return discard;
  }, [writeNow]);

  const openPath = useCallback(
    async (path: string) => {
      if (!(await confirmDiscard())) return;
      const content = await readFile(path);
      clearTimeout(autosaveTimer.current);
      setDoc({
        path,
        name: basename(path),
        content,
        dirty: false,
        savedAt: null,
      });
    },
    [confirmDiscard],
  );

  const newDocument = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    clearTimeout(autosaveTimer.current);
    setDoc({
      path: null,
      name: "untitled.it",
      content: STARTER,
      dirty: false,
      savedAt: null,
    });
  }, [confirmDiscard]);

  const closeDocument = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    clearTimeout(autosaveTimer.current);
    setDoc(null);
  }, [confirmDiscard]);

  const setContent = useCallback((content: string) => {
    setDoc((prev) =>
      prev && prev.content !== content ? { ...prev, content, dirty: true } : prev,
    );
  }, []);

  const applyAndSave = useCallback(async (content: string) => {
    const d = docRef.current;
    if (!d) return;
    if (!d.path) {
      setDoc((prev) => (prev ? { ...prev, content, dirty: true } : prev));
      return;
    }
    try {
      await writeFile(d.path, content);
      setDoc((prev) =>
        prev ? { ...prev, content, dirty: false, savedAt: Date.now() } : prev,
      );
      optsRef.current.onSaved?.(d.path);
    } catch (err) {
      console.error("Failed to save:", err);
      setDoc((prev) => (prev ? { ...prev, content, dirty: true } : prev));
    }
  }, []);

  // Debounced autosave for documents that exist on disk.
  useEffect(() => {
    if (!doc?.dirty || !doc.path) return;
    autosaveTimer.current = setTimeout(() => void writeNow(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(autosaveTimer.current);
  }, [doc?.content, doc?.dirty, doc?.path, writeNow]);

  return useMemo(
    () => ({
      doc,
      openPath,
      newDocument,
      setContent,
      applyAndSave,
      save,
      saveAs,
      closeDocument,
    }),
    [
      doc,
      openPath,
      newDocument,
      setContent,
      applyAndSave,
      save,
      saveAs,
      closeDocument,
    ],
  );
}
