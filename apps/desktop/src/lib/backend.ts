// backend.ts — typed wrappers around the Tauri (Rust) commands.
//
// All filesystem access goes through the custom commands in
// src-tauri/src/commands (std-only Rust), so the app works on any
// user-chosen workspace folder without fs-plugin scope gymnastics.

import { invoke } from "@tauri-apps/api/core";

/** True when running inside the Tauri shell (false in plain `vite dev`). */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface WorkspaceFile {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  depth: number;
  size: number;
  modified: number;
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  files: WorkspaceFile[];
}

export function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

/** Write raw bytes to a file (DOCX export). Pass `Array.from(uint8array)`. */
export function writeBinaryFile(path: string, bytes: number[]): Promise<void> {
  return invoke("write_binary_file", { path, contents: bytes });
}

/** Read raw bytes from a file (DOCX import). Returns a byte array. */
export function readBinaryFile(path: string): Promise<number[]> {
  return invoke<number[]>("read_binary_file", { path });
}

/** Open a path with the OS default handler (a temp .html in the browser, for print). */
export function openExternal(path: string): Promise<void> {
  return invoke("open_external", { path });
}

/** Recursive listing of a workspace folder (.it files + directories). */
export function openFolderInfo(path: string): Promise<WorkspaceInfo> {
  return invoke<WorkspaceInfo>("open_folder", { path });
}

/** Moves the file to the OS trash. */
export function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export function renameFile(from: string, to: string): Promise<void> {
  return invoke("rename_file", { from, to });
}

export function watchFolder(path: string): Promise<void> {
  return invoke("watch_folder", { path });
}

/** Watch several vault roots at once (the multi-vault registry). */
export function watchFolders(paths: string[]): Promise<void> {
  return invoke("watch_folders", { paths });
}

export function unwatchFolder(path: string): Promise<void> {
  return invoke("unwatch_folder", { path });
}

// ---------------------------------------------------------------------------
// Durable app settings (persisted to disk by the Rust backend)
// ---------------------------------------------------------------------------

/** Loads the persisted settings object ({} when nothing saved yet). */
export function loadSettings<T = Record<string, unknown>>(): Promise<T> {
  return invoke<T>("load_settings");
}

/** Persists the full settings object to the OS app-config dir. */
export function saveSettings(settings: unknown): Promise<void> {
  return invoke("save_settings", { settings });
}

// ---------------------------------------------------------------------------
// Workspace tree model (built from the flat recursive listing)
// ---------------------------------------------------------------------------

export interface TreeNode {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  modified: number;
  children: TreeNode[];
}

export function buildTree(files: WorkspaceFile[]): TreeNode[] {
  const byRel = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // The Rust command returns entries sorted by depth, so parents come first.
  for (const f of files) {
    const node: TreeNode = {
      name: f.name,
      path: f.path,
      relativePath: f.relative_path,
      isDir: f.is_dir,
      size: f.size,
      modified: f.modified,
      children: [],
    };
    byRel.set(f.relative_path, node);
    const slash = f.relative_path.lastIndexOf("/");
    const parent = slash > 0 ? byRel.get(f.relative_path.slice(0, slash)) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        Number(b.isDir) - Number(a.isDir) ||
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    for (const n of nodes) if (n.children.length) sort(n.children);
  };
  sort(roots);
  return roots;
}

/** Flat list of every .it file in the tree (depth-first). */
export function flattenItFiles(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.isDir) walk(n.children);
      else if (n.name.endsWith(".it")) out.push(n);
    }
  };
  walk(nodes);
  return out;
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : path;
}
