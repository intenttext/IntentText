// LibraryPanel — workspace folder tree with trust badges, recents and file
// operations (create / rename / delete via context menu).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import type { TreeNode } from "../lib/backend";
import { basename } from "../lib/backend";
import type { WorkspaceApi } from "../hooks/useWorkspace";
import type { TrustBadge } from "../hooks/useTrustBadges";

const BADGE_LABEL: Record<TrustBadge, string> = {
  draft: "",
  tracked: "Tracked",
  approved: "Approved",
  signed: "Signed",
  sealed: "Sealed",
  error: "!",
};

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

export function LibraryPanel(props: {
  api: WorkspaceApi;
  badges: Map<string, TrustBadge>;
  activePath: string | null;
  dirty: boolean;
  onOpenFile: (path: string) => void;
}) {
  const { api, badges, activePath, dirty, onOpenFile } = props;
  const { workspace } = api;
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
    setCreating(false);
    setNewName("");
    if (!name) return;
    const path = await api.createFile(name);
    if (path) onOpenFile(path);
  }, [api, newName, onOpenFile]);

  const submitRename = useCallback(async () => {
    if (!renaming) return;
    const target = renaming;
    const value = renameValue.trim();
    setRenaming(null);
    if (!value || value === basename(target)) return;
    const next = await api.renameEntry(target, value);
    if (next && activePath === target) onOpenFile(next);
  }, [api, renaming, renameValue, activePath, onOpenFile]);

  const recents = useMemo(
    () =>
      api.recentFiles.filter(
        (p) => !workspace || p.startsWith(`${workspace.path}/`) === false,
      ),
    [api.recentFiles, workspace],
  );

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const pad = 10 + depth * 14;
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
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
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
          setMenu({ x: e.clientX, y: e.clientY, node });
        }}
        title={node.relativePath}
      >
        <FileText size={14} />
        <span className="tree-name">
          {node.name}
          {isActive && dirty ? <span className="dirty-dot"> •</span> : null}
        </span>
        {badge && badge !== "draft" && (
          <span className={`trust-badge trust-${badge}`}>
            {BADGE_LABEL[badge]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="library">
      <div className="panel-head">
        <span className="panel-title">
          {workspace ? workspace.name : "Library"}
        </span>
        <span className="panel-actions">
          <button
            className="icon-btn"
            title="New document"
            disabled={!workspace}
            onClick={() => setCreating(true)}
          >
            <FilePlus2 size={15} />
          </button>
          <button
            className="icon-btn"
            title="Refresh"
            disabled={!workspace}
            onClick={() => api.refresh()}
          >
            <RefreshCw size={14} />
          </button>
        </span>
      </div>

      {!workspace ? (
        <div className="panel-empty">
          <p>No workspace folder selected.</p>
          <button className="btn primary" onClick={() => api.chooseWorkspace()}>
            Choose Workspace…
          </button>
        </div>
      ) : (
        <div className="tree" onContextMenu={(e) => e.preventDefault()}>
          {creating && (
            <div className="tree-row" style={{ paddingLeft: 10 }}>
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
          {workspace.tree.map((n) => renderNode(n, 0))}
          {workspace.itFiles.length === 0 && !creating && (
            <div className="panel-empty">
              <p>No .it documents here yet.</p>
            </div>
          )}
        </div>
      )}

      {recents.length > 0 && (
        <div className="recents">
          <div className="panel-subtitle">Recent (outside workspace)</div>
          {recents.slice(0, 6).map((p) => (
            <button
              key={p}
              className="tree-row tree-file"
              style={{ paddingLeft: 10 }}
              title={p}
              onClick={() => onOpenFile(p)}
            >
              <FileText size={14} />
              <span className="tree-name">{basename(p)}</span>
            </button>
          ))}
        </div>
      )}

      {menu && (
        <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            onClick={() => {
              setRenaming(menu.node.path);
              setRenameValue(menu.node.name);
              setMenu(null);
            }}
          >
            Rename…
          </button>
          <button
            className="danger"
            onClick={async () => {
              const node = menu.node;
              setMenu(null);
              await api.deleteEntry(node.path);
            }}
          >
            Move to Trash
          </button>
        </div>
      )}
    </div>
  );
}
