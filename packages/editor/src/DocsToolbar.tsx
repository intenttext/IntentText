// The editor ribbon — ONE compact, Google-Docs-style toolbar row with groups:
//
//   Edit | File (PDF / HTML / theme) | Text | Paragraph | Insert | Trust
//
// Every formatting control maps to a CORE `.it` property (size:/align:/leading:/
// space-before:/space-after:/end:) through bridge.ts, so what you style here is
// what core prints. Export actions are the WYSIWYG print path from print.ts.

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Editor } from "@tiptap/core";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Minus,
  Plus,
  Palette,
  Highlighter,
  RemoveFormatting,
  ChevronDown,
  Printer,
  Download,
  Droplets,
  Rows3,
  AlignHorizontalSpaceBetween,
  RectangleVertical,
  RectangleHorizontal,
} from "lucide-react";
import { LANGUAGE_REGISTRY } from "@dotit/core";
import { CATEGORY_META } from "./types";
import { getBlockProp } from "./block-props";
import {
  getPageGeometry,
  setPageSize,
  setPageOrientation,
  PAGE_SIZE_OPTIONS,
} from "./page-geometry";
import {
  exportDocumentPDF,
  downloadItFile,
  builtinThemes,
} from "./print";
import { TrustControl } from "./TrustControl";
import type { TrustState } from "./trust-state";
import type { TrustAction } from "./types";

interface Props {
  editor: Editor | null;
  isRtl?: boolean;
  onToggleRtl?: () => void;
  /** Current .it source — used by the export actions. */
  content: string;
  /** Apply a new source (used by the self-contained trust control). */
  onChange?: (source: string) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  /**
   * Optional host override for the Trust control. When omitted the editor's own
   * self-contained TrustControl handles sign/seal/verify/unseal via core.
   */
  onTrustAction?: (action: TrustAction) => void;
  /** Trust snapshot — drives the built-in TrustControl. */
  trust?: TrustState;
  /** verifyDocument().intact — null when not sealed. */
  sealIntact?: boolean | null;
  /** Sealed documents are read-only — formatting groups are disabled. */
  locked?: boolean;
}

/* ── Style options that map to IT keywords ──────────────────── */
const STYLE_OPTIONS = [
  { label: "Normal text", node: "paragraph" },
  { label: "Title", node: "itTitle" },
  { label: "Section", node: "itSection" },
  { label: "Subsection", node: "itSub" },
  { label: "Summary", node: "itSummary" },
  { label: "Quote", node: "itQuote" },
] as const;

type InsertOption = {
  label: string;
  keyword: string;
  category: string;
  description: string;
  isReadOnly: boolean;
};
type InsertGroup = { category: string; items: InsertOption[] };

const READ_ONLY_INSERT_KEYWORDS = new Set([
  "history",
  "revision",
  "track",
  "freeze",
]);
const HIDDEN_INSERT_KEYWORDS = new Set([
  "agent",
  "model",
  "meta",
  "context",
  "history",
]);
const CATEGORY_ORDER = [
  "identity",
  "structure",
  "content",
  "data",
  "trust",
  "layout",
];

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter" },
  { label: "Arial", value: "Arial" },
  { label: "Times New Roman", value: "Times New Roman" },
  { label: "Georgia", value: "Georgia" },
  { label: "Courier New", value: "Courier New" },
  { label: "Verdana", value: "Verdana" },
  { label: "Trebuchet MS", value: "Trebuchet MS" },
] as const;

// Word-style line spacing presets → core `leading:` (line-height).
const LINE_SPACINGS = ["1", "1.15", "1.5", "2", "2.5", "3"] as const;
// One Word "spacing step" → core `space-before:` / `space-after:`.
const SPACE_STEP = "12px";

