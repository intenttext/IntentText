import { useCallback } from "react";
import type { WorkspaceState } from "./useWorkspace";
import { addRecentFile } from "./useWorkspace";

// Extend Window for File System Access API
declare global {
  interface Window {
    showOpenFilePicker?: (opts?: {
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (opts?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
  }
}

const IT_FILE_TYPE = {
  description: "Dotit files",
  accept: { "text/plain": [".it"] },
};

export function useFile(workspace: WorkspaceState) {
  const {
    content,
    setContent,
    filename,
    setFilename,
    markSaved,
    fileHandle,
    setFileHandle,
    isUnsaved,
  } = workspace;

  const openFile = useCallback(async () => {
    // File System Access API
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [IT_FILE_TYPE],
        });
        const file = await handle.getFile();
        const text = await file.text();
        setContent(text);
        setFilename(file.name);
        setFileHandle(handle);
        markSaved();
        addRecentFile(file.name);
        return;
      } catch {
        // User cancelled
        return;
      }
    }

    // Fallback: hidden input
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".it";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      setContent(text);
      setFilename(file.name);
      setFileHandle(null);
      markSaved();
      addRecentFile(file.name);
    };
    input.click();
  }, [setContent, setFilename, setFileHandle, markSaved]);

  const saveFile = useCallback(async () => {
    // Save in place with existing handle
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        markSaved();
        return;
      } catch {
        // Fall through to save-as
      }
    }

    // File System Access API save-as
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [IT_FILE_TYPE],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        setFileHandle(handle);
        setFilename(handle.name);
        markSaved();
        return;
      } catch {
        return; // User cancelled
      }
    }

    // Fallback: download
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markSaved();
  }, [content, filename, fileHandle, setFileHandle, setFilename, markSaved]);

  const newFile = useCallback(
    (welcome: string) => {
      if (isUnsaved && !confirm("You have unsaved changes. Continue?")) return;
      setContent(welcome);
      setFilename("untitled.it");
      setFileHandle(null);
      markSaved();
    },
    [isUnsaved, setContent, setFilename, setFileHandle, markSaved],
  );

  return { openFile, saveFile, newFile };
}
