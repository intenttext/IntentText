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
import {
  TrustBanner,
  announcePopover,
  usePopoverExclusive,
} from "@dotit/editor";
import type { TrustState } from "@dotit/editor";
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
  /** New starter documents — a fillable form / a merge template. */
  onNewForm?: () => void;
  onNewTemplate?: () => void;
  onOpen: () => void;
  onSave: () => void;
  /** Compare the current document against another .it version (→ redline review). */
  onCompare?: () => void;
  /** Record the current content as a new version in the doc's history. */
  onSaveVersion?: () => void;
  onModal: (m: ModalType) => void;
  onExportPDF: () => void;
  onExportHTML: () => void;
  isSealed?: boolean;
  isTemplate?: boolean;
  /** The document is a template (vars / meta: type: template) but not a form. */
  isTemplateDoc?: boolean;
  /** The document is a form (meta: type: form) — shown as a mode chip. */
  isForm?: boolean;
  /** Form sub-mode: design its structure vs fill it in. */
  formView?: "design" | "fill";
  onFormViewChange?: (v: "design" | "fill") => void;
  /** Template sub-mode: edit the template vs preview it merged. */
  templateView?: "edit" | "preview";
  onTemplateViewChange?: (v: "edit" | "preview") => void;
  /** Trust snapshot + integrity verdict + live source — drive the seal chip and
   *  the document-properties popover that live in this single top bar. */
  trust?: TrustState;
  sealIntact?: boolean | null;
  source?: string;
  /** Apply a trust action's new source — makes the chip the complete control. */
  onSourceChange?: (source: string) => void;
  /** Ribbon density toggle (visual mode only) — owned by the app shell. */
  ribbonMode?: "ribbon" | "simple";
  onRibbonModeChange?: (mode: "ribbon" | "simple") => void;
  sourcePeek?: boolean;
  onToggleSourcePeek?: () => void;
  /** Unsaved-changes chip (visual mode): "Edited" + undo/redo + reset. */
  changeDirty?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onResetChanges?: () => void;
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
  onNewForm,
  onNewTemplate,
  onOpen,
  onSave,
  onCompare,
  onSaveVersion,
  onModal,
  onExportPDF,
  onExportHTML,
  isSealed = false,
  isTemplate = false,
  isTemplateDoc = false,
  isForm = false,
  formView = "fill",
  onFormViewChange,
  templateView = "edit",
  onTemplateViewChange,
  trust,
  sealIntact = null,
  source,
  onSourceChange,
  ribbonMode,
  onRibbonModeChange,
  sourcePeek = false,
  onToggleSourcePeek,
  changeDirty = false,
  onUndo,
  onRedo,
  onResetChanges,
  templateVarCount = 0,
  samples,
  onLoadSample,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Coordinate with the editor's popovers (seal chip, Properties): opening any of
  // them closes this title bar's menus, and vice versa.
  usePopoverExclusive("titlebar-menu", openMenu !== null, () => setOpenMenu(null));

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
    setOpenMenu((cur) => {
      const next = cur === name ? null : name;
      if (next) announcePopover("titlebar-menu");
      return next;
    });

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
            {item("New document", onNew, { kbd: "⌘N" })}
            {onNewForm &&
              item("New form", onNewForm, {
                title: "A fillable form (meta: type: form) — design fields, then fill it.",
              })}
            {onNewTemplate &&
              item("New template", onNewTemplate, {
                title: "A merge template with {{variables}} — edit it, then preview/merge.",
              })}
            {item("Open…", onOpen, { kbd: "⌘O" })}
            {item("Save", onSave, { kbd: "⌘S" })}
            {onCompare && item("Compare versions…", onCompare)}
            <div className="dropdown-sep" />
            {onSaveVersion &&
              item("Save version", onSaveVersion, {
                disabled: isSealed,
                title: isSealed
                  ? "A sealed document is frozen — unseal to record new versions."
                  : "Record the current content as a version in this document's history.",
              })}
            {item("History…", () => onModal("history"))}
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

      {/* Unsaved-changes chip — appears only when the doc differs from what was
          opened; clears when you undo/reset back to identical text. */}
      {editorMode === "visual" && changeDirty && (
        <span className="changes-chip" role="status" aria-live="polite">
          <span className="changes-chip-dot" aria-hidden>
            ●
          </span>
          <span className="changes-chip-count">Edited</span>
          <button
            type="button"
            className="changes-chip-btn"
            onClick={onUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            ⤺
          </button>
          <button
            type="button"
            className="changes-chip-btn"
            onClick={onRedo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            ⤻
          </button>
          <button
            type="button"
            className="changes-chip-btn changes-chip-reset"
            onClick={onResetChanges}
            title="Discard changes — restore the opened version"
          >
            Reset
          </button>
        </span>
      )}

      {/* Document-type cluster — the type chip + its sub-mode switch (Design|Fill for
          a form, Edit|Preview for a template) so the mode is visible AND switchable. */}
      {isForm ? (
        <div className="doc-type-cluster">
          <span className="doc-type-chip doc-type-chip--form" title="A fillable form">
            📋 Form
          </span>
          {onFormViewChange && (
            <div className="mode-switch mode-switch--sub">
              <div
                className="mode-switch-indicator"
                style={{
                  transform:
                    formView === "fill" ? "translateX(100%)" : "translateX(0)",
                }}
              />
              <button
                className={`mode-switch-btn ${formView === "design" ? "active" : ""}`}
                onClick={() => onFormViewChange("design")}
                title="Design — add and edit the form's fields"
              >
                Design
              </button>
              <button
                className={`mode-switch-btn ${formView === "fill" ? "active" : ""}`}
                onClick={() => onFormViewChange("fill")}
                title="Fill — the recipient view; a complete form can be signed"
              >
                Fill
              </button>
            </div>
          )}
        </div>
      ) : isTemplateDoc ? (
        <div className="doc-type-cluster">
          <button
            type="button"
            className="doc-type-chip doc-type-chip--template"
            onClick={() => onModal("template")}
            title="Template — click for Template & merge (test with data, export merged PDF)"
          >
            {`{{ }} Template${templateVarCount ? ` · ${templateVarCount}` : ""}`}
          </button>
          {onTemplateViewChange && (
            <div className="mode-switch mode-switch--sub">
              <div
                className="mode-switch-indicator"
                style={{
                  transform:
                    templateView === "preview"
                      ? "translateX(100%)"
                      : "translateX(0)",
                }}
              />
              <button
                className={`mode-switch-btn ${templateView === "edit" ? "active" : ""}`}
                onClick={() => onTemplateViewChange("edit")}
                title="Edit the template"
              >
                Edit
              </button>
              <button
                className={`mode-switch-btn ${templateView === "preview" ? "active" : ""}`}
                onClick={() => onTemplateViewChange("preview")}
                title="Preview — merged with sample data, as it will print"
              >
                Preview
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Document properties (meta/header/footer) are visible in the live source
          panel now — the redundant title-bar Properties button was removed. */}

      {/* Live trust seal — the compact chip (replaces the old SEALED badge). */}
      {trust && source && (
        <TrustBanner
          trust={trust}
          intact={sealIntact}
          source={source}
          onChange={onSourceChange}
        />
      )}

      {/* Ribbon ⇄ Simple density now lives on the right of the lower formatting
          toolbar (always-visible space), not here — see DocsToolbar. */}

      {/* Theme — ALWAYS here so the menu is stable across views (it's the web app's
          single theme control). Theme is out of trust (a viewer setting), so it's
          relevant in every view, including Bare. The shared ribbon keeps its own
          theme picker for embedded/desktop hosts that don't render this title bar;
          the web app hides that one via showThemePicker={false}. */}
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

      {/* Live source — the single source surface: an editable, trust-coloured side
          panel (no separate Source mode). Always present so the menu is stable. */}
      {onToggleSourcePeek && (
        <button
          className={`tbtn source-peek-btn ${sourcePeek ? "active" : ""}`}
          onClick={onToggleSourcePeek}
          aria-pressed={sourcePeek}
          title={
            sourcePeek
              ? "Hide the live source panel"
              : "Edit the .it source live, beside the page"
          }
        >
          {"</>"} Source
        </button>
      )}

      {/* Mode switch — Visual | Bare */}
      <div className="mode-switch">
        <div
          className="mode-switch-indicator"
          style={{
            transform:
              editorMode === "bare" ? "translateX(100%)" : "translateX(0)",
          }}
        />
        <button
          className={`mode-switch-btn ${editorMode === "visual" ? "active" : ""}`}
          onClick={() => onEditorModeChange("visual")}
          title="Visual mode — full styling, editable"
        >
          Visual
        </button>
        <button
          className={`mode-switch-btn ${editorMode === "bare" ? "active" : ""}`}
          onClick={() => onEditorModeChange("bare")}
          title="Bare view — the content as signed (no colours/sizes/layout)"
        >
          Bare
        </button>
      </div>
    </div>
  );
}