const TEXT_COLORS = [
  "#000000",
  "#434343",
  "#666666",
  "#999999",
  "#b7b7b7",
  "#cccccc",
  "#d9d9d9",
  "#efefef",
  "#f3f3f3",
  "#ffffff",
  "#980000",
  "#ff0000",
  "#ff9900",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#4a86e8",
  "#0000ff",
  "#9900ff",
  "#ff00ff",
  "#e6b8af",
  "#f4cccc",
  "#fce5cd",
  "#fff2cc",
  "#d9ead3",
  "#d0e0e3",
  "#c9daf8",
  "#cfe2f3",
  "#d9d2e9",
  "#ead1dc",
  "#dd7e6b",
  "#ea9999",
  "#f9cb9c",
  "#ffe599",
  "#b6d7a8",
  "#a2c4c9",
  "#a4c2f4",
  "#9fc5e8",
  "#b4a7d6",
  "#d5a6bd",
  "#cc4125",
  "#e06666",
  "#f6b26b",
  "#ffd966",
  "#93c47d",
  "#76a5af",
  "#6d9eeb",
  "#6fa8dc",
  "#8e7cc3",
  "#c27ba0",
];

const HIGHLIGHT_COLORS = [
  "#ffffff",
  "#cfe2f3",
  "#d9ead3",
  "#fff2cc",
  "#fce5cd",
  "#f4cccc",
  "#d9d2e9",
  "#ead1dc",
  "#d0e0e3",
  "#e6b8af",
];

/* ── Helper: small icon button ──────────────────────────────── */
function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`docs-tb-btn${active ? " active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

/** A ribbon group — one compact Docs-style row (the label is a11y-only). */
function Group({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`ribbon-group ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function GroupSep() {
  return <div className="ribbon-sep" />;
}

