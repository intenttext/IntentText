import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ItFileEntry } from "../hooks/useWorkspace";

interface ExplorerPanelProps {
  files: ItFileEntry[];
  activeFilePath: string | null;
  folderPath: string | null;
  folderName: string | null;
  isFileUnsaved: boolean;
  onFileOpen: (path: string) => void;
  onRefresh: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  file: ItFileEntry;
}

export function ExplorerPanel({
  files,
  activeFilePath,
  folderPath,
  folderName,
  isFileUnsaved,
  onFileOpen,
  onRefresh,
}: ExplorerPanelProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: ItFileEntry) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, file });
    },
    [],
  );

  const handleRename = useCallback(async (file: ItFileEntry) => {
    setContextMenu(null);
    setRenaming(file.path);
    setRenameValue(file.name);
  }, []);

  const submitRename = useCallback(
    async (oldPath: string) => {
      if (!renameValue.trim()) {
        setRenaming(null);
        return;
      }
      const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
      const newPath = `${dir}/${renameValue}`;
      if (newPath !== oldPath) {
        try {
          await invoke("rename_file", { from: oldPath, to: newPath });
          onRefresh();
        } catch (err) {
          console.error("Rename failed:", err);
        }
      }
      setRenaming(null);
    },
    [renameValue, onRefresh],
  );

  const handleDelete = useCallback(
    async (file: ItFileEntry) => {
      setContextMenu(null);
      const ok = confirm(`Move "${file.name}" to trash?`);
      if (!ok) return;
      try {
        await invoke("delete_file", { path: file.path });
        onRefresh();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [onRefresh],
  );

  const handleNewFile = useCallback(async () => {
    if (!folderPath) return;
    const name = prompt("New file name:", "untitled.it");
    if (!name) return;
    const path = `${folderPath}/${name.endsWith(".it") ? name : name + ".it"}`;
    try {
      await invoke("write_file", {
        path,
        content: `// ${name}\ntitle: ${name.replace(".it", "")}\n`,
      });
      onRefresh();
      onFileOpen(path);
    } catch (err) {
      console.error("Failed to create file:", err);
    }
  }, [folderPath, onRefresh, onFileOpen]);

  // Build nested tree from flat list
  const tree = buildNestedTree(files);

  if (!folderPath) {
    return (
      <div className="sidebar-empty">
        <p>No folder open</p>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Use Cmd+Shift+O to open a folder
        </p>
      </div>
    );
  }

  return (
    <div className="explorer-panel" onClick={() => setContextMenu(null)}>
      <div className="explorer-header">
        <span className="explorer-folder-name">{folderName}</span>
        <button
          className="explorer-action"
          onClick={handleNewFile}
          title="New File"
        >
          +
        </button>
      </div>

      <div className="explorer-tree">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            activeFilePath={activeFilePath}
            isFileUnsaved={isFileUnsaved}
            expandedDirs={expandedDirs}
            renaming={renaming}
            renameValue={renameValue}
            onToggleDir={toggleDir}
            onFileOpen={onFileOpen}
            onContextMenu={handleContextMenu}
            onRenameValueChange={setRenameValue}
            onSubmitRename={submitRename}
            onCancelRename={() => setRenaming(null)}
          />
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.file.isDir && (
            <button
              onClick={() => {
                onFileOpen(contextMenu.file.path);
                setContextMenu(null);
              }}
            >
              Open
            </button>
          )}
          <button onClick={() => handleRename(contextMenu.file)}>Rename</button>
          <button onClick={() => handleDelete(contextMenu.file)}>
            Move to Trash
          </button>
        </div>
      )}
    </div>
  );
}

interface TreeNodeData extends ItFileEntry {
  children: TreeNodeData[];
}

function buildNestedTree(flat: ItFileEntry[]): TreeNodeData[] {
  const roots: TreeNodeData[] = [];
  const dirMap = new Map<string, TreeNodeData>();

  // Sort: dirs first, then alphabetically
  const sorted = [...flat].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  for (const file of sorted) {
    const node: TreeNodeData = { ...file, children: [] };

    if (file.isDir) {
      dirMap.set(file.path, node);
    }

    // Find parent directory
    const parentPath = file.path.substring(0, file.path.lastIndexOf("/"));
    const parent = dirMap.get(parentPath);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface TreeNodeProps {
  node: TreeNodeData;
  depth: number;
  activeFilePath: string | null;
  isFileUnsaved: boolean;
  expandedDirs: Set<string>;
  renaming: string | null;
  renameValue: string;
  onToggleDir: (path: string) => void;
  onFileOpen: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, file: ItFileEntry) => void;
  onRenameValueChange: (value: string) => void;
  onSubmitRename: (oldPath: string) => void;
  onCancelRename: () => void;
}

function TreeNode({
  node,
  depth,
  activeFilePath,
  isFileUnsaved,
  expandedDirs,
  renaming,
  renameValue,
  onToggleDir,
  onFileOpen,
  onContextMenu,
  onRenameValueChange,
  onSubmitRename,
  onCancelRename,
}: TreeNodeProps) {
  const isExpanded = expandedDirs.has(node.path);
  const isActive = node.path === activeFilePath;
  const isRenaming = renaming === node.path;

  const icon = node.isDir
    ? isExpanded
      ? "📂"
      : "📁"
    : node.isFrozen
      ? "🔒"
      : node.hasErrors
        ? "⚠️"
        : "📄";

  const statusIcon = !node.isDir && isActive && isFileUnsaved ? " ●" : "";

  return (
    <>
      <div
        className={`tree-item ${isActive ? "active" : ""}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => {
          if (node.isDir) onToggleDir(node.path);
          else onFileOpen(node.path);
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <span className="tree-icon">{icon}</span>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitRename(node.path);
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={() => onSubmitRename(node.path)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="tree-name">
            {node.name}
            {statusIcon && <span className="unsaved-dot">{statusIcon}</span>}
          </span>
        )}
      </div>

      {node.isDir &&
        isExpanded &&
        node.children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            isFileUnsaved={isFileUnsaved}
            expandedDirs={expandedDirs}
            renaming={renaming}
            renameValue={renameValue}
            onToggleDir={onToggleDir}
            onFileOpen={onFileOpen}
            onContextMenu={onContextMenu}
            onRenameValueChange={onRenameValueChange}
            onSubmitRename={onSubmitRename}
            onCancelRename={onCancelRename}
          />
        ))}
    </>
  );
}
