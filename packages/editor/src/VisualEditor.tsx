import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { FontSize } from "./font-size";
import { Pagination } from "./pagination";
import { sourceToDoc, docToSource, detectUnsupportedStyling } from "./bridge";
import {
  ITTitle,
  ITSummary,
  ITSection,
  ITSub,
  ITCallout,
  ITQuote,
  ITCode,
  ITDivider,
  ITTable,
  ITMeta,
  ITTrust,
  ITMetric,
  ITStyleRule,
  ITBreak,
  ITGenericBlock,
  ITComment,
} from "./extensions";
import { ITParagraph, BlockProps } from "./block-props";
import { DocsToolbar } from "./DocsToolbar";
import { DocsRuler, DocsVerticalRuler } from "./Ruler";
import { TrustBanner, DocPropsBar } from "./TrustBanner";
import { extractTrustState } from "./trust-state";
import {
  getBuiltinTheme,
  generateThemeCSS,
  parseIntentText,
  documentStyleCSS,
  verifyDocument,
  upsertMetaProperty,
} from "@dotit/core";
import {
  getPageGeometry,
  resolvePageTokens,
  setPageMargin,
  MM,
  type PageGeometry,
} from "./page-geometry";
import { TemplateHighlight } from "./template-highlight";
import { LineKeymap } from "./line-keymap";
import { exportDocumentPDF } from "./print";
import type { TrustAction } from "./types";

/** Grey gap between page cards on the canvas (px). */
const PAGE_GAP = 28;

/** View-only zoom bounds — never affects the .it source or the printed PDF. */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
/** Numeric zoom presets offered in the status-bar zoom menu. */
const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;

// Where each `style:` target lives in the EDITOR's markup (.it-doc-* classes).
// documentStyleCSS() does the collection/sanitization — same engine as core's
// print path — so a rule means exactly the same thing on canvas and on paper.
const EDITOR_STYLE_SELECTORS: Record<string, string[]> = {
  title: [".it-doc-title"],
  summary: [".it-doc-summary"],
  section: [".it-doc-section"],
  sub: [".it-doc-sub"],
  text: ["p"],
  quote: [".it-doc-quote"],
  callout: [".it-doc-callout"],
  info: [".it-doc-callout"],
  table: [".it-doc-table th", ".it-doc-table td"],
  "table-header": [".it-doc-table th"],
  metric: [".it-doc-metric"],
  contact: ['.it-doc-generic[data-keyword="contact"]'],
  divider: [".it-doc-divider"],
};

interface Props {
  value: string;
  onChange: (source: string) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  /** Force read-only (sealed documents are read-only regardless). */
  readOnly?: boolean;
  /** Show the formatting ribbon. Default true. */
  showRibbon?: boolean;
  /** Show the trust status banner + document properties strip. Default true. */
  showTrustBanner?: boolean;
  /** Ribbon Trust group (Seal / Sign / Verify). Group is hidden when omitted. */
  onTrustAction?: (action: TrustAction) => void;
}

