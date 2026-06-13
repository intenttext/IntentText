// VaultSidebar — the Finder-style left rail of the multi-vault registry.
//
//   ◈ All Files          ← federated view across every vault
//   ▸ Contracts          ← each registered vault, by label
//   ▸ Invoices
//   + Add Folder
//
// Selecting a vault scopes the file list to it; "All Files" federates. Below
// the rail, the file list for the current scope is shown (a folder tree for a
// single vault, or a flat federated list for All Files). Vault rows have a
// context menu to rename the label or remove the vault from the registry.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { TreeNode } from "../lib/backend";
import { basename } from "../lib/backend";
import type { VaultsApi } from "../hooks/useVaults";
import type { TrustBadge } from "../hooks/useTrustBadges";

const BADGE_TITLE: Record<TrustBadge, string> = {
  draft: "Draft",
  tracked: "Tracked",
  approved: "Approved",
  signed: "Signed",
  sealed: "Sealed",
  error: "Unreadable",
};

function BadgeIcon({ badge }: { badge: TrustBadge }) {
  if (badge === "sealed")
    return <Lock size={11} className="trust-icon trust-sealed" />;
  if (badge === "signed" || badge === "approved")
    return <ShieldCheck size={11} className={`trust-icon trust-${badge}`} />;
  if (badge === "tracked")
    return <span className="trust-dot trust-tracked" title="Tracked" />;
  return null;
}

interface ContextMenuState {
  x: number;
  y: number;
  kind: "file" | "vault";
  target: string;
  label?: string;
}

