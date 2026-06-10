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
  ITTable,
  ITMeta,
  ITBreak,
  ITGenericBlock,
  ITComment,
} from "./extensions";
import { DocsToolbar } from "./DocsToolbar";
import {
  getBuiltinTheme,
  generateThemeCSS,
  parseIntentText,
} from "@intenttext/core";

interface Props {
  value: string;
  onChange: (source: string) => void;
  theme?: string;
}

export function VisualEditor({ value, onChange, theme }: Props) {
  const lastSourceRef = useRef<string>("");
  const isInternalUpdate = useRef(false);
  const isHydrating = useRef(true);

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
      ITTable,
      ITMeta,
      ITBreak,
      ITGenericBlock,
      ITComment,
    ],
    content: sourceToDoc(value),
    onUpdate: ({ editor: ed }) => {
      // Avoid rewriting source while editor is still hydrating initial content.
      if (isHydrating.current) return;
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

  // Paginate content into real pages so every page has header + footer space.
  // Each top-level block that would straddle a page's content area is pushed down
  // (margin-top) to start on the next page — content never renders into the
  // header/footer/gap "dead zones". This is the same idea as Word/Docs.
  //
  // The KEY fix vs the old version: after re-paginating we scroll the caret back
  // into view, so typing near a page boundary never goes blind.
  const applyPagedLayout = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const tiptap = el.querySelector(".tiptap") as HTMLElement | null;
    if (!tiptap) return;

    const collectBlocks = (): HTMLElement[] => {
      const out: HTMLElement[] = [];
      for (const child of Array.from(tiptap.children) as HTMLElement[]) {
        const tag = child.tagName.toLowerCase();
        if (tag === "ol" || tag === "ul") {
          for (const li of Array.from(child.children) as HTMLElement[])
            out.push(li);
        } else out.push(child);
      }
      return out;
    };

    // Reset previous shifts.
    for (const s of Array.from(
      el.querySelectorAll("[data-page-shift='1']"),
    ) as HTMLElement[]) {
      s.style.marginTop = "";
      delete s.dataset.pageShift;
    }

    const tiptapTop = tiptap.getBoundingClientRect().top;
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const block of collectBlocks()) {
        const r = block.getBoundingClientRect();
        const top = r.top - tiptapTop;
        const bottom = r.bottom - tiptapTop;
        const h = bottom - top;
        if (h <= 0 || h >= PAGE_CONTENT_HEIGHT) continue; // too tall to fit a page
        const pageIndex = Math.floor(top / PAGE_STRIDE);
        const pageContentBottom = pageIndex * PAGE_STRIDE + PAGE_CONTENT_HEIGHT;
        if (bottom <= pageContentBottom) continue; // fits on its page
        const shift = (pageIndex + 1) * PAGE_STRIDE - top;
        if (shift > 0) {
          block.style.marginTop = `${shift}px`;
          block.dataset.pageShift = "1";
          changed = true;
        }
      }
      if (!changed) break;
    }
  }, [PAGE_CONTENT_HEIGHT, PAGE_STRIDE]);

  const recalcPages = useCallback(() => {
    const el = pageRef.current;
    const tiptap = el?.querySelector(".tiptap") as HTMLElement | null;
    if (!tiptap) return;
    applyPagedLayout();
    const totalHeight = tiptap.scrollHeight;
    const pages = Math.max(1, Math.ceil(totalHeight / PAGE_STRIDE));
    setPageCount(pages);
    // Keep the caret visible after content re-flows across page boundaries.
    if (editor?.isFocused) editor.commands.scrollIntoView();
  }, [applyPagedLayout, PAGE_STRIDE, editor]);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalcPages);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    const tiptap = el.querySelector(".tiptap");
    if (tiptap) observer.observe(tiptap);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [recalcPages]);

  // Re-paginate on every editor update.
  useEffect(() => {
    if (!editor) return;
    const handler = () => requestAnimationFrame(recalcPages);
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
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
      <div className="docs-canvas" ref={canvasRef}>
        <div
          className="docs-page-scaler"
          style={{
            width: PAGE_WIDTH * zoom,
            minHeight:
              (pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP) * zoom,
          }}
        >
          <div
            className="docs-page-flow"
            dir={docLayoutMeta.dir}
            style={{
              minHeight: pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: "top left",
              ["--it-page-height" as string]: `${PAGE_HEIGHT}px`,
              ["--it-page-gap" as string]: `${PAGE_GAP}px`,
              ["--it-page-margin-top" as string]: `${PAGE_MARGIN_TOP}px`,
              ["--it-page-margin-bottom" as string]: `${PAGE_MARGIN_BOTTOM}px`,
            }}
          >
            {/* Page frames: every page has reserved header + footer space. */}
            <div className="docs-page-stack" aria-hidden="true">
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={`sheet-${i}`}
                  className="docs-page-sheet"
                  style={{ top: i * (PAGE_HEIGHT + PAGE_GAP) }}
                >
                  <div className="docs-page-header-region">
                    <span className="docs-page-meta-text">
                      {docLayoutMeta.header}
                    </span>
                  </div>
                  <div className="docs-page-footer-region">
                    <span className="docs-page-meta-text">
                      {docLayoutMeta.footer}
                    </span>
                    <span className="docs-page-number">{i + 1}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Editable content, paginated to skip the header/footer dead zones. */}
            <div
              className="docs-page docs-editor-layer"
              ref={pageRef}
              style={{
                minHeight: pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP,
              }}
            >
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
