// TipTap extensions for IntentText block types
// Maps IT keywords to ProseMirror nodes rendered in a Google Docs-like editor

import { Node, mergeAttributes } from "@tiptap/core";
import { computeKeywordStyles } from "./keyword-styles";

// Helper: build inline style string from pipe properties
function buildStyle(keyword: string, props: Record<string, string>): string {
  const styles = computeKeywordStyles(keyword, props);
  return Object.entries(styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";");
}

// ── Title ─────────────────────────────────────────────────────
export const ITTitle = Node.create({
  name: "itTitle",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      props: {
        default: "{}",
        parseHTML: (el) => el.getAttribute("data-props") || "{}",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'h1[data-it-type="title"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "h1",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "title",
        class: "it-doc-title",
        style: buildStyle("title", props),
      }),
      0,
    ];
  },
});

// ── Summary ───────────────────────────────────────────────────
export const ITSummary = Node.create({
  name: "itSummary",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'p[data-it-type="summary"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "summary",
        class: "it-doc-summary",
        style: buildStyle("summary", props),
      }),
      0,
    ];
  },
});

// ── Section (H2) ─────────────────────────────────────────────
export const ITSection = Node.create({
  name: "itSection",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'h2[data-it-type="section"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "h2",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "section",
        class: "it-doc-section",
        style: buildStyle("section", props),
      }),
      0,
    ];
  },
});

// ── Sub (H3) ─────────────────────────────────────────────────
export const ITSub = Node.create({
  name: "itSub",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'h3[data-it-type="sub"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "h3",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "sub",
        class: "it-doc-sub",
        style: buildStyle("sub", props),
      }),
      0,
    ];
  },
});

// ── Callout (tip, info, warning, danger, success) ────────────
export const ITCallout = Node.create({
  name: "itCallout",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "tip",
        parseHTML: (el) => el.getAttribute("data-variant") || "tip",
        renderHTML: (attrs) => ({ "data-variant": attrs.variant }),
      },
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-it-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const variant = node.attrs.variant || "tip";
    const props = safeParse(node.attrs.props);
    const icons: Record<string, string> = {
      tip: "tip",
      info: "info",
      warning: "warning",
      danger: "danger",
      success: "success",
    };
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "callout",
        "data-variant": variant,
        class: `it-doc-callout it-doc-callout-${variant}`,
        style: buildStyle(variant, props),
      }),
      [
        "span",
        {
          class: `it-doc-callout-icon it-doc-callout-icon-${icons[variant] || "tip"}`,
          contenteditable: "false",
        },
        "",
      ],
      ["span", { class: "it-doc-callout-text" }, 0],
    ];
  },
});

// ── Quote ─────────────────────────────────────────────────────
export const ITQuote = Node.create({
  name: "itQuote",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      by: { default: "" },
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: 'blockquote[data-it-type="quote"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "blockquote",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "quote",
        class: "it-doc-quote",
        style: buildStyle("quote", props),
      }),
      0,
    ];
  },
});

// ── Code Block ────────────────────────────────────────────────
export const ITCode = Node.create({
  name: "itCode",
  group: "block",
  content: "text*",
  marks: "",
  code: true,
  defining: true,

  addAttributes() {
    return {
      lang: { default: "" },
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: "pre" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const props = safeParse(node.attrs.props);
    return [
      "pre",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "code",
        class: "it-doc-code",
        "data-lang": node.attrs.lang || "",
        style: buildStyle("code", props),
      }),
      ["code", 0],
    ];
  },
});

// ── Divider ───────────────────────────────────────────────────
export const ITDivider = Node.create({
  name: "itDivider",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "hr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["hr", mergeAttributes(HTMLAttributes, { class: "it-doc-divider" })];
  },
});

// ── Page Break ────────────────────────────────────────────────
export const ITBreak = Node.create({
  name: "itBreak",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-it-type="break"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "break",
        class: "it-doc-break",
      }),
    ];
  },
});

// ── Generic IT Block (for all other keywords) ─────────────────
// Renders as a styled chip/card with the keyword shown
export const ITGenericBlock = Node.create({
  name: "itGenericBlock",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      keyword: { default: "text" },
      properties: { default: "" },
      props: { default: "{}" },
    };
  },

  parseHTML() {
    return [{ tag: '[data-it-type="generic"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const kw = node.attrs.keyword;
    const props = safeParse(node.attrs.props);
    const linkTarget = String(
      props.to || props.url || props.href || props.file || "",
    ).trim();

    if ((kw === "link" || kw === "ref") && linkTarget) {
      return [
        "p",
        mergeAttributes(HTMLAttributes, {
          "data-it-type": "generic",
          "data-keyword": kw,
          class: `it-doc-generic it-doc-kw-${kw}`,
          style: buildStyle(kw, props),
        }),
        [
          "a",
          {
            class: "it-doc-inline-link",
            href: linkTarget,
            target: "_blank",
            rel: "noopener noreferrer",
          },
          0,
        ],
      ];
    }

    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "generic",
        "data-keyword": kw,
        class: `it-doc-generic it-doc-kw-${kw}`,
        style: buildStyle(kw, props),
      }),
      ["span", { class: "it-doc-generic-content" }, 0],
    ];
  },
});

// ── Comment line (// comments in IT source) ───────────────────
export const ITComment = Node.create({
  name: "itComment",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: 'p[data-it-type="comment"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, {
        "data-it-type": "comment",
        class: "it-doc-comment",
      }),
      0,
    ];
  },
});

// ── Helpers ────────────────────────────────────────────────────
function safeParse(val: string): Record<string, string> {
  try {
    return typeof val === "string" ? JSON.parse(val) : val || {};
  } catch {
    return {};
  }
}
