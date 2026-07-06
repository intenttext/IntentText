/**
 * visibility.ts — the invisible-content defense ("what you see is what was signed").
 *
 * The content hash proves the TEXT is unchanged; it says NOTHING about whether that
 * text is visible. Styling can hide a signed clause — `color: transparent`, white
 * text on the white page, `size: 0` — so a reviewer sees a clean document, verify
 * reports "intact", and a hidden waiver is still enforceable. This module answers one
 * question — "does this styling render the content invisible?" — for three callers:
 *   • the renderer's visibility guard, which drops the offending declaration so the
 *     text is forced visible in HTML / print / PDF (same-block signals only, so a
 *     legit dark section is never disturbed);
 *   • verifyDocument, which walks the whole document tracking inherited background
 *     and surfaces a `hiddenContent` signal so a verifier is warned WITHOUT rendering;
 *   • the trust band, which shows that signal to a human.
 *
 * Deliberately conservative: only UNAMBIGUOUS invisibility is flagged, so faint-but-
 * readable styling never trips a false positive (a false "hidden" erodes trust in the
 * tool as surely as a missed one).
 */
import type { IntentBlock } from "./types";
import { effectiveProperties } from "./defaults";

/** The default page/paper background every theme renders on. */
export const DEFAULT_PAGE_BG = "#ffffff";

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// A small, deliberate set of named colors — the common "hide it on a white page"
// values plus the primaries. Unknown names resolve to null (treated as opaque and
// non-matching), so an exotic name never produces a false "hidden".
const NAMED_RGBA: Record<string, RGBA> = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
  green: { r: 0, g: 128, b: 0, a: 1 },
  blue: { r: 0, g: 0, b: 255, a: 1 },
  gray: { r: 128, g: 128, b: 128, a: 1 },
  grey: { r: 128, g: 128, b: 128, a: 1 },
  silver: { r: 192, g: 192, b: 192, a: 1 },
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const clamp255 = (n: number) => clamp(Math.round(n), 0, 255);

function parseAlpha(s: string): number {
  if (s.endsWith("%")) return clamp(parseFloat(s) / 100, 0, 1);
  const n = parseFloat(s);
  return Number.isNaN(n) ? 1 : clamp(n, 0, 1);
}

function hslToRgb(h: number, s: number, l: number): Omit<RGBA, "a"> {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = clamp255(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clamp255(hue(p, q, h + 1 / 3) * 255),
    g: clamp255(hue(p, q, h) * 255),
    b: clamp255(hue(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Parse a CSS color to RGBA. Returns null for values we cannot resolve — they are
 * then treated as opaque and non-matching, so an unknown value is never a false
 * "hidden". Supports named set, #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba(), hsl()/hsla().
 */
export function parseColor(input: unknown): RGBA | null {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (s === "") return null;
  if (s in NAMED_RGBA) return NAMED_RGBA[s];

  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const a = h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1;
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
        a,
      };
    }
    if (h.length === 6 || h.length === 8) {
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a,
      };
    }
    return null;
  }

  const fn = s.match(/^(rgba?|hsla?)\(([^)]+)\)$/);
  if (fn) {
    const parts = fn[2].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const a = parts[3] != null ? parseAlpha(parts[3]) : 1;
    if (fn[1].startsWith("rgb")) {
      const r = clamp255(parseFloat(parts[0]));
      const g = clamp255(parseFloat(parts[1]));
      const b = clamp255(parseFloat(parts[2]));
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return { r, g, b, a };
    }
    const hh = parseFloat(parts[0]);
    const ss = clamp(parseFloat(parts[1]) / 100, 0, 1);
    const ll = clamp(parseFloat(parts[2]) / 100, 0, 1);
    if ([hh, ss, ll].some((n) => Number.isNaN(n))) return null;
    return { ...hslToRgb(hh, ss, ll), a };
  }

  return null;
}

/** Alpha (0..1) of a color; 1 when unknown or opaque. */
export function colorAlpha(input: unknown): number {
  const c = parseColor(input);
  return c ? c.a : 1;
}

/**
 * Two colors resolve to the same visible pixel — both opaque, RGB within a small
 * epsilon (so `#fff` == `white` == `rgb(255,255,255)`). Transparency is handled
 * separately by `colorAlpha`, so two transparent colors do NOT "match" here.
 */
export function colorsMatch(a: unknown, b: unknown): boolean {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb || ca.a === 0 || cb.a === 0) return false;
  const near = (x: number, y: number) => Math.abs(x - y) <= 8; // ≈3% of 255
  return near(ca.r, cb.r) && near(ca.g, cb.g) && near(ca.b, cb.b);
}

