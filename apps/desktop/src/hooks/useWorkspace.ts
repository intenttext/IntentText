import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export interface ItFileEntry {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  isFrozen: boolean;
  hasErrors: boolean;
  isUnsaved: boolean;
  depth: number;
  size: number;
  modified: number;
  title?: string;
  domain?: string;
  children?: ItFileEntry[];
}

interface WorkspaceFile {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  depth: number;
  size: number;
  modified: number;
}

interface WorkspaceInfo {
  name: string;
  path: string;
  files: WorkspaceFile[];
}

interface IndexEntry {
  name: string;
  path: string;
  title?: string;
  domain?: string;
  is_frozen: boolean;
  keywords: string[];
  deadlines: DeadlineEntry[];
}

export interface DeadlineEntry {
  file: string;
  relative_path: string;
  line: number;
  date: string;
  label: string;
}

interface ItIndex {
  folder: string;
  files: IndexEntry[];
}

export interface WorkspaceState {
  folderPath: string | null;
  folderName: string | null;
  files: ItFileEntry[];
  activeFilePath: string | null;
  content: string;
  setContent: (content: string) => void;
  filename: string;
  setFilename: (name: string) => void;
  isUnsaved: boolean;
  markSaved: () => void;
  fileHandle: null;
  setFileHandle: (h: null) => void;
  deadlines: DeadlineEntry[];
  indexCache: ItIndex | null;
  recentFiles: string[];
}

