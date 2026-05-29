// Keyword Style Map — Maps IT pipe properties to CSS
// When user writes: text: Hello | align: center | color: #555
// The editor applies matching CSS styles in real time.
// Unknown properties are silently ignored and preserved.

export type StyleProperty =
  | "align"
  | "color"
  | "bgcolor"
  | "size"
  | "weight"
  | "style"
  | "border"
  | "padding"
  | "indent"
  | "opacity"
  | "radius"
  | "shadow"
  | "width"
  | "height"
  | "spacing"
  | "columns"
  | "font"
  | "leading"
  | "striped"
  | "icon"
  | "blur"
  | "angle"
  | "family"
  | "margins";

interface StyleRule {
  property: StyleProperty;
  css: string; // CSS property name
  transform?: (v: string) => string; // optional value transform
}

// Build style map: keyword → array of rules
function direct(property: StyleProperty, css: string): StyleRule {
  return { property, css };
}

// Common property sets reused across keywords
const TEXT_STYLES: StyleRule[] = [
  direct("align", "textAlign"),
  direct("color", "color"),
  direct("size", "fontSize"),
  direct("weight", "fontWeight"),
  { property: "style", css: "fontStyle" },
  direct("bgcolor", "backgroundColor"),
  direct("padding", "padding"),
  direct("indent", "paddingLeft"),
  direct("opacity", "opacity"),
];

const CALLOUT_STYLES: StyleRule[] = [
  direct("bgcolor", "backgroundColor"),
  direct("color", "color"),
  direct("border", "borderLeft"),
];

const CHIP_STYLES: StyleRule[] = [
  direct("color", "borderColor"),
  direct("bgcolor", "backgroundColor"),
];