export function VisualEditor({
  value,
  onChange,
  theme,
  onThemeChange,
  readOnly = false,
  showRibbon = true,
  showTrustBanner = true,
  onTrustAction,
}: Props) {
  const lastSourceRef = useRef<string>("");
  const isInternalUpdate = useRef(false);
  const isHydrating = useRef(true);
  // Styling that can't be saved to .it / won't print through core (regression guard).
  const [unsupported, setUnsupported] = useState<string[]>([]);
  // Live page geometry from the document's own page:/header:/footer: blocks —
  // the same numbers the print path uses (that's what makes the view WYSIWYG).
  const geometryRef = useRef<PageGeometry>(getPageGeometry(""));
  const [pageCount, setPageCount] = useState(1);

  const editor = useEditor({
    extensions: [
      Pagination.configure({
        geometry: () => geometryRef.current,
        gap: PAGE_GAP,
        onPages: setPageCount,
      }),
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        // Replaced by ITParagraph (core block props: end/leading/space-…).
        paragraph: false,
      }),
      ITParagraph,
      BlockProps,
      LineKeymap,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["paragraph", "itTitle", "itSummary", "itSection", "itSub"],
      }),
      FontFamily,
      FontSize,
      Subscript,
      Superscript,
      ITTitle,
      ITSummary,
      ITSection,
      ITSub,
      ITCallout,
      ITQuote,
      ITCode,
      ITDivider,
      ITTable,
      ITMeta,
      ITTrust,
      ITMetric,
      ITStyleRule,
      ITBreak,
      ITGenericBlock,
      ITComment,
      TemplateHighlight,
    ],
    content: sourceToDoc(value),
    onUpdate: ({ editor: ed }) => {
      // Avoid rewriting source while editor is still hydrating initial content.
      if (isHydrating.current) return;
      const json = ed.getJSON();
      const source = docToSource(json);
      lastSourceRef.current = source;
      isInternalUpdate.current = true;
      // Fidelity guard: flag any styling that won't survive to .it / core print.
      setUnsupported(detectUnsupportedStyling(json));
      onChange(source);
    },
    editorProps: {
      attributes: {
        class: "docs-page-content",
        spellcheck: "true",
      },
    },
  });

  // Sync external source changes (e.g. from file open, source mode edits)
  useEffect(() => {
    // Mark hydration complete on next tick after mount content is applied.
    const t = window.setTimeout(() => {
      isHydrating.current = false;
      lastSourceRef.current = value;
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (value !== lastSourceRef.current) {
      const json = sourceToDoc(value);
      editor.commands.setContent(json);
      lastSourceRef.current = value;
    }
  }, [value, editor]);

  // Host "insert text/variable" → insert at the current caret. Dispatch a
  // window CustomEvent("it-insert-text", { detail: "{{customer.name}}" }).
  useEffect(() => {
    if (!editor) return;
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text) editor.chain().focus().insertContent(text).run();
    };
    window.addEventListener("it-insert-text", handler);
    return () => window.removeEventListener("it-insert-text", handler);
  }, [editor]);

  // Geometry derived from the document itself (page:/header:/footer: blocks).
  const geometry = useMemo(() => getPageGeometry(value), [value]);
  useEffect(() => {
    geometryRef.current = geometry;
    // Nudge the pagination plugin to re-layout with the new geometry.
    editor?.view.dispatch(editor.state.tr);
  }, [geometry, editor]);
  const pageRef = useRef<HTMLDivElement>(null);

  // Word count for the page indicator
  const getWordCount = useCallback(() => {
    if (!editor) return 0;
    return (
      editor.storage.characterCount?.words?.() ??
      editor.getText().split(/\s+/).filter(Boolean).length
    );
  }, [editor]);

  // ── Theme CSS injection ──────────────────────────────────
  const themeCSS = useMemo(() => {
    if (!theme) return "";
    try {
      const t = getBuiltinTheme(theme);
      if (!t) return "";
      return generateThemeCSS(t).replace(/:root\{/, ".docs-page{");
    } catch {
      return "";
    }
  }, [theme]);

  const docLayoutMeta = useMemo(() => {
    try {
      const doc = parseIntentText(value);
      const header = doc.blocks.find((b) => b.type === "header")?.content || "";
      const footer = doc.blocks.find((b) => b.type === "footer")?.content || "";
      // Document direction lives on the `meta:` block — but core lifts meta out
      // of `doc.blocks` into `doc.metadata.meta`. Read it there (with the parsed
      // `language` as a fallback) so the RTL toggle actually flips the canvas.
      const meta = (doc.metadata as Record<string, unknown> | undefined)?.meta as
        | Record<string, unknown>
        | undefined;
      const lang = String(
        (doc.metadata as Record<string, unknown> | undefined)?.language || "",
      ).toLowerCase();
      const dir = String(
        meta?.dir || (lang === "rtl" ? "rtl" : "") || "ltr",
      ).toLowerCase();
      return { header, footer, dir };
    } catch {
      return { header: "", footer: "", dir: "ltr" };
    }
  }, [value]);

  // ── Trust state: status banner + sealed read-only ─────────
  const trust = useMemo(() => {
    try {
      return extractTrustState(parseIntentText(value));
    } catch {
      return extractTrustState(null);
    }
  }, [value]);

  // Hash check for the banner ("hash verified ✓") — only when sealed.
  const sealIntact = useMemo<boolean | null>(() => {
    if (!trust.isSealed) return null;
    try {
      return verifyDocument(value).intact;
    } catch {
      return null;
    }
  }, [value, trust.isSealed]);

  // Sealed documents are read-only — the canvas refuses edits and the ribbon's
  // formatting groups are disabled (clear professional indication via banner).
  // Hosts can force the same with the readOnly prop.
  const locked = trust.isSealed || readOnly;
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable === !locked) return;
    editor.setEditable(!locked);
  }, [editor, locked]);

  // Native RTL: set `dir` directly on the ProseMirror editable element so the
  // caret jumps to the right edge and typing flows right-to-left (not just a
  // visual mirror). Reflows immediately when the meta dir toggles.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute("dir", docLayoutMeta.dir === "rtl" ? "rtl" : "ltr");
  }, [editor, docLayoutMeta.dir]);

  // Live document styles: apply the doc's `style:` rules to the canvas so the
  // author SEES the house styling while editing (and the WYSIWYG print export
  // inherits it automatically, since it copies the page's <style> elements).
  const docStyleRulesCSS = useMemo(() => {
    try {
      return documentStyleCSS(
        parseIntentText(value),
        EDITOR_STYLE_SELECTORS,
        ".docs-page .tiptap ",
      );
    } catch {
      return "";
    }
  }, [value]);
  useEffect(() => {
    let el = document.getElementById(
      "it-doc-style-rules",
    ) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "it-doc-style-rules";
      document.head.appendChild(el);
    }
    el.textContent = docStyleRulesCSS;
  }, [docStyleRulesCSS]);

  // RTL toggle — behaves like Word's RTL paragraph button:
  //  • A real multi-block (or single non-empty block) selection → set/clear
  //    `dir: rtl` as a PROPERTY on each selected block, so those paragraphs
  //    mirror independently (per-block dir attr → core renders the same).
  //  • A bare caret / whole-doc with no meaningful selection → toggle the
  //    DOCUMENT direction via core's upsertMetaProperty (idempotent, no
  //    `dir: rtl | dir: rtl` spam; null removes it cleanly).
  const toggleRtl = useCallback(() => {
    if (editor) {
      const { from, to } = editor.state.selection;
      // Count selected block boundaries — a selection spanning ≥1 block whose
      // range is non-empty means "treat these rows as RTL paragraphs".
      let blockCount = 0;
      let anyRtl = false;
      editor.state.doc.nodesBetween(from, to, (node) => {
        if (node.isTextblock) {
          blockCount++;
          const attrDir = node.attrs?.dir;
          const propDir = (() => {
            try {
              return node.attrs?.props
                ? JSON.parse(node.attrs.props as string).dir
                : undefined;
            } catch {
              return undefined;
            }
          })();
          if (attrDir === "rtl" || propDir === "rtl") anyRtl = true;
          return false;
        }
        return true;
      });
      const hasSelection = from !== to && blockCount >= 1;
      if (hasSelection) {
        // Toggle: if any selected block is already RTL, clear all → LTR.
        editor
          .chain()
          .focus()
          .setBlockProp("dir", anyRtl ? null : "rtl")
          .run();
        return;
      }
    }
    // No real selection → flip the whole document's direction.
    const isRtl = docLayoutMeta.dir === "rtl";
    onChange(upsertMetaProperty(value, "dir", isRtl ? null : "rtl"));
  }, [editor, value, onChange, docLayoutMeta.dir]);

  // Ruler drag → update the page: block's margins. Writes mm (the .it canonical
  // unit) as a `page: … | margin: T R B L` shorthand so the change round-trips
  // and the print path reads identical margins.
  const setMargins = useCallback(
    (next: { top?: number; right?: number; bottom?: number; left?: number }) => {
      const g = geometryRef.current;
      const pxToMm = (px: number) => Math.max(0, Math.round((px / MM) * 10) / 10);
      const t = pxToMm(next.top ?? g.marginTop);
      const r = pxToMm(next.right ?? g.marginRight);
      const b = pxToMm(next.bottom ?? g.marginBottom);
      const l = pxToMm(next.left ?? g.marginLeft);
      const marginVal = `${t}mm ${r}mm ${b}mm ${l}mm`;
      onChange(setPageMargin(value, marginVal));
    },
    [value, onChange],
  );

  useEffect(() => {
    const id = "it-editor-theme-css";
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = themeCSS;
  }, [themeCSS]);

  // ── Zoom (view-only — never written to the .it document or the printed PDF) ──
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  // Fit modes recompute zoom on canvas resize / page-size change; a numeric
  // preset or +/- pins zoom and clears the mode.
  const [fitMode, setFitMode] = useState<"none" | "width" | "page">("none");
  const prevZoomRef = useRef(zoom);
  // Store focal point in content-space coordinates for zoom
  const focalRef = useRef<{ cx: number; cy: number } | null>(null);

  // Capture focal point at mouse position (for wheel zoom)
  const captureFocalAtMouse = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Mouse position in content-space (scroll + offset within viewport)
      focalRef.current = {
        cx: el.scrollLeft + (e.clientX - rect.left),
        cy: el.scrollTop + (e.clientY - rect.top),
      };
    },
    [],
  );

  // Capture focal point at viewport center (for keyboard / preset zoom)
  const captureFocalAtCenter = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    focalRef.current = {
      cx: el.scrollLeft + el.clientWidth / 2,
      cy: el.scrollTop + el.clientHeight / 2,
    };
  }, []);

  const clampZoom = (z: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(2)));

  // Set an exact zoom (a preset / status-bar control), centred on the viewport.
  const applyZoom = useCallback(
    (z: number) => {
      setFitMode("none");
      captureFocalAtCenter();
      setZoom(clampZoom(z));
    },
    [captureFocalAtCenter],
  );

  // Zoom so the page width (or whole page) fits the visible canvas. The canvas
  // inner width is its clientWidth minus the ruler gutter the page is centred in;
  // we measure clientWidth directly since the page is centred with auto margins.
  const computeFit = useCallback(
    (mode: "width" | "page"): number => {
      const el = canvasRef.current;
      if (!el) return 1;
      const PAD = 24; // breathing room around the sheet
      const availW = el.clientWidth - PAD;
      if (mode === "width") return clampZoom(availW / geometry.width);
      const availH = el.clientHeight - PAD;
      const pageH = isFinite(geometry.height) ? geometry.height : geometry.width;
      return clampZoom(Math.min(availW / geometry.width, availH / pageH));
    },
    [geometry.width, geometry.height],
  );

  const fitToWidth = useCallback(() => {
    captureFocalAtCenter();
    setFitMode("width");
    setZoom(computeFit("width"));
  }, [captureFocalAtCenter, computeFit]);

  const fitToPage = useCallback(() => {
    captureFocalAtCenter();
    setFitMode("page");
    setZoom(computeFit("page"));
  }, [captureFocalAtCenter, computeFit]);

  // Re-fit when the canvas resizes or the page geometry changes while a fit
  // mode is active (e.g. user switches A4 → A1, or resizes the window).
  useEffect(() => {
    if (fitMode === "none") return;
    const el = canvasRef.current;
    if (!el) return;
    const recompute = () => setZoom(computeFit(fitMode));
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMode, computeFit]);

  // After DOM paints with new zoom, restore scroll so focal point is stable
  useLayoutEffect(() => {
    const el = canvasRef.current;
    const focal = focalRef.current;
    const prevZoom = prevZoomRef.current;
    if (!el || !focal || prevZoom === zoom) return;
    const ratio = zoom / prevZoom;
    // The focal point in old content-space maps to focal * ratio in new content-space
    const rect = el.getBoundingClientRect();
    // Where was the focal point relative to the viewport?
    const vpX = focal.cx - el.scrollLeft;
    const vpY = focal.cy - el.scrollTop;
    el.scrollLeft = focal.cx * ratio - vpX;
    el.scrollTop = focal.cy * ratio - vpY;
    focalRef.current = null;
    prevZoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // Cmd/Ctrl+P → OUR WYSIWYG PDF export, not the raw browser print dialog.
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        exportDocumentPDF(value, theme);
        return;
      }
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setFitMode("none");
        captureFocalAtCenter();
        setZoom((z) => clampZoom(z + ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setFitMode("none");
        captureFocalAtCenter();
        setZoom((z) => clampZoom(z - ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setFitMode("none");
        captureFocalAtCenter();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [captureFocalAtCenter, value, theme]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setFitMode("none");
        captureFocalAtMouse(e);
        setZoom((z) => clampZoom(z + delta));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [captureFocalAtMouse]);

  return (
    <div className="docs-container">
      {showRibbon && (
        <DocsToolbar
          editor={editor}
          isRtl={docLayoutMeta.dir === "rtl"}
          onToggleRtl={toggleRtl}
          content={value}
          onChange={onChange}
          theme={theme}
          onThemeChange={onThemeChange}
          onTrustAction={onTrustAction}
          trust={trust}
          sealIntact={sealIntact}
          locked={locked}
        />
      )}
      {showTrustBanner && (
        <TrustBanner trust={trust} intact={sealIntact} source={value} />
      )}
      {showTrustBanner && <DocPropsBar source={value} />}
      {unsupported.length > 0 && (
        <div className="docs-fidelity-warning" role="status">
          ⚠ Some formatting ({unsupported.join(", ")}) can’t be saved to{" "}
          <code>.it</code> and won’t appear when printed through the template —
          remove it or use the toolbar’s color/size/style controls instead.
        </div>
      )}
      <DocsRuler
        geometry={geometry}
        zoom={zoom}
        scrollEl={canvasRef}
        onMargins={setMargins}
        locked={locked}
      />
      <div className="docs-canvas-row">
        <DocsVerticalRuler
          geometry={geometry}
          zoom={zoom}
          scrollEl={canvasRef}
          onMargins={setMargins}
          locked={locked}
        />
      <div className="docs-canvas" ref={canvasRef}>
        <div
          className="docs-page-scaler"
          style={{ width: geometry.width * zoom }}
        >
          <div
            className="docs-page-flow"
            dir={docLayoutMeta.dir}
            style={{
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {/* One continuous editable sheet, visually cut into Word-like pages.
                The static band below is page 1's top margin + header; the
                Pagination plugin closes every page with its footer band (incl.
                the last) and opens the next with its header band. */}
            <div
              className="docs-page docs-sheet"
              ref={pageRef}
              style={
                {
                  width: geometry.width,
                  minHeight: geometry.autoHeight ? geometry.width : undefined,
                  "--page-mx-l": `${geometry.marginLeft}px`,
                  "--page-mx-r": `${geometry.marginRight}px`,
                } as React.CSSProperties
              }
            >
              <div
                className="docs-sheet-header"
                data-it-spacer=""
                style={{ height: geometry.autoHeight ? undefined : geometry.marginTop }}
              >
                <div className="docs-pb-header">
                  <span className="docs-pb-text">
                    {geometry.autoHeight
                      ? ""
                      : resolvePageTokens(geometry.header, 1, pageCount)}
                  </span>
                </div>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
        <div className="docs-page-footer">
          {pageCount} {pageCount === 1 ? "page" : "pages"} &middot;{" "}
          {getWordCount()} words
        </div>
      </div>
      </div>
      {/* Persistent status bar — always-visible zoom controls (view-only). */}
      <div className="docs-statusbar">
        <span className="docs-statusbar-meta">
          {geometry.size}
          {geometry.orientation === "landscape" ? " landscape" : ""} &middot;{" "}
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </span>
        <ZoomControl
          zoom={zoom}
          fitMode={fitMode}
          onZoom={applyZoom}
          onFitWidth={fitToWidth}
          onFitPage={fitToPage}
        />
      </div>
    </div>
  );
}

// ── Zoom status-bar control ──────────────────────────────────────────────────
// −/percentage/+ cluster with a presets menu (Fit to width/page + 50–150%).
// Pure view state — it scales the on-screen page only; the .it source and the
// printed/PDF output are unaffected.
function ZoomControl({
  zoom,
  fitMode,
  onZoom,
  onFitWidth,
  onFitPage,
}: {
  zoom: number;
  fitMode: "none" | "width" | "page";
  onZoom: (z: number) => void;
  onFitWidth: () => void;
  onFitPage: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label =
    fitMode === "width"
      ? "Fit width"
      : fitMode === "page"
        ? "Fit page"
        : `${Math.round(zoom * 100)}%`;

  return (
    <div className="docs-zoom" ref={ref}>
      <button
        type="button"
        className="docs-zoom-btn"
        title="Zoom out (Ctrl/Cmd −)"
        aria-label="Zoom out"
        onClick={() => onZoom(zoom - ZOOM_STEP)}
        disabled={zoom <= MIN_ZOOM && fitMode === "none"}
      >
        −
      </button>
      <button
        type="button"
        className="docs-zoom-label"
        title="Zoom presets"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      <button
        type="button"
        className="docs-zoom-btn"
        title="Zoom in (Ctrl/Cmd +)"
        aria-label="Zoom in"
        onClick={() => onZoom(zoom + ZOOM_STEP)}
        disabled={zoom >= MAX_ZOOM && fitMode === "none"}
      >
        +
      </button>
      {open && (
        <div className="docs-zoom-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className={fitMode === "width" ? "is-active" : ""}
            onClick={() => {
              onFitWidth();
              setOpen(false);
            }}
          >
            Fit to width
          </button>
          <button
            type="button"
            role="menuitem"
            className={fitMode === "page" ? "is-active" : ""}
            onClick={() => {
              onFitPage();
              setOpen(false);
            }}
          >
            Fit to page
          </button>
          <div className="docs-zoom-sep" />
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              className={fitMode === "none" && zoom === p ? "is-active" : ""}
              onClick={() => {
                onZoom(p);
                setOpen(false);
              }}
            >
              {Math.round(p * 100)}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
