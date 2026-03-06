/**
 * IntentText Theme System — v2.10
 *
 * Themes are JSON-based design value sets applied by the renderer.
 * The .it format never changes. Themes are purely a renderer concern.
 * Built-in themes ship as JSON files in src/themes/.
 */

import corporateJson from "./themes/corporate.json";
import minimalJson from "./themes/minimal.json";
import warmJson from "./themes/warm.json";
import technicalJson from "./themes/technical.json";
import printJson from "./themes/print.json";
import legalJson from "./themes/legal.json";
import editorialJson from "./themes/editorial.json";
import darkJson from "./themes/dark.json";

export interface ThemeFonts {
  body: string;
  heading: string;
  mono: string;
  size: string;
  leading: string;
}

export interface ThemeColors {
  text: string;
  heading: string;
  muted: string;
  accent: string;
  border: string;
  background: string;
  "code-bg": string;
  "trust-approved"?: string;
  "trust-signed"?: string;
  "trust-frozen"?: string;
  "trust-warning"?: string;
  watermark?: string;
  [key: string]: string | undefined;
}

export interface ThemeSpacing {
  "page-margin": string;
  "section-gap": string;
  "block-gap": string;
  indent: string;
}

export interface ThemePrint {
  "header-font-size"?: string;
  "footer-font-size"?: string;
  "header-color"?: string;
  "footer-color"?: string;
}

export interface IntentTheme {
  name: string;
  version: string;
  description?: string;
  author?: string;
  fonts: ThemeFonts;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  blocks?: Record<string, Record<string, string | boolean>>;
  print?: ThemePrint;
}

/** Map of built-in theme names to their JSON data. */
const BUILTIN_THEMES: Record<string, IntentTheme> = {};

/** Register a built-in theme (called at module load). */
export function registerBuiltinTheme(theme: IntentTheme): void {
  BUILTIN_THEMES[theme.name] = theme;
}

/** Get a built-in theme by name. Returns undefined if not found. */
export function getBuiltinTheme(name: string): IntentTheme | undefined {
  return BUILTIN_THEMES[name];
}

/** List all built-in theme names. */
export function listBuiltinThemes(): string[] {
  return Object.keys(BUILTIN_THEMES);
}

/** Resolve a color value — if it matches a theme color key, return that color. */
function resolveColor(value: string, colors: ThemeColors): string {
  if (value in colors) return colors[value] ?? value;
  return value;
}

/** Font stack helper: append generic fallback families. */
function fontStack(font: string, type: "body" | "heading" | "mono"): string {
  if (type === "mono") return `'${font}', monospace`;
  return `${font}, system-ui, sans-serif`;
}

/**
 * Generate CSS custom properties and block styles from a theme.
 * Mode controls which additional styles to include.
 */
export function generateThemeCSS(
  theme: IntentTheme,
  mode: "web" | "print" = "web",
): string {
  const c = theme.colors;
  const f = theme.fonts;
  const s = theme.spacing;
  const p = theme.print;

  // CSS custom properties
  let css = `:root{`;
  css += `--it-font-body:${fontStack(f.body, "body")};`;
  css += `--it-font-heading:${fontStack(f.heading, "heading")};`;
  css += `--it-font-mono:${fontStack(f.mono, "mono")};`;
  css += `--it-font-size:${f.size};`;
  css += `--it-leading:${f.leading};`;
  for (const [key, val] of Object.entries(c)) {
    if (val !== undefined) css += `--it-color-${key}:${val};`;
  }
  css += `--it-spacing-page-margin:${s["page-margin"]};`;
  css += `--it-spacing-section-gap:${s["section-gap"]};`;
  css += `--it-spacing-block-gap:${s["block-gap"]};`;
  css += `--it-spacing-indent:${s.indent};`;
  css += `}\n`;

  // Apply custom properties to the document
  css += `.intent-document{font-family:var(--it-font-body);font-size:var(--it-font-size);line-height:var(--it-leading);color:var(--it-color-text);background:var(--it-color-background);}\n`;
  css += `.intent-title,.intent-section,.intent-sub{font-family:var(--it-font-heading);color:var(--it-color-heading);}\n`;
  css += `.intent-section{margin-top:var(--it-spacing-section-gap);}\n`;
  css += `.intent-note,.intent-prose{margin-bottom:var(--it-spacing-block-gap);}\n`;
  css += `code,.intent-code{font-family:var(--it-font-mono);background:var(--it-color-code-bg);}\n`;
  css += `.intent-summary{border-left-color:var(--it-color-muted);color:var(--it-color-muted);}\n`;
  css += `.intent-divider-line{border-color:var(--it-color-border);}\n`;

  // Block-level styles from theme
  if (theme.blocks) {
    for (const [blockType, styles] of Object.entries(theme.blocks)) {
      const selector = `.intent-${blockType}`;
      const declarations: string[] = [];
      for (const [prop, val] of Object.entries(styles)) {
        if (typeof val === "boolean") {
          if (val && prop === "border-bottom")
            declarations.push(`border-bottom:1px solid var(--it-color-border)`);
        } else {
          // Resolve color references
          const resolved = resolveColor(val, c);
          declarations.push(`${prop}:${resolved}`);
        }
      }
      if (declarations.length > 0) {
        css += `${selector}{${declarations.join(";")}}\n`;
      }
    }
  }

  // Print-specific styles
  if (mode === "print" && p) {
    const hColor = p["header-color"] ? resolveColor(p["header-color"], c) : "";
    const fColor = p["footer-color"] ? resolveColor(p["footer-color"], c) : "";
    if (p["header-font-size"] || hColor) {
      let decl = "";
      if (p["header-font-size"]) decl += `font-size:${p["header-font-size"]};`;
      if (hColor) decl += `color:${hColor};`;
      css += `@page{@top-left{${decl}}@top-center{${decl}}@top-right{${decl}}}\n`;
    }
    if (p["footer-font-size"] || fColor) {
      let decl = "";
      if (p["footer-font-size"]) decl += `font-size:${p["footer-font-size"]};`;
      if (fColor) decl += `color:${fColor};`;
      css += `@page{@bottom-left{${decl}}@bottom-center{${decl}}@bottom-right{${decl}}}\n`;
    }
  }

  return css;
}

// ── Register built-in themes from JSON files ────────────

registerBuiltinTheme(corporateJson as IntentTheme);
registerBuiltinTheme(minimalJson as IntentTheme);
registerBuiltinTheme(warmJson as IntentTheme);
registerBuiltinTheme(technicalJson as IntentTheme);
registerBuiltinTheme(printJson as IntentTheme);
registerBuiltinTheme(legalJson as IntentTheme);
registerBuiltinTheme(editorialJson as IntentTheme);
registerBuiltinTheme(darkJson as IntentTheme);
