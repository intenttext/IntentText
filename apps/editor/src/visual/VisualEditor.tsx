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

  const applyPagedLayout = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const tiptap = el.querySelector(".tiptap") as HTMLElement | null;
    if (!tiptap) return;

    // Collect shiftable blocks. Direct tiptap children are used, EXCEPT for
    // list containers (ol/ul) which are expanded into their <li> children so
    // that a long list spanning multiple pages has each item shifted individually
    // rather than the entire list being skipped as "too tall to shift".
    const collectBlocks = (): HTMLElement[] => {
      const result: HTMLElement[] = [];
      for (const child of Array.from(tiptap.children) as HTMLElement[]) {
        const tag = child.tagName.toLowerCase();
        if (tag === "ol" || tag === "ul") {
          for (const li of Array.from(child.children) as HTMLElement[]) {
            result.push(li as HTMLElement);
          }
        } else {
          result.push(child);
        }
      }
      return result;
    };

    // Reset ALL previously applied shifts (including li elements from prior passes).
    const allShifted = el.querySelectorAll(
      "[data-page-shift='1']",
    ) as NodeListOf<HTMLElement>;
    for (const shifted of allShifted) {
      shifted.style.marginTop = "";
      delete shifted.dataset.pageShift;
    }

    const tiptapRect = tiptap.getBoundingClientRect();
    const topInTiptap = (node: HTMLElement) =>
      node.getBoundingClientRect().top - tiptapRect.top;
    const bottomInTiptap = (node: HTMLElement) =>
      node.getBoundingClientRect().bottom - tiptapRect.top;

    // Re-collect each pass because shifting items changes subsequent positions.
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      const blocks = collectBlocks();
      if (blocks.length === 0) break;

      for (const block of blocks) {
        const top = topInTiptap(block);
        const bottom = bottomInTiptap(block);
        const blockHeight = bottom - top;
        if (blockHeight <= 0) continue;

        // `top` is measured in TipTap content coordinates (starts at content area,
        // not at the physical page top), so page bounds must use content-space math.
        const pageIndex = Math.floor(top / PAGE_STRIDE);
        const pageContentBottom = pageIndex * PAGE_STRIDE + PAGE_CONTENT_HEIGHT;
        if (bottom <= pageContentBottom) continue;

        // Skip blocks taller than a full content area — they genuinely cannot
        // be shifted onto a single page and must overflow naturally.
        if (blockHeight >= PAGE_CONTENT_HEIGHT) continue;

        const nextPageTop = (pageIndex + 1) * PAGE_STRIDE;
        const shift = Math.max(0, nextPageTop - top);
        if (shift > 0) {
          const nextMargin = `${shift}px`;
          if (block.style.marginTop !== nextMargin) {
            block.style.marginTop = nextMargin;
            block.dataset.pageShift = "1";
            changed = true;
          }
        }
      }

      if (!changed) break;
    }
  }, [PAGE_CONTENT_HEIGHT, PAGE_STRIDE]);

  const recalcPages = useCallback(() => {
    const el = pageRef.current;
    if (!el) return;
    const tiptap = el.querySelector(".tiptap") as HTMLElement | null;
    if (!tiptap) return;

    applyPagedLayout();

    const blocks = Array.from(tiptap.children) as HTMLElement[];
    const tiptapRect = tiptap.getBoundingClientRect();
    let lastBottom = 0;
    for (const block of blocks) {
      const bottom = block.getBoundingClientRect().bottom - tiptapRect.top;
      if (bottom > lastBottom) lastBottom = bottom;
    }

    const totalHeight = Math.max(tiptap.scrollHeight, lastBottom);
    const pages = Math.max(
      1,
      Math.ceil((totalHeight + PAGE_GAP) / (PAGE_CONTENT_HEIGHT + PAGE_GAP)),
    );
    setPageCount(pages);
  }, [PAGE_CONTENT_HEIGHT, PAGE_GAP, applyPagedLayout]);

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
      return generateThemeCSS(t).replace(
        /:root\{/,
        ".docs-page-sheet,.docs-page.docs-editor-layer{",
      );
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
            <div className="docs-page-stack">
              {Array.from({ length: pageCount }, (_, i) => {
                const pageTop = i * (PAGE_HEIGHT + PAGE_GAP);
                const pageNum = i + 1;
                return (
                  <div
                    key={`sheet-${i}`}
                    className="docs-page-sheet"
                    style={{ top: pageTop }}
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
                      <span className="docs-page-number">{pageNum}</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
