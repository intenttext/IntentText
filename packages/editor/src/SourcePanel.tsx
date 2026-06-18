import {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { ALIAS_MAP } from "@dotit/core";

// An EDITABLE, live view of the underlying .it source — shown on demand in the
// margin beside the page, so you can edit the source and watch the visual/bare
// view update (and vice-versa) WITHOUT a separate Source mode. It is built as a
// transparent <textarea> over a syntax-highlighted <pre>, so editing keeps the
// TRUST COLOURING live as you type. React escapes all text, so building the
// highlight layer from raw source is XSS-safe. Resizable by dragging its edge.
//
// Shared by web + desktop + embedded (a host opens it beside any surface).
//
// TRUST COLOURING (the highlight layer):
//  - CONTENT (strong ink): text, fields, structure, emphasis — what gets signed.
//  - STYLING (gray italic): style:/page:/font: lines, presentation properties
//    (colour/size/font/align/bg/theme/…), comments — dropped from signed content.
//  - SEAL (green): sign/freeze/approve/… — the trust record itself.

const canonicalKeyword = (tok: string): string =>
  ALIAS_MAP[tok] ?? ALIAS_MAP[tok.toLowerCase()] ?? tok.toLowerCase();

const PRESENTATION_KEYWORDS = new Set(["style", "page", "font"]);
const TRUST_KEYWORDS = new Set([
  "sign",
  "freeze",
  "certify",
  "amendment",
  "approve",
  "approval",
]);
const PRESENTATION_PROPS = new Set([
  "color",
  "size",
  "family",
  "align",
  "bg",
  "indent",
  "leading",
  "space-before",
  "space-after",
  "opacity",
  "border",
  "valign",
  "theme",
  "margin",
  "margins",
  "orientation",
  "width",
  "height",
]);

const KEYWORD = /^(\s*)([A-Za-z][\w-]*)(:)/;
const LEAD = /^\s*([^\s:|]+)\s*:/;
const propKey = (seg: string): string => {
  const m = seg.match(/^\s*([A-Za-z][\w-]*)\s*:/);
  return m ? m[1].toLowerCase() : "";
};

function ContentLine({ text }: { text: string }) {
  const segments = text.split("|");
  const nodes: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (i > 0)
      nodes.push(
        <span className="sp-sep" key={`sep${i}`}>
          |
        </span>,
      );
    if (i === 0) {
      const m = seg.match(KEYWORD);
      if (m) {
        nodes.push(
          <span key={`seg${i}`}>
            {m[1]}
            <span className="sp-kw">{m[2]}</span>
            {m[3]}
            {seg.slice(m[0].length)}
          </span>,
        );
      } else {
        nodes.push(<span key={`seg${i}`}>{seg}</span>);
      }
    } else if (PRESENTATION_PROPS.has(propKey(seg))) {
      nodes.push(
        <span className="sp-seg-pres" key={`seg${i}`}>
          {seg}
        </span>,
      );
    } else {
      nodes.push(<span key={`seg${i}`}>{seg}</span>);
    }
  });
  return <span className="sp-line">{nodes}</span>;
}

function Line({ text }: { text: string }) {
  if (text === "") return <span className="sp-line">{" "}</span>;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("//"))
    return <span className="sp-line sp-pres">{text}</span>;

  const lead = text.match(LEAD);
  const canon = lead ? canonicalKeyword(lead[1]) : "";
  if (canon && TRUST_KEYWORDS.has(canon))
    return <span className="sp-line sp-trust">{text}</span>;
  if (canon && PRESENTATION_KEYWORDS.has(canon))
    return <span className="sp-line sp-pres">{text}</span>;
  return <ContentLine text={text} />;
}

const WIDTH_KEY = "it-source-panel-w";
const MIN_W = 280;

export interface SourcePanelProps {
  source: string;
  onChange: (next: string) => void;
  onClose: () => void;
}

export function SourcePanel({ source, onChange, onClose }: SourcePanelProps) {
  const lines = useMemo(() => source.split("\n"), [source]);
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep the highlight layer scrolled in lock-step with the textarea.
  const syncScroll = useCallback(() => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  }, []);

  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(saved) && saved >= MIN_W ? saved : 460;
  });
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drag.current = { startX: e.clientX, startW: width };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      const maxW = Math.max(MIN_W, window.innerWidth * 0.8);
      const next = Math.min(
        maxW,
        Math.max(MIN_W, drag.current.startW + (drag.current.startX - e.clientX)),
      );
      setWidth(next);
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(WIDTH_KEY, String(width));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  return (
    <aside
      className="source-panel"
      aria-label="Live source"
      style={{ flex: `0 0 ${width}px`, maxWidth: "80%" }}
    >
      <div
        className="source-panel__resize"
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
      />
      <header className="source-panel__head">
        <span className="source-panel__title">
          <span className="source-panel__glyph">{"</>"}</span> Source
          <span className="source-panel__live" title="Editable — updates live">
            live
          </span>
        </span>
        <button
          className="source-panel__close"
          onClick={onClose}
          title="Close source panel"
          aria-label="Close source panel"
        >
          ✕
        </button>
      </header>
      <div className="source-panel__legend" aria-hidden="true">
        <span className="sp-leg">
          <i className="sp-leg-dot sp-leg-content" /> signed content
        </span>
        <span className="sp-leg">
          <i className="sp-leg-dot sp-leg-pres" /> styling (ignored)
        </span>
        <span className="sp-leg">
          <i className="sp-leg-dot sp-leg-trust" /> seal
        </span>
      </div>
      <div className="source-panel__editor">
        <pre className="source-panel__code" ref={preRef} aria-hidden="true">
          {lines.map((ln, i) => (
            <Line key={i} text={ln} />
          ))}
          {"\n"}
        </pre>
        <textarea
          ref={taRef}
          className="source-panel__input"
          value={source}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="soft"
          aria-label="Edit .it source"
        />
      </div>
    </aside>
  );
}
