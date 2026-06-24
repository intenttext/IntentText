/**
 * IntentText → Markdown converter (pure JS; Node + browser).
 *
 * The inverse of `convertMarkdownToIntentText`. Produces clean, GitHub-flavored
 * Markdown: headings, paragraphs, lists, task lists, tables, fenced code, blockquotes,
 * images and links map 1:1. Typed blocks that have no Markdown equivalent (metric,
 * sign, approve, and any custom domain keyword) degrade to a readable **`keyword:`**
 * labeled line, so the semantic content is preserved even though the typing is flattened.
 *
 * Round-trips with the Markdown importer for the shared subset: a Markdown document
 * converted to `.it` and back is structurally identical.
 */
import { parseIntentText } from "./parser";
import type { IntentBlock } from "./types";

/** Fallback: convert IntentText inline marks in a RAW string → Markdown. */
function inlineToMarkdown(s: string): string {
  if (!s) return "";
  let r = s;
  r = r.replace(/\*([^*\n]+)\*/g, "**$1**"); // *x* (IT bold) → **x**
  r = r.replace(/(^|[^\w_])_([^_\n]+)_(?![\w_])/g, "$1*$2*"); // _x_ → *x*
  r = r.replace(/~([^~\n]+)~/g, "~~$1~~"); // ~x~ → ~~x~~
  return r;
}

/**
 * Render parsed inline nodes → Markdown. The parser strips marks from `content` into
 * `inline` nodes, so this is the faithful path; `inlineToMarkdown` is only a fallback for
 * blocks without parsed inline (e.g. table cells).
 */
function renderInlineNodes(
  nodes: Array<{ type: string; value?: string; href?: string }>,
): string {
  let s = "";
  for (const n of nodes) {
    const v = String(n.value ?? "");
    switch (n.type) {
      // empty marks (e.g. from a stray `**` written in Markdown style) emit nothing
      case "bold": s += v ? `**${v}**` : ""; break;
      case "italic": s += v ? `*${v}*` : ""; break;
      case "strike": s += v ? `~~${v}~~` : ""; break;
      case "highlight": s += v ? `==${v}==` : ""; break;
      case "label": case "code": s += `\`${v}\``; break; // inline code
      case "link": s += `[${v}](${n.href ?? ""})`; break;
      case "mention": s += `@${v}`; break;
      case "tag": s += `#${v}`; break;
      case "footnote": case "footnote-ref": s += `[^${v}]`; break;
      case "text": default: s += v; break; // text, date, badge, sidenote, styled → literal
    }
  }
  return s;
}

/** Markdown for a block's text: prefer parsed inline nodes, fall back to raw content. */
function mdInline(b: IntentBlock): string {
  const inline = (b as { inline?: Array<{ type: string; value?: string; href?: string }> }).inline;
  if (Array.isArray(inline) && inline.length) return renderInlineNodes(inline);
  return inlineToMarkdown(b.content || "");
}

/** Format leftover properties (excluding the ones already rendered) as a quiet suffix. */
function propsSuffix(
  props: Record<string, unknown> | undefined,
  skip: string[],
): string {
  if (!props) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (skip.includes(k) || k === "keyword") continue;
    if (v == null || v === "") continue;
    parts.push(`${k}: ${v}`);
  }
  return parts.length ? ` _(${parts.join(", ")})_` : "";
}

function tableToMarkdown(t: {
  headers?: string[];
  rows?: string[][];
}): string {
  const headers = t.headers ?? [];
  const rows = t.rows ?? [];
  const width = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const pad = (cells: string[]) => {
    const c = cells.slice();
    while (c.length < width) c.push("");
    return `| ${c.map((x) => inlineToMarkdown(String(x ?? "")).trim()).join(" | ")} |`;
  };
  const head = headers.length ? headers : Array(width).fill("");
  const lines = [pad(head), `| ${Array(width).fill("---").join(" | ")} |`];
  for (const r of rows) lines.push(pad(r));
  return lines.join("\n");
}

export interface ItToMarkdownOptions {
  /** Drop document-metadata blocks (meta/track/agent/model/context). Default true. */
  dropMetadata?: boolean;
}

