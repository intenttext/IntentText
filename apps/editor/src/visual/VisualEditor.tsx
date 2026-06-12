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
import Placeholder from "@tiptap/extension-placeholder";
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
import { DocsToolbar } from "./DocsToolbar";
import {
  getBuiltinTheme,
  generateThemeCSS,
  parseIntentText,
  documentStyleCSS,
} from "@intenttext/core";

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
  theme?: string;
}

export function VisualEditor({ value, onChange, theme }: Props) {
  const lastSourceRef = useRef<string>("");
  const isInternalUpdate = useRef(false);
  const isHydrating = useRef(true);
  // Styling that can't be saved to .it / won't print through core (regression guard).
  const [unsupported, setUnsupported] = useState<string[]>([]);
  // Current header/footer text for the page-break spacers (read live by the plugin).
  const layoutMetaRef = useRef<{ header: string; footer: string }>({
    header: "",
    footer: "",
  });

  const editor = useEditor({
    extensions: [
      Pagination.configure({
        pageHeight: 1123,
        marginTop: 96,
        marginBottom: 96,
        gap: 24,
        header: () => layoutMetaRef.current.header,
        footer: () => layoutMetaRef.current.footer,
      }),
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "itTitle") return "Document title";
          if (node.type.name === "itSection") return "Section heading";
          if (node.type.name === "itSub") return "Subsection heading";
          if (node.type.name === "itSummary") return "Document summary";
          return "Start typing...";
        },
      }),
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

  // Force light mode
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  // Multi-page: track content height and compute page count
  // A4: 210mm × 297mm. At 96 DPI → 794px × 1123px
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const PAGE_GAP = 24;
  const PAGE_MARGIN_TOP = 96;
  const PAGE_MARGIN_BOTTOM = 96;
  const PAGE_CONTENT_HEIGHT =
    PAGE_HEIGHT - PAGE_MARGIN_TOP - PAGE_MARGIN_BOTTOM;
  const PAGE_STRIDE = PAGE_HEIGHT + PAGE_GAP;
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  // Page breaks are handled natively by the Pagination plugin (real spacers that
  // push content to the next page — nothing is ever hidden). Here we only count the
  // spacers to show "N pages" in the footer.
  const recalcPages = useCallback(() => {
    const tiptap = pageRef.current?.querySelector(
      ".tiptap",
    ) as HTMLElement | null;
    if (!tiptap) return;
    const spacers = tiptap.querySelectorAll("[data-it-spacer]").length;
    setPageCount(spacers + 1);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const handler = () => requestAnimationFrame(recalcPages);
    editor.on("update", handler);
    handler();
    return () => {
      editor.off("update", handler);
    };
  }, [editor, recalcPages]);

  // Keep the spacer header/footer text in sync with the document.
  useEffect(() => {
    try {
      const doc = parseIntentText(value);
      layoutMetaRef.current = {
        header: doc.blocks.find((b) => b.type === "header")?.content || "",
        footer: doc.blocks.find((b) => b.type === "footer")?.content || "",
      };
    } catch {
      /* keep previous */
    }
  }, [value]);

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
      const metaBlock = doc.blocks.find((b) => b.type === "meta");
      const dir = String(metaBlock?.properties?.dir || "ltr").toLowerCase();
      return { header, footer, dir };
    } catch {
      return { header: "", footer: "", dir: "ltr" };
    }
  }, [value]);

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

  const toggleRtl = useCallback(() => {
    const isRtl = docLayoutMeta.dir === "rtl";
    if (isRtl) {
      // Remove dir: rtl pipe segment; drop line if it becomes empty
      const updated = value
        .split("\n")
        .map((line) => {
          if (/^meta:/i.test(line.trim())) {
            const cleaned = line.replace(/\s*\|\s*dir:\s*rtl/gi, "").trim();
            return cleaned === "meta:" ? null : cleaned;
          }
          return line;
        })
        .filter((l): l is string => l !== null)
        .join("\n");
      onChange(updated);
    } else {
      const metaMatch = /^meta:.*$/m.exec(value);
      if (metaMatch) {
        onChange(value.replace(/^meta:.*$/m, `${metaMatch[0]} | dir: rtl`));
      } else {
        // Insert after title or summary line, else prepend
        if (/^(title:|summary:)/m.test(value)) {
          onChange(
            value.replace(/^((?:title:|summary:).*)$/m, `$1\nmeta: | dir: rtl`),
          );
        } else {
          onChange(`meta: | dir: rtl\n${value}`);
        }
      }
    }
  }, [value, onChange, docLayoutMeta.dir]);

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

  // ── Zoom ─────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
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

  // Capture focal point at viewport center (for keyboard zoom)
  const captureFocalAtCenter = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    focalRef.current = {
      cx: el.scrollLeft + el.clientWidth / 2,
      cy: el.scrollTop + el.clientHeight / 2,
    };
  }, []);

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
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        captureFocalAtCenter();
        setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
      } else if (e.key === "-") {
        e.preventDefault();
        captureFocalAtCenter();
        setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)));
      } else if (e.key === "0") {
        e.preventDefault();
        captureFocalAtCenter();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [captureFocalAtCenter]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        captureFocalAtMouse(e);
        setZoom((z) => Math.min(2, Math.max(0.25, +(z + delta).toFixed(2))));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [captureFocalAtMouse]);

  return (
    <div className="docs-container">
      <DocsToolbar
        editor={editor}
        isRtl={docLayoutMeta.dir === "rtl"}
        onToggleRtl={toggleRtl}
      />
      {unsupported.length > 0 && (
        <div className="docs-fidelity-warning" role="status">
          ⚠ Some formatting ({unsupported.join(", ")}) can’t be saved to{" "}
          <code>.it</code> and won’t appear when printed through the template —
          remove it or use the toolbar’s color/size/style controls instead.
        </div>
      )}
      <div className="docs-canvas" ref={canvasRef}>
        <div
          className="docs-page-scaler"
          style={{ width: PAGE_WIDTH * zoom }}
        >
          <div
            className="docs-page-flow"
            dir={docLayoutMeta.dir}
            style={{
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "top left",
            }}
          >
            {/* One continuous sheet. The Pagination plugin inserts real page-break
                spacers (footer + gap + header) so content flows onto each page —
                nothing is hidden and the caret stays in document order. */}
            <div className="docs-page docs-sheet" ref={pageRef}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
        <div className="docs-page-footer">
          {pageCount} {pageCount === 1 ? "page" : "pages"} &middot;{" "}
          {getWordCount()} words
          {zoom !== 1 && (
            <span className="zoom-indicator">
              {" "}
              &middot; {Math.round(zoom * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
