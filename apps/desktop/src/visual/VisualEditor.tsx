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
import { sourceToDoc, docToSource } from "./bridge";
import {
  ITTitle,
  ITSummary,
  ITSection,
  ITSub,
  ITCallout,
  ITQuote,
  ITCode,
  ITDivider,
  ITBreak,
  ITGenericBlock,
  ITComment,
} from "./extensions";
import { DocsToolbar } from "./DocsToolbar";
import { getBuiltinTheme, generateThemeCSS } from "@intenttext/core";

interface Props {
  value: string;
  onChange: (source: string) => void;
  theme?: string;
}

export function VisualEditor({ value, onChange, theme }: Props) {
  const lastSourceRef = useRef<string>("");
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
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
      ITBreak,
      ITGenericBlock,
      ITComment,
    ],
    content: sourceToDoc(value),
    onUpdate: ({ editor: ed }) => {
      const source = docToSource(ed.getJSON());
      lastSourceRef.current = source;
      isInternalUpdate.current = true;
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

  // Multi-page: track content height and compute page count
  // A4: 210mm × 297mm. At 96 DPI → 794px × 1123px
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const pageRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);

  const recalcPages = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const tiptap = el.querySelector(".tiptap") as HTMLElement | null;
    if (!tiptap) return;
    // Content height = tiptap's scrollHeight + top/bottom padding (96 each)
    const totalHeight = tiptap.scrollHeight + 192;
    setPageCount(Math.max(1, Math.ceil(totalHeight / PAGE_HEIGHT)));
  }, []);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(recalcPages);
    observer.observe(el);
    // Also observe the tiptap element itself for content growth
    const tiptap = el.querySelector(".tiptap");
    if (tiptap) observer.observe(tiptap);
    return () => observer.disconnect();
  }, [recalcPages]);

  // Also recalculate pages on every editor update
  useEffect(() => {
    if (!editor) return;
    editor.on("update", recalcPages);
    return () => {
      editor.off("update", recalcPages);
    };
  }, [editor, recalcPages]);

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
      <DocsToolbar editor={editor} />
      <div className="docs-canvas" ref={canvasRef}>
        <div
          className="docs-page-scaler"
          style={{
            width: PAGE_WIDTH * zoom,
            minHeight: (pageCount * PAGE_HEIGHT + (pageCount - 1) * 24) * zoom,
          }}
        >
          <div
            className="docs-page"
            ref={pageRef}
            style={{
              minHeight: pageCount * PAGE_HEIGHT,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "top left",
            }}
          >
            <EditorContent editor={editor} />
            {Array.from({ length: pageCount - 1 }, (_, i) => {
              const breakY = (i + 1) * PAGE_HEIGHT;
              return (
                <div
                  key={i}
                  className="docs-page-gap-overlay"
                  style={{ top: breakY - 12 }}
                />
              );
            })}
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
