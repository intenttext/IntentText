import { useState, useCallback, useRef } from "react";

export interface ItFileEntry {
  name: string;
  path: string;
  handle?: FileSystemFileHandle;
  isFrozen: boolean;
  hasErrors: boolean;
  isUnsaved: boolean;
  lastModified: Date;
  title?: string;
  domain?: string;
}

export interface WorkspaceState {
  folderHandle: FileSystemDirectoryHandle | null;
  folderName: string | null;
  folderPath: string | null;
  files: ItFileEntry[];
  activeFile: ItFileEntry | null;
  activeContent: string;
  indexCache: Record<string, unknown> | null;
  recentFiles: string[];
  activeTheme: string;
  // Convenience accessors
  content: string;
  setContent: (content: string) => void;
  filename: string;
  setFilename: (name: string) => void;
  isUnsaved: boolean;
  markSaved: () => void;
  fileHandle: FileSystemFileHandle | null;
  setFileHandle: (h: FileSystemFileHandle | null) => void;
}

export interface WorkspaceActions {
  openFolder: (handle: FileSystemDirectoryHandle) => Promise<void>;
  openFile: (entry: ItFileEntry) => Promise<void>;
  saveFile: () => Promise<void>;
  newFile: () => void;
  setContent: (content: string) => void;
  setTheme: (theme: string) => void;
  refreshFiles: () => Promise<void>;
  loadIndex: () => Promise<void>;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem("it-editor-recent");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(files: string[]) {
  localStorage.setItem("it-editor-recent", JSON.stringify(files.slice(0, 10)));
}

export function useWorkspace(): WorkspaceState {
  const [content, setContentRaw] = useState("");
  const [filename, setFilename] = useState("untitled.it");
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
  const savedContentRef = useRef("");

  const setContent = useCallback((text: string) => {
    setContentRaw(text);
    setIsUnsaved(text !== savedContentRef.current);
  }, []);

  const markSaved = useCallback(() => {
    setIsUnsaved(false);
    savedContentRef.current = content;
  }, [content]);

  return {
    // Workspace foundation (null in web mode)
    folderHandle: null,
    folderName: null,
    folderPath: null,
    files: [],
    activeFile: null,
    activeContent: content,
    indexCache: null,
    recentFiles: loadRecent(),
    activeTheme: localStorage.getItem("it-editor-theme") || "corporate",

    // Convenience
    content,
    setContent,
    filename,
    setFilename,
    isUnsaved,
    markSaved,
    fileHandle,
    setFileHandle,
  };
}

// Track recent files
export function addRecentFile(path: string) {
  const recent = loadRecent().filter((f) => f !== path);
  recent.unshift(path);
  saveRecent(recent);
}
