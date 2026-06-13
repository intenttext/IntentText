// useVaults — the multi-vault registry. A DEVONthink-style index of folders
// the user has registered. Each vault is a folder full of .it files (scattered
// across the machine: ~/Documents/contracts, ~/Dropbox/invoices, …). The
// registry is persisted to disk via the Rust settings store so it survives a
// webview cache wipe. Each vault loads its own tree lazily and the whole set of
// roots is watched for live updates.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  basename,
  buildTree,
  deleteFile,
  flattenItFiles,
  isTauri,
  loadSettings,
  openFolderInfo,
  renameFile,
  saveSettings,
  watchFolders,
  writeFile,
} from "../lib/backend";
import type { TreeNode } from "../lib/backend";

const RECENT_KEY = "dotit.files.recent";
const ACTIVE_KEY = "dotit.vault.active"; // last selected scope ("all" | path)
const MAX_RECENT = 12;

/** A registered folder. `label` defaults to the folder name but is editable. */
export interface VaultRegistration {
  path: string;
  label: string;
}

/** A registered vault with its loaded contents. */
export interface Vault extends VaultRegistration {
  /** Folder tree (null until first load / on load error). */
  tree: TreeNode[] | null;
  /** Flat list of every .it file in this vault. */
  itFiles: TreeNode[];
  loading: boolean;
  /** Set when the folder could not be read (e.g. moved/unmounted). */
  error: string | null;
}

/** "all" federates across every vault; otherwise a vault path scopes to it. */
export type VaultScope = "all" | string;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface PersistedSettings {
  vaults?: VaultRegistration[];
}

