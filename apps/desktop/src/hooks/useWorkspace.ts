// useWorkspace — the document library: a user-chosen workspace folder with a
// live tree of .it files, file operations (create/rename/delete) and recents.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  buildTree,
  deleteFile,
  flattenItFiles,
  isTauri,
  openFolderInfo,
  renameFile,
  watchFolder,
  writeFile,
} from "../lib/backend";
import type { TreeNode } from "../lib/backend";

const LAST_WORKSPACE_KEY = "dotit.workspace.last";
const RECENT_KEY = "dotit.files.recent";
const MAX_RECENT = 12;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export interface Workspace {
  path: string;
  name: string;
  tree: TreeNode[];
  /** Flat list of every .it file (for search + trust badges). */
  itFiles: TreeNode[];
}

export interface WorkspaceApi {
  workspace: Workspace | null;
  recentFiles: string[];
  /** Bumped whenever the tree is refreshed (watcher or file ops). */
  revision: number;
  chooseWorkspace: () => Promise<void>;
  openWorkspacePath: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  createFile: (name: string) => Promise<string | null>;
  renameEntry: (path: string, newName: string) => Promise<string | null>;
  deleteEntry: (path: string) => Promise<boolean>;
  noteRecent: (path: string) => void;
}

export function useWorkspace(): WorkspaceApi {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecent);
  const [revision, setRevision] = useState(0);
  const workspaceRef = useRef<Workspace | null>(null);
  workspaceRef.current = workspace;

  const openWorkspacePath = useCallback(async (path: string) => {
    const info = await openFolderInfo(path);
    const tree = buildTree(info.files);
    setWorkspace({
      path: info.path,
      name: info.name,
      tree,
      itFiles: flattenItFiles(tree),
    });
    setRevision((r) => r + 1);
    localStorage.setItem(LAST_WORKSPACE_KEY, info.path);
    try {
      await watchFolder(info.path);
    } catch (err) {
      console.warn("File watcher unavailable:", err);
    }
  }, []);

  const chooseWorkspace = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose Workspace Folder",
    });
    if (typeof selected === "string") await openWorkspacePath(selected);
  }, [openWorkspacePath]);

  const refresh = useCallback(async () => {
    const ws = workspaceRef.current;
    if (!ws) return;
    try {
      const info = await openFolderInfo(ws.path);
      const tree = buildTree(info.files);
      setWorkspace({
        path: info.path,
        name: info.name,
        tree,
        itFiles: flattenItFiles(tree),
      });
      setRevision((r) => r + 1);
    } catch (err) {
      console.error("Failed to refresh workspace:", err);
    }
  }, []);

  // Restore the last workspace on launch.
  useEffect(() => {
    if (!isTauri) return;
    const last = localStorage.getItem(LAST_WORKSPACE_KEY);
    if (last) {
      openWorkspacePath(last).catch(() => {
        localStorage.removeItem(LAST_WORKSPACE_KEY);
      });
    }
  }, [openWorkspacePath]);

  // Live-refresh the tree on filesystem events (debounced).
  useEffect(() => {
    if (!isTauri) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    const subs = ["file-created", "file-modified", "file-deleted"].map((ev) =>
      listen(ev, schedule),
    );
    return () => {
      clearTimeout(timer);
      subs.forEach((p) => p.then((un) => un()));
    };
  }, [refresh]);

  const noteRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(
        0,
        MAX_RECENT,
      );
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const createFile = useCallback(
    async (name: string): Promise<string | null> => {
      const ws = workspaceRef.current;
      if (!ws) return null;
      const clean = name.trim().replace(/\.it$/i, "");
      if (!clean) return null;
      const path = `${ws.path}/${clean}.it`;
      const starter = `title: ${clean}\nsummary: \n\nsection: Overview\nnote: New document.\n`;
      try {
        await writeFile(path, starter);
        await refresh();
        return path;
      } catch (err) {
        console.error("Failed to create file:", err);
        return null;
      }
    },
    [refresh],
  );

  const renameEntry = useCallback(
    async (path: string, newName: string): Promise<string | null> => {
      const clean = newName.trim();
      if (!clean) return null;
      const dir = path.slice(0, Math.max(path.lastIndexOf("/"), 0));
      const finalName =
        path.endsWith(".it") && !clean.endsWith(".it") ? `${clean}.it` : clean;
      const to = `${dir}/${finalName}`;
      if (to === path) return path;
      try {
        await renameFile(path, to);
        await refresh();
        return to;
      } catch (err) {
        console.error("Failed to rename:", err);
        return null;
      }
    },
    [refresh],
  );

  const deleteEntry = useCallback(
    async (path: string): Promise<boolean> => {
      try {
        await deleteFile(path);
        setRecentFiles((prev) => {
          const next = prev.filter((p) => p !== path);
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          return next;
        });
        await refresh();
        return true;
      } catch (err) {
        console.error("Failed to delete:", err);
        return false;
      }
    },
    [refresh],
  );

  return useMemo(
    () => ({
      workspace,
      recentFiles,
      revision,
      chooseWorkspace,
      openWorkspacePath,
      refresh,
      createFile,
      renameEntry,
      deleteEntry,
      noteRecent,
    }),
    [
      workspace,
      recentFiles,
      revision,
      chooseWorkspace,
      openWorkspacePath,
      refresh,
      createFile,
      renameEntry,
      deleteEntry,
      noteRecent,
    ],
  );
}