export function VaultSidebar(props: {
  api: VaultsApi;
  badges: Map<string, TrustBadge>;
  activePath: string | null;
  dirty: boolean;
  onOpenFile: (path: string) => void;
}) {
  const { api, badges, activePath, dirty, onOpenFile } = props;
  const { vaults, scope, activeVault } = api;

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const toggleDir = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    const vaultPath = activeVault?.path;
    setCreating(false);
    setNewName("");
    if (!name || !vaultPath) return;
    const path = await api.createFile(vaultPath, name);
    if (path) onOpenFile(path);
  }, [api, newName, activeVault, onOpenFile]);

  const submitRenameFile = useCallback(async () => {
    if (!renaming) return;
    const target = renaming;
    const value = renameValue.trim();
    setRenaming(null);
    if (!value || value === basename(target)) return;
    const next = await api.renameEntry(target, value);
    if (next && activePath === target) onOpenFile(next);
  }, [api, renaming, renameValue, activePath, onOpenFile]);

  // -------- file rows (shared by tree + federated list) ----------------------
  const fileRow = (node: TreeNode, pad: number, showVault = false): ReactNode => {
    const badge = badges.get(node.path);
    const isActive = node.path === activePath;

    if (renaming === node.path) {
      return (
        <div key={node.path} className="tree-row" style={{ paddingLeft: pad }}>
          <FileText size={14} />
          <input
            className="tree-input"
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={submitRenameFile}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRenameFile();
              if (e.key === "Escape") setRenaming(null);
            }}
          />
        </div>
      );
    }

    return (
      <button
        key={node.path}
        className={`tree-row tree-file${isActive ? " active" : ""}`}
        style={{ paddingLeft: pad }}
        onClick={() => onOpenFile(node.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY, kind: "file", target: node.path });
        }}
        title={node.path}
      >
        <FileText size={14} />
        <span className="tree-name">
          {node.name.replace(/\.it$/i, "")}
          {isActive && dirty ? <span className="dirty-dot"> •</span> : null}
        </span>
        {showVault && (
          <span className="tree-vault">{api.vaultLabelFor(node.path)}</span>
        )}
        {badge && badge !== "draft" && badge !== "error" && (
          <span title={BADGE_TITLE[badge]}>
            <BadgeIcon badge={badge} />
          </span>
        )}
      </button>
    );
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const pad = 12 + depth * 14;
    if (node.isDir) {
      const isCollapsed = collapsed.has(node.path);
      return (
        <div key={node.path}>
          <button
            className="tree-row tree-dir"
            style={{ paddingLeft: pad }}
            onClick={() => toggleDir(node.path)}
          >
            {isCollapsed ? (
              <ChevronRight size={13} className="tree-caret" />
            ) : (
              <ChevronDown size={13} className="tree-caret" />
            )}
            {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
            <span className="tree-name">{node.name}</span>
          </button>
          {!isCollapsed && node.children.map((c) => renderNode(c, depth + 1))}
        </div>
      );
    }
    if (!node.name.endsWith(".it")) return null;
    return fileRow(node, pad);
  };

  // -------- federated "All Files" list (sorted by recency) -------------------
  const federated = useMemo(() => {
    if (scope !== "all") return [];
    return [...api.allFiles].sort((a, b) => b.modified - a.modified);
  }, [scope, api.allFiles]);

  const scopeLabel = scope === "all" ? "All Files" : (activeVault?.label ?? "");
  const docCount =
    scope === "all" ? api.allFiles.length : (activeVault?.itFiles.length ?? 0);

  return (
    <div className="vault-sidebar">
      {/* ---- vault rail ---- */}
      <nav className="vault-rail">
        <button
          className={`vault-row${scope === "all" ? " active" : ""}`}
          onClick={() => api.setScope("all")}
          title="Search and browse every registered folder"
        >
          <Layers size={14} className="vault-glyph" />
          <span className="vault-label">All Files</span>
          <span className="vault-count">{api.allFiles.length}</span>
        </button>

        {vaults.map((v) => (
          <button
            key={v.path}
            className={`vault-row${scope === v.path ? " active" : ""}${
              v.error ? " errored" : ""
            }`}
            onClick={() => api.setScope(v.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({
                x: e.clientX,
                y: e.clientY,
                kind: "vault",
                target: v.path,
                label: v.label,
              });
            }}
            title={v.error ? `${v.path}\n${v.error}` : v.path}
          >
            <Folder size={14} className="vault-glyph" />
            <span className="vault-label">{v.label}</span>
            {v.loading ? (
              <span className="vault-count muted">…</span>
            ) : v.error ? (
              <span className="vault-count warn">!</span>
            ) : (
              <span className="vault-count">{v.itFiles.length}</span>
            )}
          </button>
        ))}

        <button className="vault-row add" onClick={() => api.addFolder()}>
          <FolderPlus size={14} className="vault-glyph" />
          <span className="vault-label">Add Folder…</span>
        </button>
      </nav>

      {/* ---- scoped file list ---- */}
      <div className="vault-files">
        <div className="panel-head">
          <span className="panel-title">
            {scopeLabel}
            <span className="panel-count"> {docCount}</span>
          </span>
          <span className="panel-actions">
            {scope !== "all" && (
              <button
                className="icon-btn"
                title="New document in this folder"
                onClick={() => setCreating(true)}
              >
                <FilePlus2 size={15} />
              </button>
            )}
            <button
              className="icon-btn"
              title="Refresh"
              onClick={() =>
                scope === "all" ? api.refresh() : api.refreshVault(scope)
              }
            >
              <RefreshCw size={14} />
            </button>
          </span>
        </div>

        <div className="tree" onContextMenu={(e) => e.preventDefault()}>
          {creating && scope !== "all" && (
            <div className="tree-row" style={{ paddingLeft: 12 }}>
              <FileText size={14} />
              <input
                ref={createInputRef}
                className="tree-input"
                placeholder="document-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={submitCreate}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
            </div>
          )}

          {scope === "all"
            ? federated.map((n) => fileRow(n, 12, true))
            : (activeVault?.tree ?? []).map((n) => renderNode(n, 0))}

          {scope === "all" && vaults.length === 0 && (
            <div className="panel-empty">
              <p>No folders registered yet.</p>
              <button className="btn primary" onClick={() => api.addFolder()}>
                <FolderPlus size={15} /> Add Folder…
              </button>
              <p className="muted small">
                Register the folders where your .it files live — contracts,
                invoices, project docs — and search across all of them at once.
              </p>
            </div>
          )}
          {scope === "all" && vaults.length > 0 && federated.length === 0 && (
            <div className="panel-empty">
              <p>No .it documents found in your folders.</p>
            </div>
          )}
          {scope !== "all" &&
            activeVault &&
            !activeVault.loading &&
            activeVault.itFiles.length === 0 &&
            !creating && (
              <div className="panel-empty">
                <p>No .it documents here yet.</p>
              </div>
            )}
          {activeVault?.error && (
            <div className="panel-empty">
              <p className="warn">Folder unavailable.</p>
              <p className="muted small">{activeVault.error}</p>
            </div>
          )}
        </div>
      </div>

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          {menu.kind === "file" ? (
            <>
              <button
                onClick={() => {
                  setRenaming(menu.target);
                  setRenameValue(basename(menu.target));
                  setMenu(null);
                }}
              >
                Rename…
              </button>
              <button
                className="danger"
                onClick={async () => {
                  const target = menu.target;
                  setMenu(null);
                  await api.deleteEntry(target);
                }}
              >
                Move to Trash
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  const next = window.prompt("Rename folder", menu.label);
                  setMenu(null);
                  if (next) api.renameVault(menu.target, next);
                }}
              >
                Rename Label…
              </button>
              <button onClick={() => api.refreshVault(menu.target)}>
                Refresh
              </button>
              <button
                className="danger"
                onClick={() => {
                  const target = menu.target;
                  setMenu(null);
                  api.removeVault(target);
                }}
              >
                Remove from Library
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
