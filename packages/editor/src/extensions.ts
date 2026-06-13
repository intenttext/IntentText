// TipTap extensions for IntentText block types
// Maps IT keywords to ProseMirror nodes rendered in a Google Docs-like editor

import { Node, mergeAttributes } from "@tiptap/core";
import { computeKeywordStyles } from "./keyword-styles";

// Helper: build inline style string from pipe properties
function buildStyle(keyword: string, props: Record<string, string>): string {
  const styles = computeKeywordStyles(keyword, props);
  // Word-parity spacing — universal core style props on every block type,
  // mirroring core's STYLE_PROPERTIES (leading/space-before/space-after).
  if (props.leading) styles.lineHeight = props.leading;
  if (props["space-before"]) styles.marginTop = props["space-before"];
  if (props["space-after"]) styles.marginBottom = props["space-after"];
  return Object.entries(styles)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}:${v}`)
    .join(";");
}

// Two-sided row (`end:` property — core renders it on title/section/sub/text):
// expose the end value as data-it-end so CSS turns the block into a flex
// split row (`.it-split` parity) with the value as generated content.
function endAttrs(props: Record<string, string>): Record<string, string> {
  return props.end ? { "data-it-end": props.end } : {};
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
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-it-type": "title",
      class: "it-doc-title",
      style: buildStyle("title", props),
      ...endAttrs(props),
    });
    return props.end
      ? ["h1", attrs, ["span", { class: "it-split-main" }, 0]]
      : ["h1", attrs, 0];
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
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-it-type": "section",
      class: "it-doc-section",
      style: buildStyle("section", props),
      ...endAttrs(props),
    });
    return props.end
      ? ["h2", attrs, ["span", { class: "it-split-main" }, 0]]
      : ["h2", attrs, 0];
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
    const attrs = mergeAttributes(HTMLAttributes, {
      "data-it-type": "sub",
      class: "it-doc-sub",
      style: buildStyle("sub", props),
      ...endAttrs(props),
    });
    return props.end
      ? ["h3", attrs, ["span", { class: "it-split-main" }, 0]]
      : ["h3", attrs, 0];
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

// ── Metadata chip ─────────────────────────────────────────────
// Document-level metadata/layout lines (page:, meta:, font:, header:, …) shown as
// a subtle preserved chip instead of raw body text. `raw` holds the exact source
// line for round-trip.
export const ITMeta = Node.create({
  name: "itMeta",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw") || "",
        renderHTML: (attrs) => ({ "data-raw": attrs.raw }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-it-meta]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const raw = String(node.attrs.raw || "").replace(/\s*\|\s*/g, " · ");
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-it-meta": "", class: "it-doc-meta" }),
      `⚙ ${raw}`,
    ];
  },
});

// ── Table ─────────────────────────────────────────────────────
// Pipe table. `rows` is a JSON string of string[][] (first row = headers).
// An atom node (so the table is one round-trippable unit), but a NodeView makes
// every cell `contenteditable`: users click into headers/rows and edit the text
// directly. Each edit writes the updated grid back to the `rows` attr, so
// docToSource re-emits `| a | b |` lines with the new content. Enter/Tab are
// swallowed inside cells so they don't break the document structure.
function parseRows(raw: string): string[][] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const ITTable = Node.create({
  name: "itTable",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      rows: {
        default: "[]",
        parseHTML: (el) => el.getAttribute("data-rows") || "[]",
        renderHTML: (attrs) => ({ "data-rows": attrs.rows }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "table[data-it-table]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const rows = parseRows(node.attrs.rows);
    const head = rows[0] || [];
    const body = rows.slice(1);
    return [
      "table",
      mergeAttributes(HTMLAttributes, {
        "data-it-table": "",
        class: "it-doc-table",
      }),
      [
        "thead",
        ["tr", ...head.map((c) => ["th", tableCellAttrs(c), String(c)])],
      ],
      [
        "tbody",
        ...body.map((r) => [
          "tr",
          ...r.map((c) => ["td", tableCellAttrs(c), String(c)]),
        ]),
      ],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const table = document.createElement("table");
      table.className = "it-doc-table";
      table.setAttribute("data-it-table", "");
      const thead = document.createElement("thead");
      const tbody = document.createElement("tbody");
      table.append(thead, tbody);

      let rows = parseRows(node.attrs.rows);

      // Push the in-DOM cell text back into the node's `rows` attr.
      const commit = () => {
        const next: string[][] = [];
        table.querySelectorAll("tr").forEach((tr) => {
          const r: string[] = [];
          tr.querySelectorAll("th,td").forEach((c) =>
            r.push((c.textContent || "").trim()),
          );
          next.push(r);
        });
        const json = JSON.stringify(next);
        if (json === node.attrs.rows) return;
        rows = next;
        if (typeof getPos === "function") {
          const pos = getPos();
          if (pos == null) return;
          const tr = editor.view.state.tr.setNodeAttribute(pos, "rows", json);
          editor.view.dispatch(tr);
        }
      };

      const makeCell = (tag: "th" | "td", text: string) => {
        const cell = document.createElement(tag);
        cell.textContent = text;
        const editable = editor.isEditable;
        cell.contentEditable = editable ? "true" : "false";
        if (/\{\{[^}]+\}\}|^each:/.test(String(text).trim()))
          cell.className = "it-doc-var-cell";
        cell.addEventListener("blur", commit);
        cell.addEventListener("keydown", (e) => {
          // Keep cell text single-line; Enter/Tab must not split the document.
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
        });
        return cell;
      };

      const render = (grid: string[][]) => {
        thead.innerHTML = "";
        tbody.innerHTML = "";
        const head = grid[0] || [];
        const htr = document.createElement("tr");
        head.forEach((c) => htr.appendChild(makeCell("th", String(c))));
        thead.appendChild(htr);
        grid.slice(1).forEach((row) => {
          const tr = document.createElement("tr");
          row.forEach((c) => tr.appendChild(makeCell("td", String(c))));
          tbody.appendChild(tr);
        });
      };
      render(rows);

      return {
        dom: table,
        // Re-render only when the attr changed from OUTSIDE this view (e.g.
        // source-mode edit), not from our own commit, to keep the caret stable.
        update(updated) {
          if (updated.type.name !== "itTable") return false;
          if (updated.attrs.rows !== JSON.stringify(rows)) {
            rows = parseRows(updated.attrs.rows);
            render(rows);
          }
          return true;
        },
        // The cells own the selection while editing; let ProseMirror ignore
        // mutations inside the contenteditable cells.
        ignoreMutation: () => true,
      };
    };
  },
});

/** Template cells ({{var}} or each:) get the variable-chip highlight. */
function tableCellAttrs(cell: string): Record<string, string> {
  return /\{\{[^}]+\}\}|^each:/.test(String(cell).trim())
    ? { class: "it-doc-var-cell" }
    : {};
}

// ── Trust block (sign / seal / approve / freeze / amendment) ──
// Renders tamper-evidence lines as proper styled chips instead of leaking raw
// `| at: …` props. The exact source line is preserved in `raw` and re-emitted
// verbatim on docToSource so the document hash never changes from a round-trip.
function parseTrustLine(raw: string): {
  keyword: string;
  content: string;
  props: Record<string, string>;
} {
  const colon = raw.indexOf(":");
  const keyword = (colon >= 0 ? raw.slice(0, colon) : raw).trim().toLowerCase();
  const rest = colon >= 0 ? raw.slice(colon + 1).trim() : "";
  const segs = rest.split("|").map((s) => s.trim());
  const content = segs.shift() || "";
  const props: Record<string, string> = {};
  for (const seg of segs) {
    const c = seg.indexOf(":");
    if (c > 0) props[seg.slice(0, c).trim().toLowerCase()] = seg.slice(c + 1).trim();
  }
  return { keyword, content, props };
}

export const ITTrust = Node.create({
  name: "itTrust",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw") || "",
        renderHTML: (attrs) => ({ "data-raw": attrs.raw }),
      },
      keyword: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-trust") || "",
        renderHTML: (attrs) => ({ "data-trust": attrs.keyword }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-it-trust]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    // Ink-first typesetting, exactly mirroring core's print design
    // (document-css.ts .it-approval / .it-signature / .it-sealed-banner):
    // hairlines + small-caps labels, no colored fills - editor display = print.
    const { keyword, content, props } = parseTrustLine(
      String(node.attrs.raw || ""),
    );
    const role = props.role || props.title || "";
    const date = (props.at || props.date || props.time || "").slice(0, 10);
    const parts: (string | (string | object)[])[] = [];

    if (keyword === "seal" || keyword === "freeze") {
      // SEALED band - thin top+bottom rules, mono hash (core .it-sealed-banner).
      const hash =
        (keyword === "seal" ? content || props.hash : props.hash) || "";
      parts.push(["span", { class: "it-doc-trust__label" }, "Sealed document"]);
      if (date) parts.push(["span", { class: "it-doc-trust__date" }, date]);
      if (hash)
        parts.push([
          "code",
          { class: "it-doc-trust__hash" },
          hash.length > 20 ? hash.slice(0, 20) + "..." : hash,
        ]);
    } else if (keyword === "approve") {
      // Single hairline row: CHECK APPROVED | what | who | date(right) - the
      // check mark comes from CSS ::before, matching core's .it-approval__label.
      const who = props.by || content;
      const what = props.by ? content : "";
      parts.push(["span", { class: "it-doc-trust__label" }, "Approved"]);
      if (what) parts.push(["span", { class: "it-doc-trust__what" }, what]);
      if (who)
        parts.push([
          "span",
          { class: "it-doc-trust__who" },
          role ? `${who}, ${role}` : who,
        ]);
      if (date) parts.push(["span", { class: "it-doc-trust__date" }, date]);
    } else if (keyword === "amend" || keyword === "amendment") {
      parts.push(["span", { class: "it-doc-trust__label" }, "Amendment"]);
      if (content)
        parts.push(["span", { class: "it-doc-trust__what" }, content]);
      if (date) parts.push(["span", { class: "it-doc-trust__date" }, date]);
    } else {
      // sign - a signature rule line (core .it-signature): hairline rule on
      // top, name / role / date with a status flag at the line end.
      const name = content || props.by || "";
      const valid = !!props.hash;
      parts.push(["span", { class: "it-doc-trust__name" }, name]);
      if (role) parts.push(["span", { class: "it-doc-trust__role" }, role]);
      if (date) parts.push(["span", { class: "it-doc-trust__date" }, date]);
      parts.push([
        "span",
        { class: "it-doc-trust__status" },
        valid ? "Signed \u00b7 verified" : "Signed",
      ]);
    }

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-it-trust": "",
        "data-trust": keyword,
        class: `it-doc-trust it-doc-trust--${keyword}`,
      }),
      ...parts,
    ];
  },
});

// ── Metric / total row ────────────────────────────────────────
// `metric: Subtotal | value: 16,500 QAR | unit: …` renders as a label-left /
// value-right row (invoice totals, KPIs). The generic block dropped `value:`
// entirely. Raw source preserved verbatim for round-trip.
export const ITMetric = Node.create({
  name: "itMetric",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw") || "",
        renderHTML: (attrs) => ({ "data-raw": attrs.raw }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-it-metric]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const { content, props } = parseTrustLine(String(node.attrs.raw || ""));
    const value = [props.value, props.unit].filter(Boolean).join(" ");
    // A "total"/"grand total"/"balance due" label reads as the summary line.
    const isTotal = /\b(total|balance due|amount due|grand)\b/i.test(content);
    const valueIsVar = /\{\{[^}]+\}\}/.test(value);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-it-metric": "",
        class: `it-doc-metric${isTotal ? " it-doc-metric--total" : ""}`,
      }),
      ["span", { class: "it-doc-metric__label" }, content],
      [
        "span",
        { class: `it-doc-metric__value${valueIsVar ? " it-doc-var" : ""}` },
        value,
      ],
    ];
  },
});

// ── Scoped document style rule ────────────────────────────────
// `style: section | color: #0a7 | weight: 600` — house styling declared once,
// document-wide. Shown as a visible chip (target + declarations) so authors can
// SEE the rule; VisualEditor applies it live to the canvas via documentStyleCSS.
// Raw line preserved verbatim for round-trip.
export const ITStyleRule = Node.create({
  name: "itStyleRule",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      raw: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-raw") || "",
        renderHTML: (attrs) => ({ "data-raw": attrs.raw }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-it-style-rule]" }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const { content, props } = parseTrustLine(String(node.attrs.raw || ""));
    const decl = Object.entries(props)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-it-style-rule": "",
        class: "it-doc-stylerule",
      }),
      ["span", { class: "it-doc-stylerule__icon" }, "🎨"],
      ["span", { class: "it-doc-stylerule__target" }, content || "?"],
      ["span", { class: "it-doc-stylerule__decl" }, decl],
    ];
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