/** A font-size value that renders text effectively invisible (0 or near-zero). */
export function sizeIsInvisible(input: unknown): boolean {
  if (input == null) return false;
  const m = String(input)
    .trim()
    .toLowerCase()
    .match(/^(-?\d*\.?\d+)\s*(px|pt|em|rem|%)?$/);
  if (!m) return false;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return false;
  if (n <= 0) return true;
  switch (m[2]) {
    case "pt":
      return n < 3;
    case "em":
    case "rem":
      return n < 0.3;
    case "%":
      return n < 25;
    default: // px or unitless
      return n < 4;
  }
}

export interface HiddenVerdict {
  hidden: boolean;
  reason?: string;
}

/**
 * Does this block's EFFECTIVE styling render its content invisible, given the
 * background it renders on? `inheritedBg` is the effective background cascaded from
 * ancestors (defaults to the white page). A block's own `bg:` overrides it.
 */
export function styleHidesContent(
  props: Record<string, string | number>,
  inheritedBg: string = DEFAULT_PAGE_BG,
): HiddenVerdict {
  const color = props.color;
  const bg =
    props.bg != null && String(props.bg).trim() !== ""
      ? props.bg
      : inheritedBg;
  if (color != null && String(color).trim() !== "") {
    if (colorAlpha(color) === 0)
      return { hidden: true, reason: "text color is transparent" };
    if (colorsMatch(color, bg))
      return { hidden: true, reason: "text color matches the background" };
  }
  if (props.opacity != null) {
    const o = parseFloat(String(props.opacity));
    if (!Number.isNaN(o) && o < 0.1)
      return { hidden: true, reason: "near-zero opacity" };
  }
  if (props.size != null && sizeIsInvisible(props.size))
    return { hidden: true, reason: "near-zero font size" };
  return { hidden: false };
}

export interface HiddenContentItem {
  /** The block keyword (as written) or type, for a human-readable report. */
  type: string;
  /** Why it is hidden ("text color is transparent", …). */
  reason: string;
  /** A short excerpt of the concealed text. */
  snippet: string;
}

export interface HiddenContentResult {
  hidden: boolean;
  items: HiddenContentItem[];
}

/** Style/directive properties that affect visibility. */
const VIS_PROPS = ["color", "bg", "size", "opacity"] as const;

// Blocks that carry no document content of their own — directives (`style:`, `agent:`,
// `model:`) that render nothing. They must not be flagged as "hidden content" (their
// own text is a selector/config, not signed prose) but a `style:` rule DOES affect the
// blocks it targets — collected separately below.
const NON_CONTENT_TYPES = new Set(["style", "agent", "model"]);

/**
 * Walk a parsed document and report every content-bearing block whose EFFECTIVE
 * styling renders it invisible. "Effective" folds in document-level `style:` rules
 * (`style: text | color: white` hides every text block), so a hide smuggled in via a
 * directive is caught at seal time — not only a post-seal restyle. A block's own
 * inline styling overrides a rule (inline wins, as in the renderer). Inherited
 * background cascades to nested children, and the root is the white page — there is no
 * dark-page feature to falsely flag against (the renderer always prints black-on-white).
 */
export function findHiddenContent(blocks: IntentBlock[]): HiddenContentResult {
  // Collect document-level style: rules by target block type (text, quote, section…).
  const rules = new Map<string, Record<string, string>>();
  const collect = (list: IntentBlock[]) => {
    for (const b of list) {
      if (b.type === "style" && b.content && b.properties) {
        const target = String(b.content).trim().toLowerCase();
        const decl: Record<string, string> = {};
        for (const k of VIS_PROPS) {
          if (b.properties[k] != null) decl[k] = String(b.properties[k]);
        }
        if (Object.keys(decl).length)
          rules.set(target, { ...(rules.get(target) ?? {}), ...decl });
      }
      if (b.children?.length) collect(b.children);
    }
  };
  collect(blocks);

  const items: HiddenContentItem[] = [];
  const walk = (list: IntentBlock[], inheritedBg: string) => {
    for (const b of list) {
      if (NON_CONTENT_TYPES.has(b.type)) continue;
      const own = effectiveProperties(b);
      // A style: rule for this block type, overridden by the block's own inline props.
      const eff: Record<string, string | number> = {
        ...(rules.get(b.type) ?? {}),
        ...own,
      };
      const myBg =
        eff.bg != null && String(eff.bg).trim() !== ""
          ? String(eff.bg)
          : inheritedBg;
      const text = (b.content ?? "").trim();
      if (text !== "") {
        const v = styleHidesContent(eff, inheritedBg);
        if (v.hidden) {
          items.push({
            type: b.keywordAlias ?? b.type,
            reason: v.reason as string,
            snippet: text.length > 60 ? text.slice(0, 57) + "…" : text,
          });
        }
      }
      if (b.children?.length) walk(b.children, myBg);
    }
  };
  walk(blocks, DEFAULT_PAGE_BG);
  return { hidden: items.length > 0, items };
}
