import { useState, useRef, useEffect } from "react";
import { ThemePicker } from "./ThemePicker";
import type { ModalType } from "../App";
import type { EditorMode } from "../visual/types";

interface Props {
  filename: string;
  onFilenameChange: (name: string) => void;
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onModal: (m: ModalType) => void;
  isSealed?: boolean;
}

export function Toolbar({
  filename,
  onFilenameChange,
  editorMode,
  onEditorModeChange,
  theme,
  onThemeChange,
  onNew,
  onOpen,
  onSave,
  onModal,
  isSealed,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (name: string) =>
    setOpenMenu((cur) => (cur === name ? null : name));

  return (
    <div
      ref={toolbarRef}
      style={{
        height: "var(--toolbar-h)",
        background: "var(--bg-toolbar)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* Left — file controls */}
      <button className="tbtn" onClick={onNew} title="New file (Cmd+N)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 1h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1zm6.5 1H3v12h9V4.5L9.5 2z" />
        </svg>
        New
      </button>
      <button className="tbtn" onClick={onOpen} title="Open file (Cmd+O)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.879a1.5 1.5 0 011.06.44L8.56 3.56A.5.5 0 008.854 3.5H13.5A1.5 1.5 0 0115 5v7.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9zM2.5 3a.5.5 0 00-.5.5V6h12V5a.5.5 0 00-.5-.5H8.854a1.5 1.5 0 01-1.06-.44L6.672 2.94A.5.5 0 006.379 3H2.5z" />
        </svg>
        Open
      </button>
      <button className="tbtn" onClick={onSave} title="Save file (Cmd+S)">
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zM11.986 3L13 4.014 11.014 6 10 4.986 11.986 3z" />
        </svg>
        Save
      </button>
      <input
        className="filename-input"
        value={filename}
        onChange={(e) => onFilenameChange(e.target.value)}
        spellCheck={false}
      />

      <div style={{ flex: 1 }} />

      {/* Center — mode switch */}
      <div className="mode-switch">
        <div
          className="mode-switch-indicator"
          style={{
            transform:
              editorMode === "source" ? "translateX(100%)" : "translateX(0)",
          }}
        />
        <button
          className={`mode-switch-btn ${editorMode === "visual" ? "active" : ""}`}
          onClick={() => onEditorModeChange("visual")}
          title="Visual mode"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 3C4.5 3 1.7 5.1.5 8c1.2 2.9 4 5 7.5 5s6.3-2.1 7.5-5c-1.2-2.9-4-5-7.5-5zm0 8.3a3.3 3.3 0 110-6.6 3.3 3.3 0 010 6.6z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
          Visual
        </button>
        <button
          className={`mode-switch-btn ${editorMode === "source" ? "active" : ""}`}
          onClick={() => onEditorModeChange("source")}
          title="Source mode"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M5.854 4.146a.5.5 0 010 .708L3.207 7.5l2.647 2.646a.5.5 0 01-.708.708l-3-3a.5.5 0 010-.708l3-3a.5.5 0 01.708 0zm4.292 0a.5.5 0 00-.146.354.5.5 0 00.146.354L12.793 7.5l-2.647 2.646a.5.5 0 00.708.708l3-3a.5.5 0 000-.708l-3-3a.5.5 0 00-.354-.146z" />
          </svg>
          Source
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Right — panel toggles + theme */}
      {isSealed && (
        <span className="sealed-badge">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
          </svg>{" "}
          SEALED
        </span>
      )}

      <div className="dropdown">
        <button className="tbtn" onClick={() => toggle("theme")}>
          Theme ▾
        </button>
        {openMenu === "theme" && (
          <ThemePicker
            active={theme}
            onSelect={(t) => {
              onThemeChange(t);
              setOpenMenu(null);
            }}
          />
        )}
      </div>

      <button
        className="tbtn"
        onClick={() => onModal("help")}
        title="Keyboard shortcuts"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M1 4a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H3a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1H3z" />
          <path d="M4 5h1v1H4V5zm2 0h1v1H6V5zm2 0h1v1H8V5zm2 0h1v1h-1V5zm-6 2h1v1H4V7zm2 0h1v1H6V7zm2 0h1v1H8V7zm2 0h1v1h-1V7zm-4 2h4v1H6V9z" />
        </svg>
      </button>
    </div>
  );
}