export interface VaultsApi {
  vaults: Vault[];
  /** Current scope: "all" (federated) or a specific vault path. */
  scope: VaultScope;
  setScope: (scope: VaultScope) => void;
  /** The vault matching the current scope, or null in "all" mode. */
  activeVault: Vault | null;
  /** Every .it file across every vault (for federated search/badges). */
  allFiles: TreeNode[];
  recentFiles: string[];
  /** Bumped whenever any vault tree is refreshed. */
  revision: number;
  ready: boolean;
  addFolder: () => Promise<void>;
  addFolderPath: (path: string, label?: string) => Promise<void>;
  removeVault: (path: string) => Promise<void>;
  renameVault: (path: string, label: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshVault: (path: string) => Promise<void>;
  /** Create a new .it file inside a vault; returns its path. */
  createFile: (vaultPath: string, name: string) => Promise<string | null>;
  renameEntry: (path: string, newName: string) => Promise<string | null>;
  deleteEntry: (path: string) => Promise<boolean>;
  noteRecent: (path: string) => void;
  /** Which vault label a given file path belongs to (for search results). */
  vaultLabelFor: (path: string) => string;
}

export function useVaults(): VaultsApi {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [scope, setScopeState] = useState<VaultScope>(
    () => localStorage.getItem(ACTIVE_KEY) ?? "all",
  );
  const [recentFiles, setRecentFiles] = useState<string[]>(loadRecent);
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const vaultsRef = useRef<Vault[]>([]);
  vaultsRef.current = vaults;

  const setScope = useCallback((next: VaultScope) => {
    setScopeState(next);
    localStorage.setItem(ACTIVE_KEY, next);
  }, []);

  // --- persistence: the registry (paths + labels) is durable on disk ---------
  const persist = useCallback((list: Vault[]) => {
    const registry: VaultRegistration[] = list.map((v) => ({
      path: v.path,
      label: v.label,
    }));
    saveSettings({ vaults: registry }).catch((err) =>
      console.warn("Failed to persist vault registry:", err),
    );
  }, []);

  /** Loads (or reloads) a single vault's tree into state. */
  const loadVault = useCallback(async (path: string) => {
    setVaults((prev) =>
      prev.map((v) =>
        v.path === path ? { ...v, loading: true, error: null } : v,
      ),
    );
    try {
      const info = await openFolderInfo(path);
      const tree = buildTree(info.files);
      setVaults((prev) =>
        prev.map((v) =>
          v.path === path
            ? {
                ...v,
                tree,
                itFiles: flattenItFiles(tree),
                loading: false,
                error: null,
              }
            : v,
        ),
      );
    } catch (err) {
      setVaults((prev) =>
        prev.map((v) =>
          v.path === path
            ? {
                ...v,
                tree: null,
                itFiles: [],
                loading: false,
                error: err instanceof Error ? err.message : String(err),
              }
            : v,
        ),
      );
    }
    setRevision((r) => r + 1);
  }, []);

  // --- restore the registry on launch ----------------------------------------
  useEffect(() => {
    if (!isTauri) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      let registry: VaultRegistration[] = [];
      try {
        const settings = await loadSettings<PersistedSettings>();
        registry = Array.isArray(settings.vaults) ? settings.vaults : [];
      } catch (err) {
        console.warn("Failed to load settings:", err);
      }
      if (cancelled) return;
      setVaults(
        registry.map((r) => ({
          path: r.path,
          label: r.label || basename(r.path),
          tree: null,
          itFiles: [],
          loading: true,
          error: null,
        })),
      );
      setReady(true);
      // Load each vault's contents.
      for (const r of registry) void loadVault(r.path);
      // Watch every registered root for live updates.
      watchFolders(registry.map((r) => r.path)).catch((err) =>
        console.warn("Multi-folder watcher unavailable:", err),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [loadVault]);

  const rewatch = useCallback((list: Vault[]) => {
    if (!isTauri) return;
    watchFolders(list.map((v) => v.path)).catch(() => {});
  }, []);

  const addFolderPath = useCallback(
    async (path: string, label?: string) => {
      if (vaultsRef.current.some((v) => v.path === path)) {
        setScope(path);
        return;
      }
      const vault: Vault = {
        path,
        label: label || basename(path),
        tree: null,
        itFiles: [],
        loading: true,
        error: null,
      };
      const next = [...vaultsRef.current, vault];
      setVaults(next);
      persist(next);
      rewatch(next);
      setScope(path);
      await loadVault(path);
    },
    [loadVault, persist, rewatch, setScope],
  );

  const addFolder = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: true,
      title: "Add Folder to Library",
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    for (const p of paths) await addFolderPath(p);
  }, [addFolderPath]);

  const removeVault = useCallback(
    async (path: string) => {
      const next = vaultsRef.current.filter((v) => v.path !== path);
      setVaults(next);
      persist(next);
      rewatch(next);
      setScopeState((s) => (s === path ? "all" : s));
    },
    [persist, rewatch],
  );

  const renameVault = useCallback(
    async (path: string, label: string) => {
      const clean = label.trim();
      if (!clean) return;
      const next = vaultsRef.current.map((v) =>
        v.path === path ? { ...v, label: clean } : v,
      );
      setVaults(next);
      persist(next);
    },
    [persist],
  );

  const refreshVault = useCallback(
    async (path: string) => {
      await loadVault(path);
    },
    [loadVault],
  );

  const refresh = useCallback(async () => {
    for (const v of vaultsRef.current) await loadVault(v.path);
  }, [loadVault]);

  // Live-refresh affected vaults on filesystem events (debounced).
  useEffect(() => {
    if (!isTauri) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const dirty = new Set<string>();
    const onEvent = (payload: { folder?: string } | undefined) => {
      const folder = payload?.folder ?? "";
      const vault = vaultsRef.current.find(
        (v) => folder === v.path || folder.startsWith(`${v.path}/`),
      );
      if (vault) dirty.add(vault.path);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const paths = [...dirty];
        dirty.clear();
        for (const p of paths) void loadVault(p);
      }, 400);
    };
    const subs = ["file-created", "file-modified", "file-deleted"].map((ev) =>
      listen<{ folder?: string }>(ev, (e) => onEvent(e.payload)),
    );
    return () => {
      clearTimeout(timer);
      subs.forEach((p) => p.then((un) => un()));
    };
  }, [loadVault]);

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
    async (vaultPath: string, name: string): Promise<string | null> => {
      const clean = name.trim().replace(/\.it$/i, "");
      if (!clean) return null;
      const path = `${vaultPath}/${clean}.it`;
      const starter = `title: ${clean}\nsummary: \n\nsection: Overview\nnote: New document.\n`;
      try {
        await writeFile(path, starter);
        await loadVault(vaultPath);
        return path;
      } catch (err) {
        console.error("Failed to create file:", err);
        return null;
      }
    },
    [loadVault],
  );

  const vaultOfPath = useCallback((path: string): Vault | undefined => {
    return vaultsRef.current.find(
      (v) => path === v.path || path.startsWith(`${v.path}/`),
    );
  }, []);

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
        const vault = vaultOfPath(path);
        if (vault) await loadVault(vault.path);
        return to;
      } catch (err) {
        console.error("Failed to rename:", err);
        return null;
      }
    },
    [loadVault, vaultOfPath],
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
        const vault = vaultOfPath(path);
        if (vault) await loadVault(vault.path);
        return true;
      } catch (err) {
        console.error("Failed to delete:", err);
        return false;
      }
    },
    [loadVault, vaultOfPath],
  );

  const allFiles = useMemo(() => {
    const out: TreeNode[] = [];
    for (const v of vaults) out.push(...v.itFiles);
    return out;
  }, [vaults]);

  const activeVault = useMemo(
    () => (scope === "all" ? null : (vaults.find((v) => v.path === scope) ?? null)),
    [scope, vaults],
  );

  const vaultLabelFor = useCallback(
    (path: string): string => {
      const v = vaults.find(
        (vault) => path === vault.path || path.startsWith(`${vault.path}/`),
      );
      return v?.label ?? "";
    },
    [vaults],
  );

  return useMemo(
    () => ({
      vaults,
      scope,
      setScope,
      activeVault,
      allFiles,
      recentFiles,
      revision,
      ready,
      addFolder,
      addFolderPath,
      removeVault,
      renameVault,
      refresh,
      refreshVault,
      createFile,
      renameEntry,
      deleteEntry,
      noteRecent,
      vaultLabelFor,
    }),
    [
      vaults,
      scope,
      setScope,
      activeVault,
      allFiles,
      recentFiles,
      revision,
      ready,
      addFolder,
      addFolderPath,
      removeVault,
      renameVault,
      refresh,
      refreshVault,
      createFile,
      renameEntry,
      deleteEntry,
      noteRecent,
      vaultLabelFor,
    ],
  );
}