export const KEYWORD_STYLES: Record<string, StyleRule[]> = {
  // ── Identity ──
  title: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    direct("weight", "fontWeight"),
    direct("font", "fontFamily"),
  ],
  summary: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
  ],

  // ── Structure ──
  section: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    direct("weight", "fontWeight"),
    direct("border", "borderBottom"),
    direct("spacing", "marginTop"),
  ],
  sub: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    direct("weight", "fontWeight"),
  ],
  divider: [
    { property: "style", css: "borderStyle" },
    direct("color", "borderColor"),
    direct("width", "borderTopWidth"),
    direct("spacing", "margin"),
  ],

  // ── Content ──
  text: [...TEXT_STYLES],
  tip: [...CALLOUT_STYLES],
  info: [...CALLOUT_STYLES],
  warning: [...CALLOUT_STYLES],
  danger: [...CALLOUT_STYLES],
  success: [...CALLOUT_STYLES],
  quote: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
    direct("border", "borderLeft"),
    direct("padding", "paddingLeft"),
    direct("bgcolor", "backgroundColor"),
  ],
  cite: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
  ],
  def: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "borderLeft"),
    direct("padding", "paddingLeft"),
  ],
  caption: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
  ],
  footnote: [direct("color", "color"), direct("size", "fontSize")],
  byline: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
    direct("weight", "fontWeight"),
  ],
  epigraph: [
    direct("align", "textAlign"),
    direct("color", "color"),
    direct("size", "fontSize"),
    { property: "style", css: "fontStyle" },
    direct("padding", "padding"),
  ],
  dedication: [
    direct("align", "textAlign"),
    direct("color", "color"),
    { property: "style", css: "fontStyle" },
    direct("padding", "padding"),
  ],

  // ── Media ──
  image: [
    direct("width", "width"),
    direct("height", "height"),
    direct("radius", "borderRadius"),
    direct("border", "border"),
    direct("opacity", "opacity"),
    direct("bgcolor", "backgroundColor"),
    {
      property: "shadow",
      css: "boxShadow",
      transform: () => "0 4px 12px rgba(0,0,0,0.15)",
    },
  ],
  figure: [
    direct("width", "width"),
    direct("align", "textAlign"),
    direct("border", "border"),
    direct("padding", "padding"),
    direct("bgcolor", "backgroundColor"),
    {
      property: "shadow",
      css: "boxShadow",
      transform: () => "0 4px 12px rgba(0,0,0,0.15)",
    },
  ],
  link: [direct("color", "color"), direct("weight", "fontWeight")],
  ref: [direct("color", "color"), { property: "style", css: "fontStyle" }],
  embed: [
    direct("width", "width"),
    direct("height", "height"),
    direct("border", "border"),
    direct("radius", "borderRadius"),
  ],

  // ── Data ──
  metric: [
    direct("color", "color"),
    direct("size", "fontSize"),
    direct("align", "textAlign"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "border"),
    direct("padding", "padding"),
  ],
  columns: [
    direct("border", "border"),
    direct("bgcolor", "backgroundColor"),
    direct("padding", "padding"),
    direct("size", "fontSize"),
    direct("align", "textAlign"),
  ],
  row: [
    direct("border", "border"),
    direct("bgcolor", "backgroundColor"),
    direct("padding", "padding"),
    direct("size", "fontSize"),
    direct("align", "textAlign"),
  ],
  input: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "borderLeft"),
    direct("size", "fontSize"),
  ],
  output: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "borderLeft"),
    direct("size", "fontSize"),
  ],

  // ── Code ──
  code: [
    direct("size", "fontSize"),
    direct("bgcolor", "backgroundColor"),
    direct("color", "color"),
    direct("padding", "padding"),
    direct("radius", "borderRadius"),
    direct("border", "border"),
  ],

  // ── Contact ──
  contact: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "border"),
    direct("padding", "padding"),
    direct("size", "fontSize"),
  ],
  deadline: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("weight", "fontWeight"),
    direct("size", "fontSize"),
  ],

  // ── Agent workflow chips ──
  step: [...CHIP_STYLES],
  decision: [...CHIP_STYLES],
  gate: [...CHIP_STYLES],
  trigger: [...CHIP_STYLES],
  loop: [...CHIP_STYLES],
  parallel: [...CHIP_STYLES],
  call: [...CHIP_STYLES],
  wait: [...CHIP_STYLES],
  checkpoint: [...CHIP_STYLES],
  error: [...CHIP_STYLES],
  result: [...CHIP_STYLES],
  audit: [...CHIP_STYLES],
  signal: [...CHIP_STYLES],
  handoff: [...CHIP_STYLES],
  retry: [...CHIP_STYLES],
  progress: [...CHIP_STYLES],
  tool: [...CHIP_STYLES],
  prompt: [...CHIP_STYLES],
  memory: [...CHIP_STYLES],
  policy: [...CHIP_STYLES],
  context: [...CHIP_STYLES],

  // ── Trust badges ──
  track: [...CHIP_STYLES],
  approve: [...CHIP_STYLES],
  sign: [...CHIP_STYLES],
  freeze: [...CHIP_STYLES],
  revision: [...CHIP_STYLES],
  amendment: [...CHIP_STYLES],
  history: [direct("color", "borderColor")],

  // ── v2.13 ──
  assert: [
    direct("color", "borderColor"),
    direct("bgcolor", "backgroundColor"),
    direct("border", "borderLeft"),
  ],
  secret: [
    direct("color", "color"),
    direct("bgcolor", "backgroundColor"),
    direct("blur", "filter"),
  ],

  // ── Layout ──
  watermark: [
    direct("color", "color"),
    direct("size", "fontSize"),
    direct("opacity", "opacity"),
  ],
  signline: [direct("color", "color"), direct("width", "width")],
};

/**
 * Build a CSSProperties-like object from a block's pipe properties.
 * Unknown properties are silently ignored.
 */
export function computeKeywordStyles(
  blockType: string,
  properties: Record<string, string>,
): Record<string, string> {
  const rules = KEYWORD_STYLES[blockType];
  if (!rules) return {};

  const styles: Record<string, string> = {};

  for (const rule of rules) {
    const value = properties[rule.property];
    if (!value) continue;

    if (rule.transform) {
      styles[rule.css] = rule.transform(value);
    } else {
      styles[rule.css] = value;
    }
  }

  return styles;
}

/**
 * Returns which style properties are recognised for a given keyword.
 * Used by editor autocomplete to suggest pipe properties.
 */
export function getStyleProperties(blockType: string): StyleProperty[] {
  return (KEYWORD_STYLES[blockType] ?? []).map((r) => r.property);
}