export function convertIntentTextToMarkdown(
  source: string,
  options: ItToMarkdownOptions = {},
): string {
  if (typeof source !== "string" || source.length === 0) return "";
  const dropMetadata = options.dropMetadata !== false;
  const doc = parseIntentText(source);

  const out: string[] = [];
  let stepCounter = 0; // for ordered (step-item) lists

  const push = (s: string) => out.push(s);
  const blank = () => {
    if (out.length && out[out.length - 1] !== "") out.push("");
  };

  // Document-metadata and pure print/layout directives have no Markdown equivalent and
  // are not content — drop them so the output is clean prose, not presentation noise.
  const DROP = new Set([
    "meta", "track", "agent", "model", "context",
    "page", "header", "footer", "watermark", "toc", "break", "style", "font",
  ]);

  const emit = (b: IntentBlock): void => {
    const type = b.type;
    const content = mdInline(b);
    const props = b.properties as Record<string, unknown> | undefined;

    // list grouping: only step-items increment; reset the counter on anything else.
    if (type !== "step-item") stepCounter = 0;

    switch (type) {
      case "title":
        blank();
        push(`# ${content}`);
        blank();
        return;
      case "summary":
        push(`_${content}_`);
        blank();
        return;
      case "section":
        blank();
        push(`## ${content}`);
        blank();
        return;
      case "sub":
        blank();
        push(`### ${content}`);
        blank();
        return;
      case "text":
        blank();
        push(content);
        blank();
        return;
      case "quote": {
        const by = props?.by ? ` — *${props.by}*` : "";
        blank();
        push(`> ${content}${by}`);
        blank();
        return;
      }
      case "info": {
        const kind = props?.type ? `**${String(props.type)}:** ` : "";
        blank();
        push(`> ${kind}${content}`);
        blank();
        return;
      }
      case "code": {
        const lang = props?.lang ? String(props.lang) : "";
        blank();
        push("```" + lang);
        push(b.content || ""); // raw, no inline conversion
        push("```");
        blank();
        return;
      }
      case "image":
        blank();
        push(`![${content}](${props?.src ?? ""})`);
        blank();
        return;
      case "link":
        blank();
        push(`[${content}](${props?.to ?? props?.href ?? ""})`);
        blank();
        return;
      case "task":
        push(`- [ ] ${content}${propsSuffix(props, [])}`);
        return;
      case "done":
        push(`- [x] ${content}${propsSuffix(props, ["at"])}`);
        return;
      case "list-item":
        push(`- ${content}`);
        return; // children are the text echo — do not recurse
      case "step-item":
        push(`${++stepCounter}. ${content}`);
        return;
      case "table":
        blank();
        push(tableToMarkdown((b as { table?: { headers?: string[]; rows?: string[][] } }).table ?? {}));
        blank();
        return;
      case "divider":
        blank();
        push("---");
        blank();
        return;
      case "metric": {
        const value = props?.value != null ? ` ${props.value}` : "";
        const unit = props?.unit != null ? ` ${props.unit}` : "";
        push(`**${content}:**${value}${unit}${propsSuffix(props, ["value", "unit"])}`);
        return;
      }
      case "custom": {
        const kw = props?.keyword ? String(props.keyword) : "custom";
        blank();
        push(`**${kw}:** ${content}${propsSuffix(props, [])}`);
        blank();
        return;
      }
      default: {
        // Any other typed block (sign, approve, freeze, certify, cite, deadline, contact,
        // step, decision, …): keep it as a labeled line so no information is lost.
        if (dropMetadata && DROP.has(type)) return;
        blank();
        push(`**${type}:** ${content}${propsSuffix(props, [])}`);
        blank();
        return;
      }
    }
  };

  const walk = (blocks: IntentBlock[] | undefined): void => {
    for (const b of blocks || []) {
      emit(b);
      // recurse into structural children, but not into list items (their children just
      // echo the content) or tables (rendered from b.table).
      if (
        b.children &&
        b.type !== "list-item" &&
        b.type !== "step-item" &&
        b.type !== "table"
      ) {
        walk(b.children);
      }
    }
  };

  walk(doc.blocks);

  // collapse 3+ blank lines to one, trim trailing blanks, end with a single newline.
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
  return text + "\n";
}