export interface WorkspaceActions {
  openFolder: () => Promise<void>;
  openFileByPath: (path: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  rebuildIndex: () => Promise<void>;
}

interface VaultInfo {
  path: string;
  collection_count: number;
  document_count: number;
  updated_at: string;
  is_new: boolean;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem("it-desktop-recent");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(files: string[]) {
  localStorage.setItem("it-desktop-recent", JSON.stringify(files.slice(0, 20)));
}

export function addRecentFile(path: string) {
  const recent = loadRecent().filter((f) => f !== path);
  recent.unshift(path);
  saveRecent(recent);
}

function buildTree(
  flat: WorkspaceFile[],
  indexMap: Map<string, IndexEntry>,
): ItFileEntry[] {
  return flat.map((f) => {
    const idx = indexMap.get(f.path);
    return {
      name: f.name,
      path: f.path,
      relativePath: f.relative_path,
      isDir: f.is_dir,
      isFrozen: idx?.is_frozen ?? false,
      hasErrors: false,
      isUnsaved: false,
      depth: f.depth,
      size: f.size,
      modified: f.modified,
      title: idx?.title,
      domain: idx?.domain,
    };
  });
}

export function useWorkspace(): [WorkspaceState, WorkspaceActions] {
  const [content, setContentRaw] = useState("");
  const [filename, setFilename] = useState("untitled.it");
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [files, setFiles] = useState<ItFileEntry[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [deadlines, setDeadlines] = useState<DeadlineEntry[]>([]);
  const [indexCache, setIndexCache] = useState<ItIndex | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecent);
  const savedContentRef = useRef("");

  const setContent = useCallback((text: string) => {
    setContentRaw(text);
    setIsUnsaved(text !== savedContentRef.current);
  }, []);

  const markSaved = useCallback(() => {
    setIsUnsaved(false);
    setContentRaw((c) => {
      savedContentRef.current = c;
      return c;
    });
  }, []);

  const rebuildIndex = useCallback(async () => {
    if (!folderPath) return;
    try {
      const idx = await invoke<ItIndex>("build_index_recursive", {
        root: folderPath,
      });
      setIndexCache(idx);

      // Collect all deadlines
      const allDeadlines: DeadlineEntry[] = [];
      for (const file of idx.files) {
        allDeadlines.push(...file.deadlines);
      }
      setDeadlines(allDeadlines);

      // Update frozen status on file entries
      const indexMap = new Map(idx.files.map((f) => [f.path, f]));
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          isFrozen: indexMap.get(f.path)?.is_frozen ?? false,
        })),
      );
    } catch (err) {
      console.error("Failed to build index:", err);
    }
  }, [folderPath]);

  const refreshFiles = useCallback(async () => {
    if (!folderPath) return;
    try {
      const info = await invoke<WorkspaceInfo>("open_folder", {
        path: folderPath,
      });
      const indexMap = new Map(
        (indexCache?.files ?? []).map((f) => [f.path, f]),
      );
      setFiles(buildTree(info.files, indexMap));
    } catch (err) {
      console.error("Failed to refresh files:", err);
    }
  }, [folderPath, indexCache]);

  const openFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    const path = typeof selected === "string" ? selected : selected;
    const info = await invoke<WorkspaceInfo>("open_folder", { path });

    setFolderPath(path);
    setFolderName(info.name);

    try {
      await invoke<VaultInfo>("register_vault_cmd", { path });
    } catch (err) {
      console.error("Failed to register vault:", err);
    }

    // Build index first, then apply to files
    let indexMap = new Map<string, IndexEntry>();
    try {
      const idx = await invoke<ItIndex>("build_index_recursive", {
        root: path,
      });
      setIndexCache(idx);
      indexMap = new Map(idx.files.map((f) => [f.path, f]));

      const allDeadlines: DeadlineEntry[] = [];
      for (const file of idx.files) {
        allDeadlines.push(...file.deadlines);
      }
      setDeadlines(allDeadlines);
    } catch {
      // Index build failed — continue without it
    }

    setFiles(buildTree(info.files, indexMap));

    // Start watching
    try {
      await invoke("watch_folder", { path });
    } catch (err) {
      console.error("Failed to start watcher:", err);
    }
  }, []);

  useEffect(() => {
    const restoreVault = async () => {
      try {
        const info = await invoke<VaultInfo | null>("app_startup");
        if (!info?.path) return;

        const folderInfo = await invoke<WorkspaceInfo>("open_folder", {
          path: info.path,
        });

        setFolderPath(info.path);
        setFolderName(folderInfo.name);

        try {
          const idx = await invoke<ItIndex>("build_index_recursive", {
            root: info.path,
          });
          setIndexCache(idx);
          const indexMap = new Map(idx.files.map((f) => [f.path, f]));
          setFiles(buildTree(folderInfo.files, indexMap));

          const allDeadlines: DeadlineEntry[] = [];
          for (const file of idx.files) {
            allDeadlines.push(...file.deadlines);
          }
          setDeadlines(allDeadlines);
        } catch {
          setFiles(buildTree(folderInfo.files, new Map()));
        }

        await invoke("watch_folder", { path: info.path });
      } catch (err) {
        console.error("Failed to restore vault:", err);
      }
    };

    restoreVault();
  }, []);

  const openFileByPath = useCallback(
    async (path: string) => {
      // Prompt save if unsaved
      if (isUnsaved) {
        const ok = confirm("You have unsaved changes. Continue?");
        if (!ok) return;
      }

      try {
        const text = await invoke<string>("read_file", { path });
        setContentRaw(text);
        savedContentRef.current = text;
        setIsUnsaved(false);

        const name = path.split("/").pop() ?? path.split("\\").pop() ?? path;
        setFilename(name);
        setActiveFilePath(path);

        addRecentFile(path);
        setRecentFiles(loadRecent());
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [isUnsaved],
  );

  // Listen for file system events
  useEffect(() => {
    const unlisteners: Promise<() => void>[] = [];

    unlisteners.push(
      listen("file-created", () => {
        refreshFiles();
        rebuildIndex();
      }),
    );
    unlisteners.push(
      listen("file-modified", (event: { payload: { paths: string[] } }) => {
        // Don't refresh if the modified file is the current one (we have latest)
        const modifiedPaths = event.payload.paths;
        if (activeFilePath && modifiedPaths.includes(activeFilePath)) {
          // External modification — could prompt user
        }
        refreshFiles();
        rebuildIndex();
      }),
    );
    unlisteners.push(
      listen("file-deleted", () => {
        refreshFiles();
        rebuildIndex();
      }),
    );

    // Handle file association — file opened from Finder
    unlisteners.push(
      listen<string>("open-file", (event) => {
        openFileByPath(event.payload);
      }),
    );

    return () => {
      unlisteners.forEach((p) => p.then((f) => f()));
    };
  }, [refreshFiles, rebuildIndex, activeFilePath, openFileByPath]);

  const state: WorkspaceState = {
    folderPath,
    folderName,
    files,
    activeFilePath,
    content,
    setContent,
    filename,
    setFilename,
    isUnsaved,
    markSaved,
    fileHandle: null,
    setFileHandle: () => {},
    deadlines,
    indexCache,
    recentFiles,
  };

  const actions: WorkspaceActions = {
    openFolder,
    openFileByPath,
    refreshFiles,
    rebuildIndex,
  };

  return [state, actions];
}