export function DocsToolbar({
  editor,
  isRtl = false,
  onToggleRtl,
  content,
  onChange,
  theme,
  onThemeChange,
  onTrustAction,
  trust,
  sealIntact = null,
  locked = false,
}: Props) {
  const [styleOpen, setStyleOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightColorOpen, setHighlightColorOpen] = useState(false);
  const [spacingOpen, setSpacingOpen] = useState(false);
  const [inkSaver, setInkSaver] = useState(false);

  // ── Page setup (size + orientation) ──────────────────────────
  // Read the live geometry from the current .it source so the controls reflect
  // (and round-trip) the document's own `page:` block. Writing goes through the
  // same setPageSize/setPageOrientation helpers the geometry parses — one path.
  const pageGeo = useMemo(() => getPageGeometry(content), [content]);
  // Show the named size in the dropdown; a custom `<w> <h>` size falls back to
  // "Custom" (selecting a named size replaces it).
  const currentSize = (PAGE_SIZE_OPTIONS as readonly string[]).includes(
    pageGeo.size,
  )
    ? pageGeo.size
    : "Custom";
  const setSize = useCallback(
    (size: string) => onChange?.(setPageSize(content, size)),
    [content, onChange],
  );
  const setOrientation = useCallback(
    (o: "portrait" | "landscape") =>
      onChange?.(setPageOrientation(content, o)),
    [content, onChange],
  );

  const styleRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);
  const fontRef = useRef<HTMLDivElement>(null);
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightColorRef = useRef<HTMLDivElement>(null);
  const spacingRef = useRef<HTMLDivElement>(null);

  // Close all dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (styleRef.current && !styleRef.current.contains(t))
        setStyleOpen(false);
      if (insertRef.current && !insertRef.current.contains(t))
        setInsertOpen(false);
      if (fontRef.current && !fontRef.current.contains(t)) setFontOpen(false);
      if (textColorRef.current && !textColorRef.current.contains(t))
        setTextColorOpen(false);
      if (highlightColorRef.current && !highlightColorRef.current.contains(t))
        setHighlightColorOpen(false);
      if (spacingRef.current && !spacingRef.current.contains(t))
        setSpacingOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeAll = () => {
    setStyleOpen(false);
    setInsertOpen(false);
    setFontOpen(false);
    setTextColorOpen(false);
    setHighlightColorOpen(false);
    setSpacingOpen(false);
  };

  /* ── Queries ─────────────────────────────────────────────── */
  const getCurrentStyle = useCallback((): string => {
    if (!editor) return "Normal text";
    for (const opt of STYLE_OPTIONS) {
      if (opt.node === "paragraph" && editor.isActive("paragraph")) {
        const isOther = STYLE_OPTIONS.some(
          (o) => o.node !== "paragraph" && editor.isActive(o.node),
        );
        if (!isOther) return opt.label;
      } else if (editor.isActive(opt.node)) {
        return opt.label;
      }
    }
    return "Normal text";
  }, [editor]);

  const getCurrentFont = useCallback((): string => {
    if (!editor) return "Default";
    const family = editor.getAttributes("textStyle")?.fontFamily;
    if (!family) return "Default";
    const match = FONT_FAMILIES.find((f) => f.value === family);
    return match ? match.label : "Default";
  }, [editor]);

  const [fontSize, setFontSize] = useState(11);
  // Re-render on selection moves so active states (align, spacing, end) track the caret.
  const [, setSelTick] = useState(0);

  const insertGroups = useMemo<InsertGroup[]>(() => {
    const grouped = new Map<string, InsertOption[]>();

    for (const entry of LANGUAGE_REGISTRY) {
      if (entry.status !== "stable") continue;
      if (HIDDEN_INSERT_KEYWORDS.has(entry.canonical)) continue;
      if (entry.category === "agent") continue;

      const category = entry.category;
      const list = grouped.get(category) || [];
      list.push({
        label: entry.canonical,
        keyword: entry.canonical,
        category,
        description: entry.description,
        isReadOnly: READ_ONLY_INSERT_KEYWORDS.has(entry.canonical),
      });
      grouped.set(category, list);
    }

    const result: InsertGroup[] = [];
    for (const category of CATEGORY_ORDER) {
      const items = grouped.get(category);
      if (!items || items.length === 0) continue;
      items.sort((a, b) => a.keyword.localeCompare(b.keyword));
      result.push({
        category: CATEGORY_META[category]?.label || category,
        items,
      });
    }
    return result;
  }, []);

  // Sync font size + selection tick from editor selection
  useEffect(() => {
    if (!editor) return;
    const updateFontSize = () => {
      const attrs = editor.getAttributes("textStyle");
      if (attrs?.fontSize) {
        const n = parseInt(attrs.fontSize, 10);
        if (!isNaN(n)) setFontSize(n);
      }
      setSelTick((t) => t + 1);
    };
    editor.on("selectionUpdate", updateFontSize);
    editor.on("transaction", updateFontSize);
    return () => {
      editor.off("selectionUpdate", updateFontSize);
      editor.off("transaction", updateFontSize);
    };
  }, [editor]);

  /* ── Actions ─────────────────────────────────────────────── */
  const setStyle = useCallback(
    (nodeType: string) => {
      if (!editor) return;
      if (nodeType === "paragraph") {
        editor.chain().focus().setParagraph().run();
      } else if (nodeType === "itQuote") {
        editor.chain().focus().setNode("itQuote").run();
      } else {
        editor.chain().focus().setNode(nodeType).run();
      }
      closeAll();
    },
    [editor],
  );

  const insertBlock = useCallback(
    (keyword: string) => {
      if (!editor) return;
      const chain = editor.chain().focus();
      if (keyword === "divider") {
        chain.setNode("itDivider").run();
      } else if (keyword === "break") {
        chain.setNode("itBreak").run();
      } else if (keyword === "code") {
        chain.setNode("itCode", { lang: "" }).run();
      } else if (
        ["tip", "info", "warning", "danger", "success"].includes(keyword)
      ) {
        chain.setNode("itCallout", { variant: keyword }).run();
      } else {
        chain.setNode("itGenericBlock", { keyword, properties: "" }).run();
      }
      closeAll();
    },
    [editor],
  );

  // Font size — selection-based; serializes to core `size:` (line-level when the
  // whole line is styled, an inline [text]{ size: … } span otherwise).
  const changeFontSize = useCallback(
    (delta: number) => {
      const next = Math.min(96, Math.max(8, fontSize + delta));
      setFontSize(next);
      editor?.chain().focus().setFontSize(`${next}pt`).run();
    },
    [editor, fontSize],
  );

  // Paragraph spacing — writes core `leading:` / `space-before:` / `space-after:`
  // onto every block in the selection (multi-block selections supported).
  const setLeading = useCallback(
    (v: string | null) => {
      editor?.chain().focus().setBlockProp("leading", v).run();
      closeAll();
    },
    [editor],
  );

  const toggleSpace = useCallback(
    (key: "space-before" | "space-after") => {
      if (!editor) return;
      const cur = getBlockProp(editor, key);
      editor
        .chain()
        .focus()
        .setBlockProp(key, cur ? null : SPACE_STEP)
        .run();
      closeAll();
    },
    [editor],
  );

  const customSpacing = useCallback(() => {
    if (!editor) return;
    const before = window.prompt(
      "Space before block (e.g. 12px, 1em — empty for none):",
      getBlockProp(editor, "space-before") || "",
    );
    if (before === null) return;
    const after = window.prompt(
      "Space after block (e.g. 12px, 1em — empty for none):",
      getBlockProp(editor, "space-after") || "",
    );
    if (after === null) return;
    editor
      .chain()
      .focus()
      .setBlockProp("space-before", before.trim() || null)
      .setBlockProp("space-after", after.trim() || null)
      .run();
    closeAll();
  }, [editor]);

  // Two-sided row — writes the core `end:` property (`text: … | end: …`):
  // content at the line start, value at the line end (flex split, RTL-native).
  const editSplitEnd = useCallback(() => {
    if (!editor) return;
    const cur = getBlockProp(editor, "end");
    const next = window.prompt(
      "Line-end text (shown at the end of the line — empty to remove):",
      cur || "",
    );
    if (next === null) return;
    editor
      .chain()
      .focus()
      .setBlockProp("end", next.trim() || null)
      .run();
  }, [editor]);

  const insertSplitRow = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: "paragraph",
        attrs: { end: "End text" },
        content: [{ type: "text", text: "Start text" }],
      })
      .run();
    closeAll();
  }, [editor]);

  /* ── Export (WYSIWYG print path) ─────────────────────────── */
  const themes = useMemo(() => builtinThemes(), []);
  const printMode = inkSaver ? "minimal-ink" : "normal";
  const doExportPDF = useCallback(
    () => exportDocumentPDF(content, theme, printMode),
    [content, theme, printMode],
  );
  const doSave = useCallback(() => downloadItFile(content), [content]);

  if (!editor) return null;

  const currentLeading = getBlockProp(editor, "leading");
  const hasEnd = !!getBlockProp(editor, "end");

  return (
    <div className="docs-toolbar docs-ribbon">
      {/* ── Edit ─────────────────────────────────────────── */}
      <Group label="Edit">
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={locked || !editor.can().undo()}
          title="Undo (⌘Z)"
        >
          <Undo2 size={16} />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={locked || !editor.can().redo()}
          title="Redo (⌘⇧Z)"
        >
          <Redo2 size={16} />
        </Btn>
      </Group>

      <GroupSep />

      {/* ── File / Export ────────────────────────────────── */}
      <Group label="File">
        <Btn onClick={doSave} title="Save / Download the .it file">
          <Download size={16} />
          <span className="ribbon-btn-text">Save</span>
        </Btn>
        <Btn onClick={doExportPDF} title="Export PDF (⌘P) — WYSIWYG">
          <Printer size={16} />
          <span className="ribbon-btn-text">PDF</span>
        </Btn>
        <Btn
          onClick={() => setInkSaver((v) => !v)}
          active={inkSaver}
          title="Minimal ink mode (plain callouts when printing)"
        >
          <Droplets size={16} />
        </Btn>
        <select
          className="ribbon-theme-select"
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
          title="Document theme (used everywhere — canvas, print, export)"
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </Group>

      <GroupSep />

      {/* ── Page setup (size + orientation) → page: | size: … | orientation: … ── */}
      <Group label="Page">
        <select
          className="ribbon-page-size"
          value={currentSize}
          onChange={(e) => setSize(e.target.value)}
          disabled={locked}
          title="Page size — sets page: | size: … (true physical size in print/PDF)"
        >
          {currentSize === "Custom" && (
            <option value="Custom" disabled>
              Custom
            </option>
          )}
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Btn
          onClick={() => setOrientation("portrait")}
          active={pageGeo.orientation === "portrait"}
          disabled={locked}
          title="Portrait orientation"
        >
          <RectangleVertical size={16} />
        </Btn>
        <Btn
          onClick={() => setOrientation("landscape")}
          active={pageGeo.orientation === "landscape"}
          disabled={locked}
          title="Landscape orientation"
        >
          <RectangleHorizontal size={16} />
        </Btn>
      </Group>

      <GroupSep />

      <div className={locked ? "ribbon-locked" : "ribbon-editing"}>
        {/* ── Style (paragraph type) ───────────────────────── */}
        <Group label="Style">
          {/* Block style (Title / Section / …) */}
          <div className="docs-tb-dropdown" ref={styleRef}>
            <button
              className="docs-tb-select docs-tb-paragraph-select"
              onClick={() => {
                closeAll();
                setStyleOpen(!styleOpen);
              }}
            >
              <span className="docs-tb-select-label">{getCurrentStyle()}</span>
              <ChevronDown size={14} />
            </button>
            {styleOpen && (
              <div className="docs-tb-dropdown-menu docs-style-menu">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.node}
                    className={`docs-tb-dropdown-item${getCurrentStyle() === opt.label ? " active" : ""}`}
                    onClick={() => setStyle(opt.node)}
                  >
                    <span
                      className={`docs-style-preview docs-style-${opt.node}`}
                    >
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Group>

        <GroupSep />

        {/* ── Font (family + size) ─────────────────────────── */}
        <Group label="Font">
          {/* Font family */}
          <div className="docs-tb-dropdown" ref={fontRef}>
            <button
              className="docs-tb-select docs-tb-font-select"
              onClick={() => {
                closeAll();
                setFontOpen(!fontOpen);
              }}
            >
              <span className="docs-tb-select-label">{getCurrentFont()}</span>
              <ChevronDown size={14} />
            </button>
            {fontOpen && (
              <div className="docs-tb-dropdown-menu docs-font-menu">
                {FONT_FAMILIES.map((f) => (
                  <button
                    key={f.value || "default"}
                    className={`docs-tb-dropdown-item${getCurrentFont() === f.label ? " active" : ""}`}
                    style={{ fontFamily: f.value || "inherit" }}
                    onClick={() => {
                      if (f.value) {
                        editor.chain().focus().setFontFamily(f.value).run();
                      } else {
                        editor.chain().focus().unsetFontFamily().run();
                      }
                      closeAll();
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font size → core `size:` */}
          <Btn onClick={() => changeFontSize(-1)} title="Decrease font size">
            <Minus size={14} />
          </Btn>
          <span className="docs-tb-fontsize">{fontSize}</span>
          <Btn onClick={() => changeFontSize(1)} title="Increase font size">
            <Plus size={14} />
          </Btn>
        </Group>

        <GroupSep />

        {/* ── Text (B I U S + color) ───────────────────────── */}
        <Group label="Text">
          <Btn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Bold (⌘B)"
          >
            <Bold size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Italic (⌘I)"
          >
            <Italic size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Underline (⌘U)"
          >
            <Underline size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            title="Strikethrough (⌘⇧X)"
          >
            <Strikethrough size={16} />
          </Btn>

          {/* Text Color */}
          <div
            className="docs-tb-dropdown docs-tb-color-dropdown"
            ref={textColorRef}
          >
            <button
              className="docs-tb-btn docs-tb-color-btn"
              onClick={() => {
                closeAll();
                setTextColorOpen(!textColorOpen);
              }}
              title="Text color"
            >
              <Palette size={16} />
              <span
                className="docs-tb-color-indicator"
                style={{
                  background:
                    editor.getAttributes("textStyle")?.color || "#000000",
                }}
              />
            </button>
            {textColorOpen && (
              <div className="docs-tb-dropdown-menu docs-color-grid-menu">
                <div className="docs-color-grid-label">Text color</div>
                <div className="docs-color-grid">
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      className="docs-color-swatch"
                      style={{ background: c }}
                      title={c}
                      onClick={() => {
                        editor.chain().focus().setColor(c).run();
                        closeAll();
                      }}
                    />
                  ))}
                </div>
                <button
                  className="docs-tb-dropdown-item"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    closeAll();
                  }}
                >
                  <RemoveFormatting size={14} /> Reset
                </button>
              </div>
            )}
          </div>

          {/* Highlight Color */}
          <div
            className="docs-tb-dropdown docs-tb-color-dropdown"
            ref={highlightColorRef}
          >
            <button
              className="docs-tb-btn docs-tb-color-btn"
              onClick={() => {
                closeAll();
                setHighlightColorOpen(!highlightColorOpen);
              }}
              title="Highlight color"
            >
              <Highlighter size={16} />
              <span
                className="docs-tb-color-indicator"
                style={{
                  background:
                    editor.getAttributes("highlight")?.color || "transparent",
                }}
              />
            </button>
            {highlightColorOpen && (
              <div className="docs-tb-dropdown-menu docs-color-grid-menu">
                <div className="docs-color-grid-label">Highlight color</div>
                <div className="docs-color-grid docs-highlight-grid">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      className="docs-color-swatch"
                      style={{ background: c }}
                      title={c}
                      onClick={() => {
                        if (c === "#ffffff") {
                          editor.chain().focus().unsetHighlight().run();
                        } else {
                          editor
                            .chain()
                            .focus()
                            .toggleHighlight({ color: c })
                            .run();
                        }
                        closeAll();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Btn
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            title="Inline code"
          >
            <Code size={16} />
          </Btn>
          <Btn
            onClick={() =>
              editor.chain().focus().unsetAllMarks().clearNodes().run()
            }
            title="Clear formatting"
          >
            <RemoveFormatting size={16} />
          </Btn>
        </Group>

        <GroupSep />

        {/* ── Paragraph (align / direction / spacing / lists) ─ */}
        <Group label="Paragraph">
          {/* Alignment → core `align:` */}
          <Btn
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            title="Align left"
          >
            <AlignLeft size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            title="Align center"
          >
            <AlignCenter size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            title="Align right"
          >
            <AlignRight size={16} />
          </Btn>
          <Btn
            onClick={() =>
              editor.chain().focus().setTextAlign("justify").run()
            }
            active={editor.isActive({ textAlign: "justify" })}
            title="Justify"
          >
            <AlignJustify size={16} />
          </Btn>
          <Btn
            onClick={() => onToggleRtl?.()}
            active={isRtl}
            title={
              isRtl
                ? "Switch to LTR (left-to-right)"
                : "Switch to RTL (right-to-left)"
            }
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: -0.5,
                lineHeight: 1,
              }}
            >
              {isRtl ? "LTR" : "RTL"}
            </span>
          </Btn>

          {/* Line & paragraph spacing → core `leading:` / `space-before:` / `space-after:` */}
          <div className="docs-tb-dropdown" ref={spacingRef}>
            <button
              className={`docs-tb-btn${currentLeading ? " active" : ""}`}
              onClick={() => {
                closeAll();
                setSpacingOpen(!spacingOpen);
              }}
              title="Line & paragraph spacing"
            >
              <Rows3 size={16} />
              <ChevronDown size={12} />
            </button>
            {spacingOpen && (
              <div className="docs-tb-dropdown-menu docs-spacing-menu">
                <div className="docs-insert-category">Line spacing</div>
                <button
                  className={`docs-tb-dropdown-item${!currentLeading ? " active" : ""}`}
                  onClick={() => setLeading(null)}
                >
                  Default
                </button>
                {LINE_SPACINGS.map((v) => (
                  <button
                    key={v}
                    className={`docs-tb-dropdown-item${currentLeading === v ? " active" : ""}`}
                    onClick={() => setLeading(v)}
                  >
                    {v === "1" ? "Single" : v === "2" ? "Double" : v}
                  </button>
                ))}
                <div className="docs-insert-divider" />
                <div className="docs-insert-category">Paragraph spacing</div>
                <button
                  className="docs-tb-dropdown-item"
                  onClick={() => toggleSpace("space-before")}
                >
                  {getBlockProp(editor, "space-before")
                    ? "Remove space before block"
                    : "Add space before block"}
                </button>
                <button
                  className="docs-tb-dropdown-item"
                  onClick={() => toggleSpace("space-after")}
                >
                  {getBlockProp(editor, "space-after")
                    ? "Remove space after block"
                    : "Add space after block"}
                </button>
                <button
                  className="docs-tb-dropdown-item"
                  onClick={customSpacing}
                >
                  Custom spacing…
                </button>
              </div>
            )}
          </div>

          <Btn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Bullet list"
          >
            <List size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Numbered list"
          >
            <ListOrdered size={16} />
          </Btn>
        </Group>

        <GroupSep />

        {/* ── Insert ───────────────────────────────────────── */}
        <Group label="Insert">
          <div className="docs-tb-dropdown" ref={insertRef}>
            <button
              className="docs-tb-select docs-tb-insert-select"
              onClick={() => {
                closeAll();
                setInsertOpen(!insertOpen);
              }}
            >
              <Plus size={15} />
              <span>Insert</span>
              <ChevronDown size={14} />
            </button>
            {insertOpen && (
              <div className="docs-tb-dropdown-menu docs-insert-menu">
                <button
                  className="docs-tb-dropdown-item docs-insert-item"
                  onClick={insertSplitRow}
                  title="Two-sided row — content at the line start, value at the line end (text: … | end: …)"
                >
                  <span className="docs-insert-icon">
                    <AlignHorizontalSpaceBetween size={13} />
                  </span>
                  <span className="docs-insert-label">two-sided row</span>
                  <span className="docs-insert-kw">end:</span>
                </button>
                <div className="docs-insert-divider" />
                {insertGroups.map((group, gi) => (
                  <div key={group.category}>
                    {gi > 0 && <div className="docs-insert-divider" />}
                    <div className="docs-insert-category">{group.category}</div>
                    {group.items.map((opt) => (
                      <button
                        key={opt.keyword}
                        className="docs-tb-dropdown-item docs-insert-item"
                        onClick={() => insertBlock(opt.keyword)}
                        disabled={opt.isReadOnly}
                        title={opt.description}
                      >
                        <span className="docs-insert-icon">
                          {CATEGORY_META[opt.category]?.icon || "•"}
                        </span>
                        <span className="docs-insert-label">{opt.label}</span>
                        <span className="docs-insert-kw">
                          {opt.isReadOnly ? "locked" : `.${opt.keyword}`}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Two-sided row → core `end:` */}
          <Btn
            onClick={editSplitEnd}
            active={hasEnd}
            title="Two-sided row — set the text shown at the END of this line (end: property)"
          >
            <AlignHorizontalSpaceBetween size={16} />
          </Btn>
        </Group>
      </div>

      {/* ── Trust ────────────────────────────────────────── */}
      {trust && onChange ? (
        <>
          <GroupSep />
          <Group label="Trust">
            <TrustControl
              content={content}
              onChange={onChange}
              trust={trust}
              intact={sealIntact}
            />
          </Group>
        </>
      ) : (
        onTrustAction && (
          <>
            <GroupSep />
            <Group label="Trust">
              <Btn
                onClick={() => onTrustAction("seal")}
                disabled={locked}
                title="Seal — freeze the document with a tamper-evident hash"
              >
                <span className="ribbon-btn-text">Seal</span>
              </Btn>
              <Btn onClick={() => onTrustAction("sign")} title="Sign">
                <span className="ribbon-btn-text">Sign</span>
              </Btn>
              <Btn onClick={() => onTrustAction("verify")} title="Verify">
                <span className="ribbon-btn-text">Verify</span>
              </Btn>
            </Group>
          </>
        )
      )}
    </div>
  );
}
