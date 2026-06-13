// Slim Docs-style title bar — the app's ONLY chrome row above the ribbon:
//
//   [logo] [filename] [File ▾]            …            [SEALED] [Visual|Source]
//
// Everything that used to be scattered across the old header (New / Open /
// Save / Samples / Template / Help / exports) lives in the File menu. In
// visual mode the ribbon (inside @dotit/editor) renders directly underneath;
// in source mode a Theme picker is surfaced here since there is no ribbon.

import { useState, useRef, useEffect } from "react";
import { ThemePicker } from "./ThemePicker";
import type { ModalType } from "../App";
import type { EditorMode } from "../types";

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
  onExportPDF: () => void;
  onExportHTML: () => void;
  isSealed?: boolean;
  isTemplate?: boolean;
  templateVarCount?: number;
  samples?: { id: string; title: string }[];
  onLoadSample?: (id: string) => void;
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
  onExportPDF,
  onExportHTML,
  isSealed,
  isTemplate = false,
  templateVarCount = 0,
  samples,
  onLoadSample,
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

  const item = (
    label: string,
    action: () => void,
    opts?: { kbd?: string; badge?: number; disabled?: boolean; title?: string },
  ) => (
    <button
      className="dropdown-item"
      disabled={opts?.disabled}
      title={opts?.title}
      onClick={() => {
        if (opts?.disabled) return;
        action();
        setOpenMenu(null);
      }}
    >
      {label}
      {opts?.badge ? <span className="tbtn-badge">{opts.badge}</span> : null}
      {opts?.kbd ? <span className="menu-kbd">{opts.kbd}</span> : null}
    </button>
  );

  return (
    <div ref={toolbarRef} className="titlebar">
      {/* Logo mark */}
      <span className="titlebar-logo" title="IntentText Editor">
        .it
      </span>

      {/* Editable document name */}
      <input
        className="filename-input"
        value={filename}
        onChange={(e) => onFilenameChange(e.target.value)}
        spellCheck={false}
        aria-label="Document name"
      />

      {/* File menu — New / Open / Save / exports / samples / tools */}
      <div className="dropdown">
        <button
          className={`tbtn${openMenu === "file" ? " active" : ""}`}
          onClick={() => toggle("file")}
        >
          File ▾
        </button>
        {openMenu === "file" && (
          <div className="dropdown-menu dropdown-menu--left">
            {item("New", onNew, { kbd: "⌘N" })}
            {item("Open…", onOpen, { kbd: "⌘O" })}
            {item("Save", onSave, { kbd: "⌘S" })}
            <div className="dropdown-sep" />
            {item("Export PDF", onExportPDF)}
            {item("Export HTML", onExportHTML)}
            <div className="dropdown-sep" />
            {item("Template & merge…", () => onModal("template"), {
              badge: templateVarCount,
            })}
            {item("Trust — sign, seal, verify…", () => onModal("trust"), {
              disabled: isTemplate,
              title: isTemplate
                ? "Templates can't be sealed — merge first."
                : undefined,
            })}
            {samples && samples.length > 0 && onLoadSample && (
              <>
                <div className="dropdown-sep" />
                <div className="dropdown-title">Samples</div>
                {samples.map((s) =>
                  item(s.title, () => onLoadSample(s.id)),
                )}
              </>
            )}
            <div className="dropdown-sep" />
            {item("Keyboard shortcuts", () => onModal("help"))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {isSealed && (
        <span className="sealed-badge">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M8 1a4 4 0 00-4 4v2H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V5a4 4 0 00-4-4zm-2 4a2 2 0 114 0v2H6V5z" />
          </svg>{" "}
          SEALED
        </span>
      )}

      {/* Source mode has no ribbon — surface the theme picker here. */}
      {editorMode === "source" && (
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
      )}

      {/* Mode switch */}
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
          Visual
        </button>
        <button
          className={`mode-switch-btn ${editorMode === "source" ? "active" : ""}`}
          onClick={() => onEditorModeChange("source")}
          title="Source mode"
        >
          Source
        </button>
      </div>
    </div>
  );
}
