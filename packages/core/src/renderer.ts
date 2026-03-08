import { IntentBlock, IntentDocument, InlineNode, PrintLayout } from "./types";
import { IntentTheme, getBuiltinTheme, generateThemeCSS } from "./theme";

export interface RenderOptions {
  /** Theme name (built-in) or IntentTheme object */
  theme?: string | IntentTheme;
}

function resolveThemeSync(ref: string | IntentTheme): IntentTheme | undefined {
  if (typeof ref === "object") return ref;
  return getBuiltinTheme(ref);
}

// v2.9: Paper size to CSS @page size mapping
const PAPER_SIZES: Record<string, string> = {
  A4: "A4",
  A5: "A5",
  A3: "297mm 420mm",
  Letter: "Letter",
  Legal: "8.5in 14in",
};

/** v2.9: Collect print layout blocks from a document. */
export function collectPrintLayout(doc: IntentDocument): PrintLayout {
  const allBlocks = doc.blocks.flatMap(function collect(
    b: IntentBlock,
  ): IntentBlock[] {
    return [b, ...(b.children ?? []).flatMap(collect)];
  });
  return {
    page: allBlocks.find((b) => b.type === "page"),
    header: allBlocks.filter((b) => b.type === "header").pop(),
    footer: allBlocks.filter((b) => b.type === "footer").pop(),
    watermark: allBlocks.filter((b) => b.type === "watermark").pop(),
    breaks: allBlocks.filter(
      (b) => b.type === "break" && (b.properties?.before || b.properties?.keep),
    ),
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Format an ISO timestamp for trust block display.
 */
function formatTrustDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const day = d.getUTCDate();
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch {
    return escapeHtml(isoStr);
  }
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return "";

  // Allow safe common schemes + relative URLs + fragment links.
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();

  // Block dangerous schemes explicitly
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:")
  ) {
    return "#";
  }

  // Allow bare relative paths like "logo.png" or "assets/banner.png".
  // Block any value that looks like it declares a scheme (e.g. "javascript:").
  if (!lower.includes(":") && !lower.startsWith("//")) {
    return trimmed;
  }

  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return trimmed;
  }

  return "#";
}

// Apply inline AST nodes to produce safe HTML.
// Falls back to escaping plain content when no inline nodes are present.
function applyInlineFormatting(
  content: string,
  inline?: InlineNode[],
  originalContent?: string,
): string {
  if (inline && inline.length > 0) {
    return inline
      .map((node) => {
        switch (node.type) {
          case "text":
            return escapeHtml(node.value);
          case "bold":
            return `<strong>${escapeHtml(node.value)}</strong>`;
          case "italic":
            return `<em>${escapeHtml(node.value)}</em>`;
          case "strike":
            return `<del>${escapeHtml(node.value)}</del>`;
          case "inline-quote":
            return `<q class="intent-inline-quote">${escapeHtml(node.value)}</q>`;
          case "highlight":
            return `<mark class="intent-inline-highlight">${escapeHtml(node.value)}</mark>`;
          case "code":
            return `<code>${escapeHtml(node.value)}</code>`;
          case "inline-note":
            return `<span class="intent-inline-note">${escapeHtml(node.value)}</span>`;
          case "date":
            return `<time class="intent-inline-date" datetime="${escapeHtml(node.iso)}">${escapeHtml(node.value)}</time>`;
          case "mention":
            return `<span class="intent-inline-mention">@${escapeHtml(node.value)}</span>`;
          case "tag":
            return `<span class="intent-inline-tag">#${escapeHtml(node.value)}</span>`;
          case "link":
            return `<a href="${escapeHtml(sanitizeUrl(node.href))}" class="intent-inline-link">${escapeHtml(node.value)}</a>`;
          case "footnote-ref":
            return `<sup class="it-fn-ref"><a href="#fn-${escapeHtml(node.value)}">${escapeHtml(node.value)}</a></sup>`;
          case "label":
            return `<span class="it-label">${escapeHtml(node.value)}</span>`;
          default:
            return escapeHtml((node as { value: string }).value);
        }
      })
      .join("");
  }

  return escapeHtml(originalContent || content);
}

function getAlignmentClass(props: Record<string, string | number>): string {
  const raw = String(props.align || "")
    .toLowerCase()
    .trim();
  if (raw === "center") return " intent-align-center";
  if (raw === "right") return " intent-align-right";
  if (raw === "justify") return " intent-align-justify";
  return "";
}

// v2.8.1: Known style properties that map to CSS
const STYLE_PROPERTIES: Record<string, string> = {
  color: "color",
  size: "font-size",
  family: "font-family",
  weight: "font-weight",
  align: "text-align",
  bg: "background-color",
  indent: "padding-left",
  opacity: "opacity",
  italic: "font-style",
  border: "border",
};

function extractInlineStyles(
  properties: Record<string, string | number>,
): string {
  const styles: string[] = [];
  for (const [prop, css] of Object.entries(STYLE_PROPERTIES)) {
    const value = properties[prop];
    if (value === undefined || value === "") continue;
    const strValue = String(value);
    if (prop === "border" && strValue === "true") {
      styles.push("border: 1px solid currentColor");
    } else if (prop === "italic" && strValue === "true") {
      styles.push("font-style: italic");
    } else {
      styles.push(`${css}: ${strValue}`);
    }
  }
  return styles.join("; ");
}

// Helper function to render a single block
function renderBlock(block: IntentBlock): string {
  // Pre-section metadata keywords — invisible in rendered output
  if (
    block.type === ("agent" as string) ||
    block.type === ("model" as string)
  ) {
    return "";
  }

  const content = applyInlineFormatting(
    block.content,
    block.inline,
    block.originalContent,
  );
  const props = block.properties || {};
  const alignClass = getAlignmentClass(props);
  const inlineStyle = extractInlineStyles(props);
  const styleAttr = inlineStyle ? ` style="${inlineStyle}"` : "";

  switch (block.type) {
    case "title":
      return `<h1 class="intent-title${alignClass}"${styleAttr}>${content}</h1>`;

    case "summary":
      return `<div class="intent-summary${alignClass}"${styleAttr}>${content}</div>`;

    case "section":
      return `<h2 id="${slugify(block.content)}" class="intent-section${alignClass}"${styleAttr}>${content}</h2>`;

    case "sub":
      return `<h3 id="${slugify(block.content)}" class="intent-sub${alignClass}"${styleAttr}>${content}</h3>`;

    case "divider":
      const dividerStyle = props.style ? String(props.style) : "solid";
      const label = content
        ? `<span class="intent-divider-label">${content}</span>`
        : "";
      return `<div class="intent-divider">
        <hr class="it-divider" style="border-style: ${dividerStyle}" />
        ${label}
      </div>`;

    case "text":
      return `<p class="intent-text${alignClass}"${styleAttr}>${content}</p>`;
    case "body-text":
      return `<p class="intent-prose${alignClass}"${styleAttr}>${content}</p>`;

    case "info":
      return `<div class="intent-callout intent-info"${styleAttr}><span class="intent-callout-label">Note</span><div class="intent-callout-content">${content}</div></div>`;

    case "warning":
      return `<div class="intent-callout intent-warning"${styleAttr}><span class="intent-callout-label">Caution</span><div class="intent-callout-content">${content}</div></div>`;

    case "tip":
      return `<div class="intent-callout intent-tip"${styleAttr}><span class="intent-callout-label">Tip</span><div class="intent-callout-content">${content}</div></div>`;

    case "success":
      return `<div class="intent-callout intent-success"${styleAttr}><span class="intent-callout-label">Done</span><div class="intent-callout-content">${content}</div></div>`;

    case "danger":
      return `<div class="it-callout it-danger" role="alert"><span class="it-callout-icon" aria-hidden="true">⛔</span><div class="it-callout-body">${content}</div></div>`;

    case "task":
    case "done": {
      // "done" kept as legacy fallback for pre-1.1 JSON
      const isDone = props.status === "done" || block.type === "done";
      return `<div class="intent-task${isDone ? " intent-task-done" : ""}">
        <input class="intent-task-checkbox" type="checkbox"${isDone ? " checked" : ""} />
        <span class="intent-task-text${isDone ? " intent-task-text-done" : ""}">${content}</span>
        <span class="intent-task-meta">
          ${props.owner ? `<span class="intent-task-owner">${escapeHtml(String(props.owner))}</span>` : ""}
          ${props.due ? `<span class="intent-task-due">${escapeHtml(String(props.due))}</span>` : ""}
          ${props.time ? `<span class="intent-task-time">${escapeHtml(String(props.time))}</span>` : ""}
        </span>
      </div>`;
    }

    case "ask":
      return `<div class="intent-ask"><span class="intent-ask-label">Query</span><div class="intent-ask-content">${content}</div></div>`;

    case "quote": {
      const attribution = props.by
        ? `<cite class="intent-quote-cite">— ${escapeHtml(String(props.by))}</cite>`
        : "";
      return `<blockquote class="intent-quote"><p>${content}</p>${attribution}</blockquote>`;
    }

    case "cite": {
      const citeAuthor = props.author
        ? `<span class="it-cite-author">${escapeHtml(String(props.author))}</span>`
        : "";
      const citeDate = props.date
        ? `<span class="it-cite-date">${escapeHtml(String(props.date))}</span>`
        : "";
      const citeUrl = props.url
        ? ` href="${escapeHtml(sanitizeUrl(String(props.url)))}"`
        : "";
      const citeTitle = citeUrl
        ? `<a class="it-cite-title"${citeUrl} target="_blank" rel="noopener noreferrer">${content}</a>`
        : `<span class="it-cite-title">${content}</span>`;
      return `<div class="it-cite">${citeTitle}${citeAuthor ? ` — ${citeAuthor}` : ""}${citeDate ? `, ${citeDate}` : ""}</div>`;
    }

    case "image":
      const imgSrc = escapeHtml(
        sanitizeUrl(String(props.at || "")) || String(props.at || content),
      );
      const imgAlt = content;
      return `<figure class="intent-image">
        <img class="intent-image-img" src="${imgSrc}" alt="${imgAlt}" />
        ${props.caption ? `<figcaption class="intent-image-caption">${escapeHtml(String(props.caption))}</figcaption>` : ""}
      </figure>`;

    case "link":
      const href = escapeHtml(sanitizeUrl(String(props.to || content)));
      const titleAttr = props.title
        ? `title="${escapeHtml(String(props.title))}"`
        : "";
      return `<p class="intent-link"><a href="${href}" ${titleAttr}>${content}</a></p>`;

    case "ref": {
      const refFile = props.file ? String(props.file) : "";
      const refUrl = props.url ? String(props.url) : "";
      const refRel = props.rel ? escapeHtml(String(props.rel)) : "";
      const refHref = refFile
        ? escapeHtml(sanitizeUrl(refFile))
        : refUrl
          ? escapeHtml(sanitizeUrl(refUrl))
          : "";
      const refName = escapeHtml(block.content || refFile || refUrl);
      const relBadge = refRel
        ? `<span class="it-ref-rel">${refRel}</span>`
        : "";
      const linkEl = refHref
        ? `<a href="${refHref}" class="it-ref-link">${refName}</a>`
        : `<span class="it-ref-name">${refName}</span>`;
      return `<div class="it-ref-card">
        <span class="it-ref-icon">📎</span>
        ${linkEl}
        ${relBadge}
      </div>`;
    }

    case "embed": {
      const embedType = props.type || "iframe";
      const src = String(props.src || "");
      const embedContent = String(props.content || "");

      switch (embedType) {
        case "iframe":
          return `<div class="intent-embed"><iframe src="${escapeHtml(sanitizeUrl(src))}" frameborder="0" loading="lazy" style="width:100%;min-height:400px;border-radius:8px;"></iframe></div>`;
        case "mermaid":
          return `<div class="intent-embed mermaid">${embedContent}</div>`;
        case "svg":
          return `<div class="intent-embed svg">${embedContent}</div>`;
        case "video":
          return `<div class="intent-embed video"><video src="${escapeHtml(sanitizeUrl(src))}" controls style="max-width:100%;border-radius:8px;"></video></div>`;
        case "audio":
          return `<div class="intent-embed audio"><audio src="${escapeHtml(sanitizeUrl(src))}" controls style="width:100%;"></audio></div>`;
        default:
          return `<div class="intent-embed unknown">${escapeHtml(embedContent || src)}</div>`;
      }
    }

    case "code":
      return `<pre class="intent-code"><code>${escapeHtml(block.content)}</code></pre>`;

    case "table": {
      const headers = block.table?.headers;
      const rows = block.table?.rows || [];

      const thead = headers
        ? `<thead><tr>${headers
            .map((h) => `<th class="intent-table-th">${escapeHtml(h)}</th>`)
            .join("")}</tr></thead>`
        : "";

      const tbody = `<tbody>${rows
        .map(
          (row) =>
            `<tr class="intent-row">${row
              .map((c) => `<td class="intent-table-td">${escapeHtml(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;

      return `<table class="intent-table">${thead}${tbody}</table>`;
    }

    case "list-item": {
      const listItemProps = block.properties || {};
      const listItemMeta = [
        listItemProps.owner &&
          `<span class="intent-task-owner">${escapeHtml(String(listItemProps.owner))}</span>`,
        listItemProps.due &&
          `<span class="intent-task-due">${escapeHtml(String(listItemProps.due))}</span>`,
      ]
        .filter(Boolean)
        .join(" ");
      return `<li class="intent-list-item">${content}${listItemMeta ? ` <span class="intent-task-meta">${listItemMeta}</span>` : ""}</li>`;
    }

    case "step-item":
      return `<li class="intent-step-item">${content}</li>`;

    // ─── v2 Agentic Workflow Blocks ────────────────────────────────────

    case "step": {
      const statusVal = String(props.status || "pending");
      const statusClass = `intent-status-${statusVal}`;
      const toolBadge = props.tool
        ? `<span class="intent-badge intent-badge-tool">${escapeHtml(String(props.tool))}</span>`
        : "";
      const statusBadge = `<span class="intent-badge ${statusClass}">${escapeHtml(statusVal)}</span>`;
      const dependsArrow = props.depends
        ? `<span class="intent-step-depends">⤷ ${escapeHtml(String(props.depends))}</span>`
        : "";
      const stepId = props.id
        ? `<span class="intent-step-id">${escapeHtml(String(props.id))}</span>`
        : "";
      return `<div class="intent-step">
        <span class="intent-step-icon">▶</span>
        <span class="intent-step-content">${content}</span>
        <span class="intent-step-meta">${stepId}${toolBadge}${statusBadge}${dependsArrow}</span>
      </div>`;
    }

    case "decision": {
      const ifExpr = props.if ? escapeHtml(String(props.if)) : "";
      const thenTarget = props.then ? escapeHtml(String(props.then)) : "";
      const elseTarget = props.else ? escapeHtml(String(props.else)) : "";
      return `<div class="intent-decision">
        <div class="intent-decision-diamond"></div>
        <div class="intent-decision-body">
          <div class="intent-decision-label">${content}</div>
          ${ifExpr ? `<div class="intent-decision-condition"><strong>if</strong> ${ifExpr}</div>` : ""}
          <div class="intent-decision-branches">
            ${thenTarget ? `<span class="intent-decision-then">✓ then → ${thenTarget}</span>` : ""}
            ${elseTarget ? `<span class="intent-decision-else">✗ else → ${elseTarget}</span>` : ""}
          </div>
        </div>
      </div>`;
    }

    case "trigger": {
      const eventBadge = props.event
        ? `<span class="intent-badge intent-badge-event">${escapeHtml(String(props.event))}</span>`
        : "";
      return `<div class="intent-trigger">
        <span class="intent-trigger-icon">⚡</span>
        <span class="intent-trigger-content">${content}</span>
        ${eventBadge}
      </div>`;
    }

    case "loop": {
      const overVal = props.over ? escapeHtml(String(props.over)) : "";
      const doVal = props.do ? escapeHtml(String(props.do)) : "";
      return `<div class="intent-loop">
        <span class="intent-loop-icon">🔁</span>
        <span class="intent-loop-content">${content}</span>
        ${overVal ? `<span class="intent-loop-over">over: ${overVal}</span>` : ""}
        ${doVal ? `<span class="intent-loop-do">do: ${doVal}</span>` : ""}
      </div>`;
    }

    case "checkpoint":
      return `<div class="intent-checkpoint">
        <span class="intent-checkpoint-flag">🚩</span>
        <span class="intent-checkpoint-label">${content}</span>
        <hr class="intent-checkpoint-line" />
      </div>`;

    case "audit":
      return `<div class="intent-audit"><span class="intent-audit-prefix">audit:</span> ${content}${props.by ? ` | by: ${escapeHtml(String(props.by))}` : ""}${props.at ? ` | at: ${escapeHtml(String(props.at))}` : ""}</div>`;

    case "error": {
      const fallbackInfo = props.fallback
        ? `<span class="intent-error-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      const notifyInfo = props.notify
        ? `<span class="intent-error-notify">notify: ${escapeHtml(String(props.notify))}</span>`
        : "";
      return `<div class="intent-callout intent-error-block"><span class="intent-callout-label">Error</span><div class="intent-callout-content">${content} ${fallbackInfo} ${notifyInfo}</div></div>`;
    }

    case "context": {
      // Render as a small key-value table
      const ctxEntries = Object.entries(props);
      if (ctxEntries.length === 0) {
        return `<div class="intent-context"><code>${content}</code></div>`;
      }
      const ctxRows = ctxEntries
        .map(
          ([k, v]) =>
            `<tr><td class="intent-context-key">${escapeHtml(k)}</td><td class="intent-context-val">${escapeHtml(String(v))}</td></tr>`,
        )
        .join("");
      return `<table class="intent-context-table"><tbody>${ctxRows}</tbody></table>`;
    }

    case "progress": {
      // Parse "X/Y" from content or use value/total properties
      let value = 0;
      let total = 100;
      const progressMatch = block.content.match(/(\d+)\s*\/\s*(\d+)/);
      if (progressMatch) {
        value = parseInt(progressMatch[1], 10);
        total = parseInt(progressMatch[2], 10);
      }
      if (props.value) value = Number(props.value);
      if (props.total) total = Number(props.total);
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return `<div class="intent-progress">
        <span class="intent-progress-label">${content}</span>
        <div class="intent-progress-bar"><div class="intent-progress-fill" style="width:${pct}%"></div></div>
        <span class="intent-progress-pct">${pct}%</span>
      </div>`;
    }

    case "import": {
      const asAlias = props.as ? ` as ${escapeHtml(String(props.as))}` : "";
      return `<div class="intent-file-ref intent-import"><span class="intent-file-ref-icon">📥</span> import: ${content}${asAlias}</div>`;
    }

    case "export": {
      const fmt = props.format ? ` (${escapeHtml(String(props.format))})` : "";
      return `<div class="intent-file-ref intent-export"><span class="intent-file-ref-icon">📤</span> export: ${content}${fmt}</div>`;
    }

    // ─── v2.1 Agentic Workflow Blocks ──────────────────────────────────

    case "signal": {
      const phase = props.phase
        ? `<span class="intent-signal-phase">${escapeHtml(String(props.phase))}</span>`
        : "";
      const levelBadge = props.level
        ? `<span class="intent-badge intent-badge-level">${escapeHtml(String(props.level))}</span>`
        : "";
      return `<div class="intent-signal-block">
        <span class="intent-signal-icon">📡</span>
        <span class="intent-signal-content">${content}</span>
        <span class="intent-signal-meta">${phase}${levelBadge}</span>
      </div>`;
    }

    case "result": {
      const statusVal = String(props.status || "success");
      const statusClass = `intent-result-${statusVal}`;
      const codeBadge = props.code
        ? `<span class="intent-badge intent-badge-code">${escapeHtml(String(props.code))}</span>`
        : "";
      const dataInfo = props.data
        ? `<div class="intent-result-data"><code>${escapeHtml(String(props.data))}</code></div>`
        : "";
      return `<div class="intent-result ${statusClass}">
        <span class="intent-result-icon">✅</span>
        <span class="intent-result-content">${content}</span>
        ${codeBadge}
        ${dataInfo}
      </div>`;
    }

    case "handoff": {
      const fromAgent = props.from
        ? `<span class="intent-handoff-agent intent-handoff-from">${escapeHtml(String(props.from))}</span>`
        : "";
      const toAgent = props.to
        ? `<span class="intent-handoff-agent intent-handoff-to">${escapeHtml(String(props.to))}</span>`
        : "";
      const arrow =
        fromAgent || toAgent
          ? `<span class="intent-handoff-arrow">${fromAgent} → ${toAgent}</span>`
          : "";
      return `<div class="intent-handoff">
        <span class="intent-handoff-icon">🤝</span>
        <span class="intent-handoff-content">${content}</span>
        ${arrow}
      </div>`;
    }

    case "wait": {
      const onVal = props.on
        ? `<span class="intent-badge intent-badge-event">${escapeHtml(String(props.on))}</span>`
        : "";
      const timeoutVal = props.timeout
        ? `<span class="intent-badge intent-badge-timeout">${escapeHtml(String(props.timeout))}</span>`
        : "";
      const fallbackVal = props.fallback
        ? `<span class="intent-wait-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      return `<div class="intent-wait">
        <span class="intent-wait-icon">⏳</span>
        <span class="intent-wait-content">${content}</span>
        <span class="intent-wait-meta">${onVal}${timeoutVal}${fallbackVal}</span>
      </div>`;
    }

    case "parallel": {
      const stepsVal = props.steps
        ? String(props.steps)
            .split(",")
            .map((s) => s.trim())
        : [];
      const stepBadges =
        stepsVal.length > 0
          ? stepsVal
              .map(
                (s) =>
                  `<span class="intent-badge intent-badge-parallel-step">${escapeHtml(s)}</span>`,
              )
              .join("")
          : "";
      const joinBadge = props.join
        ? `<span class="intent-badge intent-badge-join">join: ${escapeHtml(String(props.join))}</span>`
        : "";
      return `<div class="intent-parallel">
        <span class="intent-parallel-icon">⏩</span>
        <span class="intent-parallel-content">${content}</span>
        <span class="intent-parallel-steps">${stepBadges}${joinBadge}</span>
      </div>`;
    }

    case "retry": {
      const maxVal = props.max
        ? `<span class="intent-badge intent-badge-retry-max">max: ${escapeHtml(String(props.max))}</span>`
        : "";
      const delayVal = props.delay
        ? `<span class="intent-badge intent-badge-retry-delay">delay: ${escapeHtml(String(props.delay))}ms</span>`
        : "";
      const backoffVal = props.backoff
        ? `<span class="intent-badge intent-badge-retry-backoff">${escapeHtml(String(props.backoff))}</span>`
        : "";
      return `<div class="intent-retry">
        <span class="intent-retry-icon">🔄</span>
        <span class="intent-retry-content">${content}</span>
        <span class="intent-retry-meta">${maxVal}${delayVal}${backoffVal}</span>
      </div>`;
    }

    // ─── v2.2 Agentic Workflow Blocks ──────────────────────────────────

    case "gate": {
      const approverBadge = props.approver
        ? `<span class="intent-badge intent-badge-approver">${escapeHtml(String(props.approver))}</span>`
        : "";
      const timeoutBadge = props.timeout
        ? `<span class="intent-badge intent-badge-timeout">${escapeHtml(String(props.timeout))}</span>`
        : "";
      const fallbackInfo = props.fallback
        ? `<span class="intent-gate-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      return `<div class="intent-gate">
        <div class="intent-gate-icon">🛑</div>
        <div class="intent-gate-body">
          <div class="intent-gate-label">${content}</div>
          <div class="intent-gate-meta">${approverBadge}${timeoutBadge}${fallbackInfo}</div>
        </div>
      </div>`;
    }

    case "call": {
      const inputVal = props.input
        ? `<span class="intent-call-input">input: ${escapeHtml(String(props.input))}</span>`
        : "";
      const outputVal = props.output
        ? `<span class="intent-call-output">output: ${escapeHtml(String(props.output))}</span>`
        : "";
      return `<div class="intent-call">
        <span class="intent-call-icon">📞</span>
        <span class="intent-call-content">${content}</span>
        <span class="intent-call-meta">${inputVal}${outputVal}</span>
      </div>`;
    }

    // ─── v2.7 Agentic Workflow Blocks ──────────────────────────────────

    case "policy": {
      const conditions: string[] = [];
      if (props.if)
        conditions.push(
          `<span class="it-policy-condition">if ${escapeHtml(String(props.if))}</span>`,
        );
      if (props.always)
        conditions.push(
          `<span class="it-policy-always">always: ${escapeHtml(String(props.always))}</span>`,
        );
      if (props.never)
        conditions.push(
          `<span class="it-policy-never">never: ${escapeHtml(String(props.never))}</span>`,
        );
      if (props.action)
        conditions.push(
          `<span class="it-policy-action">→ ${escapeHtml(String(props.action))}</span>`,
        );
      if (props.requires)
        conditions.push(
          `<span class="it-policy-requires">requires: ${escapeHtml(String(props.requires))}</span>`,
        );
      if (props.notify)
        conditions.push(
          `<span class="it-policy-notify">notify: ${escapeHtml(String(props.notify))}</span>`,
        );
      return `<div class="it-block it-policy">
        <div class="it-policy-name">${content}</div>
        <div class="it-policy-rules">${conditions.join(" ")}</div>
      </div>`;
    }

    case "input": {
      const inputType = props.type ? escapeHtml(String(props.type)) : "string";
      const inputRequired =
        props.required === "true" || String(props.required) === "true";
      const inputDef =
        props.default != null
          ? `<span class="it-input-default">= ${escapeHtml(String(props.default))}</span>`
          : "";
      return `<div class="it-input"><span class="it-input-name">${content}</span><span class="it-input-type">${inputType}</span>${inputRequired ? '<span class="it-input-required">required</span>' : ""}${inputDef}</div>`;
    }

    case "output": {
      const outputType = props.type ? escapeHtml(String(props.type)) : "any";
      const outputFormat = props.format
        ? `<span class="it-output-format">${escapeHtml(String(props.format))}</span>`
        : "";
      return `<div class="it-output"><span class="it-output-name">${content}</span><span class="it-output-type">${outputType}</span>${outputFormat}</div>`;
    }

    case "tool": {
      const toolApi = props.api
        ? `<code class="it-tool-api">${escapeHtml(String(props.api))}</code>`
        : "";
      const toolMethod = props.method
        ? `<span class="it-tool-method">${escapeHtml(String(props.method))}</span>`
        : "";
      return `<div class="it-tool"><span class="it-tool-name">${content}</span>${toolApi}${toolMethod}</div>`;
    }

    case "prompt": {
      const promptModel = props.model
        ? `<span class="it-prompt-model">${escapeHtml(String(props.model))}</span>`
        : "";
      return `<div class="it-prompt">${promptModel}<div class="it-prompt-content">${content}</div></div>`;
    }

    case "memory": {
      const memoryScope = props.scope
        ? escapeHtml(String(props.scope))
        : "session";
      return `<div class="it-memory"><span class="it-memory-scope">${memoryScope}</span><span class="it-memory-content">${content}</span></div>`;
    }

    case "assert": {
      const expectExpr = props.expect
        ? `<code class="it-assert-expect">${escapeHtml(String(props.expect))}</code>`
        : "";
      const severity = props.severity
        ? escapeHtml(String(props.severity))
        : "error";
      return `<div class="it-assert it-assert-${severity}"><span class="it-assert-label">ASSERT</span><span class="it-assert-content">${content}</span>${expectExpr}</div>`;
    }

    case "secret":
      // Secrets are NEVER rendered — always redacted
      return `<div class="it-secret"><span class="it-secret-label">SECRET</span><span class="it-secret-value">${"\u2022".repeat(8)}</span></div>`;

    // ─── v2.5 Document Generation Blocks ─────────────────────────────

    case "font":
      // Layout declaration — not rendered visually
      return "";

    case "page":
      // Layout declaration — not rendered visually
      return "";

    case "break":
      // Invisible in web output; forces page break in print only
      return `<div class="it-page-break" aria-hidden="true" style="display:none"></div>`;

    case "history":
      // history: keyword produces no rendered output
      return "";

    case "byline": {
      const author = content;
      const date = props.date ? escapeHtml(String(props.date)) : "";
      const publication = props.publication
        ? escapeHtml(String(props.publication))
        : "";
      const role = props.role ? escapeHtml(String(props.role)) : "";
      const metaParts = [role, date, publication].filter(Boolean);
      return `<div class="it-byline"><span class="it-byline-author">${author}</span>${metaParts.length > 0 ? `<span class="it-byline-meta">${metaParts.join(" · ")}</span>` : ""}</div>`;
    }

    case "epigraph": {
      const by = props.by
        ? `<span class="it-epigraph-by">— ${escapeHtml(String(props.by))}</span>`
        : "";
      return `<blockquote class="it-epigraph"><p>${content}</p>${by}</blockquote>`;
    }

    case "caption":
      return `<figcaption class="it-caption">${content}</figcaption>`;

    case "footnote":
      // Collected by renderBlocks — rendered at end in footnotes section
      return "";

    case "toc":
      // Placeholder — actual TOC is built by renderBlocks scanning sections
      return "";

    case "dedication":
      return `<div class="it-dedication">${content}</div>`;

    // ─── v2.8 Document Trust Blocks ────────────────────────────────────

    case "track":
      // Invisible — metadata only, not rendered
      return "";

    case "meta":
      // Invisible — metadata only, not rendered
      return "";

    // ─── v2.9 Print Layout Blocks (invisible in web output) ──────────

    case "header":
      return "";
    case "footer":
      return "";
    case "watermark":
      return "";

    case "approve": {
      const approveBy = props.by ? escapeHtml(String(props.by)) : "Unknown";
      const approveRole = props.role ? escapeHtml(String(props.role)) : "";
      const approveAt = props.at ? formatTrustDate(String(props.at)) : "";
      return `<div class="it-approval">
        <span class="it-approval__icon">✓</span>
        <div class="it-approval__body">
          <span class="it-approval__label">APPROVED</span>
          <span class="it-approval__who">${approveBy}${approveRole ? ` — ${approveRole}` : ""}</span>
          ${approveAt ? `<span class="it-approval__date">${approveAt}</span>` : ""}
        </div>
      </div>`;
    }

    case "sign": {
      const signerName = escapeHtml(block.content);
      const signRole = props.role ? escapeHtml(String(props.role)) : "";
      const signAt = props.at ? formatTrustDate(String(props.at)) : "";
      const signValid = props.hash ? true : false; // Basic: assume valid if hash present
      return `<div class="it-signature${signValid ? " it-signature--valid" : " it-signature--invalid"}">
        <span class="it-signature__name">${signerName}</span>
        ${signRole ? `<span class="it-signature__role">${signRole}</span>` : ""}
        ${signAt ? `<span class="it-signature__date">${signAt}</span>` : ""}
        <span class="it-signature__status">${signValid ? "✅ Verified" : "❌ Invalid"}</span>
      </div>`;
    }

    case "freeze": {
      const freezeAt = props.at ? formatTrustDate(String(props.at)) : "";
      const freezeHash = props.hash
        ? escapeHtml(String(props.hash)).slice(0, 20) + "..."
        : "";
      return `<div class="it-sealed-banner">
        <span class="it-sealed-banner__icon">🔒</span>
        <span class="it-sealed-banner__text">Sealed Document</span>
        ${freezeAt ? `<span class="it-sealed-banner__date">${freezeAt}</span>` : ""}
        ${freezeHash ? `<span class="it-sealed-banner__hash">${freezeHash}</span>` : ""}
      </div>`;
    }

    case "revision":
      // Should never appear above the history boundary — render as muted if somehow present
      return "";

    // ─── v2.11 Keyword Expansion ───────────────────────────────────────

    case "def": {
      const meaning = props.meaning ? escapeHtml(String(props.meaning)) : "";
      const abbr = props.abbr
        ? ` <span class="it-def-abbr">(${escapeHtml(String(props.abbr))})</span>`
        : "";
      return `<div class="it-def">
        <dt class="it-def-term">${content}${abbr}</dt>
        <dd class="it-def-meaning">${meaning}</dd>
      </div>`;
    }

    case "metric": {
      const val = props.value != null ? escapeHtml(String(props.value)) : "";
      const unit = props.unit ? escapeHtml(String(props.unit)) : "";
      const target = props.target != null ? String(props.target) : "";
      const trend = props.trend ? String(props.trend) : "";
      const period = props.period ? escapeHtml(String(props.period)) : "";

      const trendIcon =
        trend === "up"
          ? "↑"
          : trend === "down"
            ? "↓"
            : trend === "stable"
              ? "→"
              : "";
      let colorClass = "it-metric-neutral";
      if (target && val) {
        colorClass =
          Number(val) >= Number(target) ? "it-metric-green" : "it-metric-red";
      }

      return `<div class="it-metric ${colorClass}">
        <div class="it-metric-name">${content}</div>
        <div class="it-metric-value">${val}<span class="it-metric-unit">${unit}</span></div>
        ${target ? `<div class="it-metric-target">Target: ${escapeHtml(target)}</div>` : ""}
        ${trendIcon ? `<div class="it-metric-trend">${trendIcon}</div>` : ""}
        ${period ? `<div class="it-metric-period">${period}</div>` : ""}
      </div>`;
    }

    case "amendment": {
      const amendRef = props.ref ? escapeHtml(String(props.ref)) : "";
      const amendSection = props.section
        ? escapeHtml(String(props.section))
        : "";
      const amendWas = props.was ? escapeHtml(String(props.was)) : "";
      const amendNow = props.now ? escapeHtml(String(props.now)) : "";
      const amendBy = props.by ? escapeHtml(String(props.by)) : "";
      const amendAt = props.at ? formatTrustDate(String(props.at)) : "";
      return `<div class="it-amendment">
        <div class="it-amendment-header">
          <span class="it-amendment-icon">✏️</span>
          <span class="it-amendment-ref">${amendRef}</span>
          <span class="it-amendment-title">${content}</span>
        </div>
        ${amendSection ? `<div class="it-amendment-section">Section: ${amendSection}</div>` : ""}
        ${amendWas ? `<div class="it-amendment-was">Was: ${amendWas}</div>` : ""}
        ${amendNow ? `<div class="it-amendment-now">Now: ${amendNow}</div>` : ""}
        <div class="it-amendment-meta">
          ${amendBy ? `<span class="it-amendment-by">${amendBy}</span>` : ""}
          ${amendAt ? `<span class="it-amendment-at">${amendAt}</span>` : ""}
        </div>
      </div>`;
    }

    case "figure": {
      const figSrc = props.src
        ? escapeHtml(sanitizeUrl(String(props.src)))
        : "";
      const figCaption = props.caption ? escapeHtml(String(props.caption)) : "";
      const figNum = props.num ? escapeHtml(String(props.num)) : "";
      const figWidth = props.width
        ? `width:${escapeHtml(String(props.width))};`
        : "";
      const figAlign = props.align ? String(props.align) : "center";
      const figAlt = props.alt
        ? escapeHtml(String(props.alt))
        : escapeHtml(block.content);
      const numPrefix = figNum ? `Figure ${figNum}: ` : "";
      return `<figure class="it-figure" style="text-align:${escapeHtml(figAlign)};">
        ${figSrc ? `<img src="${figSrc}" alt="${figAlt}" style="${figWidth}max-width:100%;" />` : ""}
        <figcaption class="it-figure-caption">${numPrefix}${figCaption}</figcaption>
      </figure>`;
    }

    case "signline": {
      const sigLabel = props.label
        ? escapeHtml(String(props.label))
        : "Signature";
      const sigRole = props.role ? escapeHtml(String(props.role)) : "";
      const sigDateLine = String(props["date-line"]) === "true";
      const sigWidth = props.width ? escapeHtml(String(props.width)) : "60%";
      return `<div class="it-signline" style="width:${sigWidth};">
        <div class="it-signline-label">${sigLabel}</div>
        <div class="it-signline-rule"></div>
        <div class="it-signline-name">${content}</div>
        ${sigRole ? `<div class="it-signline-role">${sigRole}</div>` : ""}
        ${sigDateLine ? `<div class="it-signline-date">Date: _______________</div>` : ""}
      </div>`;
    }

    case "contact": {
      const cRole = props.role ? escapeHtml(String(props.role)) : "";
      const cEmail = props.email ? String(props.email) : "";
      const cPhone = props.phone ? String(props.phone) : "";
      const cOrg = props.org ? escapeHtml(String(props.org)) : "";
      const cUrl2 = props.url ? String(props.url) : "";
      return `<div class="it-contact">
        <div class="it-contact-name">${content}</div>
        ${cRole ? `<div class="it-contact-role">${cRole}</div>` : ""}
        ${cOrg ? `<div class="it-contact-org">${cOrg}</div>` : ""}
        ${cEmail ? `<div class="it-contact-email"><a href="mailto:${escapeHtml(cEmail)}">${escapeHtml(cEmail)}</a></div>` : ""}
        ${cPhone ? `<div class="it-contact-phone"><a href="tel:${escapeHtml(cPhone)}">${escapeHtml(cPhone)}</a></div>` : ""}
        ${cUrl2 ? `<div class="it-contact-url"><a href="${escapeHtml(sanitizeUrl(cUrl2))}">${escapeHtml(cUrl2)}</a></div>` : ""}
      </div>`;
    }

    case "deadline": {
      const dlDate = props.date ? String(props.date) : "";
      const dlConsequence = props.consequence
        ? escapeHtml(String(props.consequence))
        : "";
      const dlAuthority = props.authority
        ? escapeHtml(String(props.authority))
        : "";
      const dlOwner = props.owner ? escapeHtml(String(props.owner)) : "";

      let dlColorClass = "it-deadline-green";
      if (dlDate) {
        const dlDateObj = new Date(dlDate);
        if (!isNaN(dlDateObj.getTime())) {
          const daysUntil =
            (dlDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntil < 7) dlColorClass = "it-deadline-red";
          else if (daysUntil < 30) dlColorClass = "it-deadline-amber";
        }
      }

      return `<div class="it-deadline ${dlColorClass}">
        <div class="it-deadline-name">${content}</div>
        ${dlDate ? `<div class="it-deadline-date">${escapeHtml(dlDate)}</div>` : ""}
        ${dlConsequence ? `<div class="it-deadline-consequence">${dlConsequence}</div>` : ""}
        ${dlOwner ? `<div class="it-deadline-owner">${dlOwner}</div>` : ""}
        ${dlAuthority ? `<div class="it-deadline-authority">${dlAuthority}</div>` : ""}
      </div>`;
    }

    default:
      return `<div class="intent-unknown">
        <small class="intent-unknown-type">[${block.type}]</small> ${content}
      </div>`;
  }
}

// Helper to slug-ify a section title for anchor links
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Collect all section/sub blocks from a document for TOC
function collectSections(
  blocks: IntentBlock[],
  depth: number,
): Array<{ level: number; content: string; slug: string }> {
  const entries: Array<{ level: number; content: string; slug: string }> = [];
  for (const block of blocks) {
    if (block.type === "section") {
      entries.push({
        level: 1,
        content: block.content,
        slug: slugify(block.content),
      });
      if (depth >= 2 && block.children) {
        for (const child of block.children) {
          if (child.type === "sub") {
            entries.push({
              level: 2,
              content: child.content,
              slug: slugify(child.content),
            });
          }
        }
      }
    }
  }
  return entries;
}

// Collect all footnote blocks from a flat list + nested children
function collectFootnotes(blocks: IntentBlock[]): IntentBlock[] {
  const footnotes: IntentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "footnote") footnotes.push(block);
    if (block.children) footnotes.push(...collectFootnotes(block.children));
  }
  return footnotes;
}

// Render a list of blocks, properly grouping consecutive list/step items
// and recursing into section/sub children.
function renderBlocks(
  blocks: IntentBlock[],
  allBlocks?: IntentBlock[],
): string {
  const topBlocks = allBlocks || blocks;
  let html = "";
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // TOC block — generate from all sections in the document
    if (block.type === "toc") {
      const depth = Number(block.properties?.depth || 2);
      const title = String(block.properties?.title || "Contents");
      const entries = collectSections(topBlocks, depth);
      let tocHtml = `<nav class="it-toc"><h2 class="it-toc-title">${escapeHtml(title)}</h2><ol>`;
      for (const entry of entries) {
        const indent = entry.level === 2 ? ' class="it-toc-sub"' : "";
        tocHtml += `<li${indent}><a href="#${entry.slug}">${escapeHtml(entry.content)}</a></li>`;
      }
      tocHtml += `</ol></nav>`;
      html += tocHtml;
      i++;
      continue;
    }

    // Collect consecutive list-item blocks into a single <ul>
    if (block.type === "list-item") {
      html += '<ul class="intent-list">';
      while (i < blocks.length && blocks[i].type === "list-item") {
        html += renderBlock(blocks[i]);
        i++;
      }
      html += "</ul>";
      continue;
    }

    // Collect consecutive step-item blocks into a single <ol>
    if (block.type === "step-item") {
      html += '<ol class="intent-list">';
      while (i < blocks.length && blocks[i].type === "step-item") {
        html += renderBlock(blocks[i]);
        i++;
      }
      html += "</ol>";
      continue;
    }

    // Render the block itself
    html += renderBlock(block);

    // Recurse into children only for structural containers.
    // list-item children hold the original embedded keyword block (content
    // already copied to the list-item), so we do NOT recurse into those.
    if (
      (block.type === "section" || block.type === "sub") &&
      block.children &&
      block.children.length > 0
    ) {
      html += renderBlocks(block.children, topBlocks);
    }

    i++;
  }

  return html;
}

// Main HTML renderer function
export function renderHTML(
  document: IntentDocument,
  options?: RenderOptions,
): string {
  if (!document || !document.blocks) return "";

  const bodyHtml = renderBlocks(document.blocks);

  // Collect and render footnotes at bottom
  const footnotes = collectFootnotes(document.blocks);
  let footnotesHtml = "";
  if (footnotes.length > 0) {
    const items = footnotes
      .map((fn) => {
        const num = escapeHtml(fn.content);
        const text = fn.properties?.text
          ? escapeHtml(String(fn.properties.text))
          : escapeHtml(fn.content);
        return `<li id="fn-${num}" value="${num}">${text}</li>`;
      })
      .join("");
    footnotesHtml = `<div class="it-footnotes"><ol>${items}</ol></div>`;
  }

  const html = bodyHtml + footnotesHtml;

  // v2.10: Resolve theme — from options, from meta, or none
  const themeRef =
    options?.theme ?? document.metadata?.meta?.theme ?? undefined;
  const theme = themeRef ? resolveThemeSync(themeRef) : undefined;
  const themeCSS = theme ? generateThemeCSS(theme, "web") : "";

  // Wrap in a container
  const direction =
    document.metadata?.language === "rtl" ? 'dir="rtl"' : 'dir="ltr"';

  return `<div class="intent-document" ${direction}>
<style>
/* ── Base ──────────────────────────────────────────────── */
.intent-document{font-family:Georgia,'Times New Roman',serif;line-height:1.7;color:#111;max-width:680px;margin:0 auto;padding:32px 24px;}
/* ── Typography ────────────────────────────────────────── */
.intent-title{font-size:1.75rem;line-height:1.2;margin:0 0 12px;font-weight:700;letter-spacing:-0.01em;}
.intent-summary{margin:8px 0 20px;padding:8px 0 8px 14px;border-left:2px solid #999;color:#333;font-style:italic;font-size:0.95rem;}
.intent-section{margin:24px 0 8px;font-size:1.1rem;line-height:1.3;font-weight:600;padding-bottom:4px;border-bottom:1px solid #ccc;}
.intent-sub{margin:16px 0 6px;font-size:1rem;line-height:1.3;font-weight:600;}
.intent-note{margin:6px 0;color:#222;}
.intent-prose{margin:0 0 1em;color:#222;font-size:1rem;line-height:1.8;max-width:65ch;text-wrap:pretty;}
.intent-align-center{text-align:center;}
.intent-align-right{text-align:right;}
.intent-align-justify{text-align:justify;}
/* ── Divider ───────────────────────────────────────────── */
.intent-divider{margin:18px 0;text-align:center;}
.intent-divider-line{border:none;border-top:1px solid #ccc;margin:0;}
.intent-divider-label{display:inline-block;padding:0 10px;background:#fff;color:#888;font-size:0.78rem;position:relative;top:-9px;}
/* ── Tasks ─────────────────────────────────────────────── */
.intent-task{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.intent-task-checkbox{margin-top:3px;flex-shrink:0;}
.intent-task-text{flex:1;}
.intent-task-meta{display:flex;gap:6px;color:#888;font-size:0.78rem;white-space:nowrap;}
.intent-task-owner::before{content:'@ ';opacity:0.6;}
.intent-task-due::before{content:'due ';}
.intent-task-time::before{content:'at ';}
.intent-task-text-done{text-decoration:line-through;color:#999;}
/* ── Ask ───────────────────────────────────────────────── */
.intent-ask{display:flex;gap:10px;margin:10px 0;padding:6px 0 6px 12px;border-left:2px solid #999;align-items:baseline;}
.intent-ask-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;flex-shrink:0;line-height:1.65;}
.intent-ask-content{flex:1;color:#333;font-style:italic;}
/* ── Quote ─────────────────────────────────────────────── */
.intent-quote{margin:14px 0;padding:2px 0 2px 16px;border-left:2px solid #999;font-style:italic;color:#333;}
.intent-quote p{margin:0;line-height:1.7;}
.intent-quote-cite{display:block;margin-top:5px;font-style:normal;color:#888;font-size:0.82rem;}
/* ── Code ──────────────────────────────────────────────── */
.intent-code{margin:10px 0;padding:10px 12px;background:#f5f5f5;border:1px solid #ddd;overflow-x:auto;}
.intent-code code{font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:0.85rem;color:#111;}
/* ── Table ─────────────────────────────────────────────── */
.intent-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:0.9em;}
.intent-table th,.intent-table-th{padding:6px 10px;text-align:left;font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid #333;}
.intent-table td,.intent-table-td{padding:6px 10px;text-align:left;border-bottom:1px solid #ddd;vertical-align:top;}
.intent-row:last-child .intent-table-td,.intent-row:last-child td{border-bottom:none;}
/* ── Image ─────────────────────────────────────────────── */
.intent-image{margin:12px 0;}
.intent-image-img{max-width:100%;height:auto;border:1px solid #ddd;}
.intent-image-caption{margin-top:4px;color:#555;font-size:0.82rem;text-align:center;font-style:italic;}
/* ── Links / Refs ──────────────────────────────────────── */
.intent-link{margin:4px 0;}
.intent-link a{color:#111;text-decoration:underline;}
.intent-ref{margin:4px 0;}
.intent-ref a{color:#111;text-decoration:underline;font-style:italic;}
.intent-unknown{margin:6px 0;padding:6px 10px;border:1px dashed #ccc;color:#888;}
/* ── Embed ─────────────────────────────────────────────── */
.intent-embed{margin:14px 0;}
.intent-embed iframe,.intent-embed video,.intent-embed audio{display:block;width:100%;border:1px solid #ddd;}
/* ── Callouts ──────────────────────────────────────────── */
.intent-callout{display:flex;gap:10px;margin:10px 0;padding:6px 0 6px 12px;border-left:2px solid #888;align-items:baseline;}
.intent-callout-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0;white-space:nowrap;line-height:1.65;color:#444;}
.intent-callout-content{flex:1;color:#222;}
.intent-info{border-color:#888;}
.intent-info .intent-callout-label{color:#444;}
.intent-warning{border-color:#888;}
.intent-warning .intent-callout-label{color:#444;}
.intent-tip{border-color:#888;}
.intent-tip .intent-callout-label{color:#444;}
.intent-success{border-color:#888;}
.intent-success .intent-callout-label{color:#444;}
/* ── Inline formatting ─────────────────────────────────── */
.intent-inline-link{color:#111;text-decoration:underline;}
.intent-inline-highlight{background:#eee;padding:0 .15em;}
.intent-inline-note{display:inline-block;padding:0 .3em;border:1px solid #ddd;color:#333;font-size:.92em;}
.intent-inline-quote{color:#333;font-style:italic;}
.intent-inline-date{font-weight:600;font-family:'SFMono-Regular',Consolas,monospace;}
.intent-inline-mention{font-weight:600;}
.intent-inline-tag{font-weight:600;}
/* ── Lists ─────────────────────────────────────────────── */
ul,ol{margin:6px 0 6px 20px;padding:0;}
li{margin:3px 0;color:#222;}
/* ── v2 Agentic Workflow Blocks ────────────────────────── */
.intent-step{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.intent-step-icon{font-size:0.85rem;flex-shrink:0;}
.intent-step-content{flex:1;font-weight:500;}
.intent-step-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;}
.intent-step-id{font-size:0.72rem;color:#888;font-family:monospace;}
.intent-step-depends{font-size:0.75rem;color:#555;font-style:italic;}
.intent-badge{font-size:0.7rem;padding:1px 6px;border:1px solid #bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;}
.intent-badge-tool{border-color:#999;}
.intent-status-pending{color:#666;}
.intent-status-running{color:#333;animation:intent-pulse 1.5s ease-in-out infinite;}
.intent-status-blocked{color:#666;}
.intent-status-failed{color:#333;text-decoration:line-through;}
.intent-status-done{color:#333;}
.intent-status-skipped,.intent-status-cancelled{color:#999;text-decoration:line-through;}
@keyframes intent-pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
.intent-decision{display:flex;gap:10px;margin:8px 0;padding:8px 12px;border:1px solid #bbb;}
.intent-decision-diamond{width:16px;height:16px;border:2px solid #333;transform:rotate(45deg);flex-shrink:0;margin-top:4px;}
.intent-decision-body{flex:1;}
.intent-decision-label{font-weight:600;margin-bottom:3px;}
.intent-decision-condition{font-size:0.85rem;color:#444;font-family:monospace;margin-bottom:3px;}
.intent-decision-branches{display:flex;gap:14px;font-size:0.82rem;}
.intent-decision-then{color:#333;}
.intent-decision-else{color:#333;}
.intent-trigger{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.intent-trigger-icon{font-size:1rem;}
.intent-trigger-content{flex:1;font-weight:500;}
.intent-badge-event{border-color:#999;}
.intent-loop{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.intent-loop-icon{font-size:1rem;}
.intent-loop-content{flex:1;font-weight:500;}
.intent-loop-over,.intent-loop-do{font-size:0.8rem;color:#555;font-family:monospace;}
.intent-checkpoint{display:flex;align-items:center;gap:8px;margin:16px 0;color:#555;font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;}
.intent-checkpoint-flag{font-size:1rem;}
.intent-checkpoint-label{flex-shrink:0;}
.intent-checkpoint-line{flex:1;border:none;border-top:1px dashed #bbb;margin:0;}
.intent-audit{margin:4px 0;padding:4px 8px;font-family:'SFMono-Regular',Consolas,monospace;font-size:0.8rem;color:#555;border-left:2px solid #bbb;}
.intent-audit-prefix{color:#888;font-weight:600;}
.intent-error-block{border-color:#999;}
.intent-error-block .intent-callout-label{color:#333;}
.intent-error-fallback{font-size:0.8rem;color:#555;font-style:italic;margin-left:6px;}
.intent-error-notify{font-size:0.8rem;color:#555;margin-left:6px;}
.intent-context-table{width:auto;border-collapse:collapse;margin:6px 0;font-size:0.85rem;}
.intent-context-key{padding:3px 10px 3px 8px;font-weight:600;color:#333;font-family:monospace;border-bottom:1px solid #ddd;}
.intent-context-val{padding:3px 12px 3px 6px;color:#333;font-family:monospace;border-bottom:1px solid #ddd;}
.intent-context{margin:4px 0;font-size:0.85rem;color:#333;}
.intent-progress{display:flex;align-items:center;gap:8px;margin:6px 0;}
.intent-progress-label{font-size:0.85rem;color:#222;flex-shrink:0;}
.intent-progress-bar{flex:1;height:6px;background:#ddd;overflow:hidden;}
.intent-progress-fill{height:100%;background:#555;}
.intent-progress-pct{font-size:0.78rem;color:#555;font-weight:600;min-width:36px;text-align:right;}
.intent-file-ref{display:flex;align-items:center;gap:6px;margin:4px 0;padding:4px 8px;border:1px dashed #ccc;font-size:0.82rem;color:#555;font-family:monospace;}
.intent-file-ref-icon{font-size:0.9rem;}
/* ── v2.1 Agentic Workflow Blocks ──────────────────────── */
.intent-emit-block{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #bbb;margin:5px 0;}
.intent-emit-icon{font-size:1rem;}
.intent-emit-content{flex:1;font-weight:500;}
.intent-emit-meta{display:flex;gap:5px;align-items:center;}
.intent-emit-phase{font-size:0.78rem;color:#555;font-weight:600;}
.intent-badge-level{border-color:#999;}
.intent-result{display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border:1px solid #bbb;margin:5px 0;flex-wrap:wrap;}
.intent-result-success{border-color:#999;}
.intent-result-error,.intent-result-failure{border-color:#999;}
.intent-result-icon{font-size:1rem;flex-shrink:0;}
.intent-result-content{flex:1;font-weight:500;}
.intent-badge-code{border-color:#999;font-family:monospace;}
.intent-result-data{width:100%;margin-top:3px;padding:4px 8px;font-size:0.82rem;overflow-x:auto;border-top:1px solid #ddd;}
.intent-result-data code{font-family:'SFMono-Regular',Consolas,monospace;font-size:0.82rem;color:#333;}
.intent-handoff{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #bbb;margin:5px 0;}
.intent-handoff-icon{font-size:1rem;}
.intent-handoff-content{flex:1;font-weight:500;}
.intent-handoff-arrow{display:flex;align-items:center;gap:5px;font-size:0.82rem;color:#444;font-weight:600;}
.intent-handoff-agent{padding:1px 5px;border:1px solid #bbb;font-family:monospace;font-size:0.78rem;}
.intent-wait{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;border-left:2px solid #999;}
.intent-wait-icon{font-size:1rem;animation:intent-pulse 2s ease-in-out infinite;}
.intent-wait-content{flex:1;font-weight:500;color:#333;}
.intent-wait-meta{display:flex;gap:5px;align-items:center;}
.intent-badge-timeout{border-color:#999;font-family:monospace;}
.intent-wait-fallback{font-size:0.8rem;color:#555;font-style:italic;}
.intent-parallel{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #bbb;margin:5px 0;}
.intent-parallel-icon{font-size:1rem;}
.intent-parallel-content{flex:1;font-weight:500;}
.intent-parallel-steps{display:flex;gap:4px;flex-wrap:wrap;}
.intent-badge-parallel-step{border-color:#999;font-family:monospace;font-size:0.72rem;padding:1px 5px;}
.intent-badge-join{border-color:#999;font-size:0.72rem;padding:1px 5px;}
.intent-retry{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #bbb;margin:5px 0;}
.intent-retry-icon{font-size:1rem;}
.intent-retry-content{flex:1;font-weight:500;}
.intent-retry-meta{display:flex;gap:5px;align-items:center;}
.intent-badge-retry-max{border-color:#999;font-size:0.72rem;}
.intent-badge-retry-delay{border-color:#999;font-size:0.72rem;font-family:monospace;}
.intent-badge-retry-backoff{border-color:#999;font-size:0.72rem;font-style:italic;}
/* ── v2.2 Agentic Workflow Blocks ──────────────────────── */
.intent-gate{display:flex;gap:10px;margin:8px 0;padding:10px 12px;border:2px solid #888;}
.intent-gate-icon{font-size:1.2rem;flex-shrink:0;margin-top:2px;}
.intent-gate-body{flex:1;}
.intent-gate-label{font-weight:600;margin-bottom:3px;}
.intent-gate-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;}
.intent-badge-approver{border-color:#999;font-family:monospace;}
.intent-gate-fallback{font-size:0.8rem;color:#555;font-style:italic;}
.intent-call{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px dashed #999;margin:5px 0;}
.intent-call-icon{font-size:1rem;}
.intent-call-content{flex:1;font-weight:500;font-family:monospace;font-size:0.9rem;}
.intent-call-meta{display:flex;gap:6px;align-items:center;}
.intent-call-input{font-size:0.78rem;color:#555;font-family:monospace;}
.intent-call-output{font-size:0.78rem;color:#555;font-family:monospace;}
/* ── v2.5 Document Generation Blocks ───────────────────── */
.it-page-break{page-break-after:always;break-after:page;height:0;}
.it-byline{margin:0 0 16px;font-size:0.9em;color:#333;}
.it-byline-author{display:block;font-weight:bold;}
.it-byline-meta{display:block;font-size:0.85em;color:#666;margin-top:2px;}
.it-epigraph{font-style:italic;text-align:center;margin:20px 3em;border:none;padding:0;}
.it-epigraph p{margin:0;}
.it-epigraph .it-epigraph-by{display:block;text-align:right;font-size:0.9em;margin-top:4px;font-style:normal;color:#666;}
.it-caption{font-size:0.85em;font-style:italic;text-align:center;color:#444;margin-top:3px;margin-bottom:10px;}
.it-dedication{font-style:italic;text-align:center;margin:3em auto;}
.it-toc{margin:20px 0;}
.it-toc-title{font-size:1.1rem;font-weight:600;margin-bottom:8px;border:none;}
.it-toc ol{list-style:none;padding:0;margin:0;}
.it-toc li{margin:3px 0;}
.it-toc li a{color:#111;text-decoration:none;border-bottom:1px dotted #bbb;}
.it-toc li a:hover{border-bottom-style:solid;}
.it-toc .it-toc-sub{padding-left:20px;font-size:0.92em;}
.it-footnotes{border-top:1px solid #ccc;margin-top:24px;padding-top:8px;font-size:0.85em;color:#444;}
.it-footnotes ol{padding-left:1.5em;margin:0;}
.it-footnotes li{margin:3px 0;}
sup.it-fn-ref{font-size:0.7em;vertical-align:super;}
sup.it-fn-ref a{color:#111;text-decoration:none;border-bottom:1px solid #999;}
/* ── v2.8 Document Trust ───────────────────────────────── */
.it-approval{display:flex;gap:10px;margin:10px 0;padding:10px 14px;border:1px solid #4caf50;background:#f8fdf8;}
.it-approval__icon{font-size:1.2rem;color:#4caf50;flex-shrink:0;}
.it-approval__body{display:flex;flex-direction:column;gap:2px;}
.it-approval__label{font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#4caf50;}
.it-approval__who{font-size:0.9rem;color:#222;}
.it-approval__date{font-size:0.8rem;color:#666;}
.it-signature{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0;padding:10px 14px;border:1px solid #daa520;background:#fffdf5;}
.it-signature--valid{border-color:#4caf50;background:#f8fdf8;}
.it-signature--invalid{border-color:#c62828;background:#fdf5f5;}
.it-signature__name{font-weight:600;font-size:0.95rem;color:#111;}
.it-signature__role{font-size:0.85rem;color:#555;}
.it-signature__date{font-size:0.8rem;color:#666;}
.it-signature__status{font-size:0.8rem;font-weight:600;margin-left:auto;}
.it-sealed-banner{display:flex;gap:10px;align-items:center;margin:16px 0;padding:12px 16px;border:2px solid #c62828;background:#fdf5f5;font-weight:600;}
.it-sealed-banner__icon{font-size:1.3rem;}
.it-sealed-banner__text{font-size:1rem;color:#c62828;text-transform:uppercase;letter-spacing:0.04em;}
.it-sealed-banner__date{font-size:0.8rem;color:#666;margin-left:auto;}
.it-sealed-banner__hash{font-size:0.72rem;color:#888;font-family:monospace;}
/* ── v2.11 Keyword Expansion ──────────────────────────── */
.it-ref-card{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.it-ref-icon{font-size:1rem;flex-shrink:0;}
.it-ref-link{color:#111;text-decoration:underline;font-weight:500;}
.it-ref-name{font-weight:500;}
.it-ref-rel{font-size:0.7rem;padding:1px 6px;border:1px solid #bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;}
.it-def{margin:6px 0;padding:4px 0;}
.it-def-term{font-weight:700;font-size:0.95rem;color:#111;}
.it-def-abbr{font-weight:400;color:#555;}
.it-def-meaning{margin:2px 0 0 0;color:#333;font-size:0.92rem;padding-left:1em;}
.it-metric{display:inline-block;padding:10px 14px;border:1px solid #ddd;margin:5px;min-width:140px;vertical-align:top;}
.it-metric-name{font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#555;}
.it-metric-value{font-size:1.6rem;font-weight:700;line-height:1.2;color:#111;}
.it-metric-unit{font-size:0.85rem;font-weight:400;color:#666;margin-left:2px;}
.it-metric-target{font-size:0.78rem;color:#888;}
.it-metric-trend{font-size:1rem;font-weight:700;margin-top:2px;}
.it-metric-period{font-size:0.72rem;color:#888;}
.it-metric-green{border-color:#4caf50;}
.it-metric-green .it-metric-value{color:#2e7d32;}
.it-metric-red{border-color:#c62828;}
.it-metric-red .it-metric-value{color:#c62828;}
.it-metric-neutral{border-color:#ddd;}
.it-amendment{margin:10px 0;padding:10px 14px;border:2px solid #e65100;background:#fff8e1;}
.it-amendment-header{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
.it-amendment-icon{font-size:1rem;}
.it-amendment-ref{font-size:0.72rem;font-weight:700;padding:1px 6px;border:1px solid #e65100;color:#e65100;text-transform:uppercase;letter-spacing:0.04em;}
.it-amendment-title{font-weight:600;color:#111;}
.it-amendment-section{font-size:0.85rem;color:#555;font-style:italic;}
.it-amendment-was{font-size:0.85rem;color:#c62828;text-decoration:line-through;}
.it-amendment-now{font-size:0.85rem;color:#2e7d32;font-weight:500;}
.it-amendment-meta{display:flex;gap:8px;margin-top:4px;font-size:0.8rem;color:#666;}
.it-figure{margin:14px 0;}
.it-figure img{display:block;margin:0 auto;border:1px solid #ddd;}
.it-figure-caption{font-size:0.85em;font-style:italic;text-align:center;color:#444;margin-top:6px;}
.it-signline{margin:20px 0;padding:0;}
.it-signline-label{font-size:0.72rem;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;}
.it-signline-rule{border-bottom:1px solid #111;margin-bottom:4px;}
.it-signline-name{font-size:0.9rem;font-weight:500;color:#111;}
.it-signline-role{font-size:0.82rem;color:#555;}
.it-signline-date{font-size:0.82rem;color:#555;margin-top:4px;}
.it-contact{padding:8px 12px;border:1px solid #ddd;margin:5px 0;}
.it-contact-name{font-weight:600;font-size:0.95rem;color:#111;}
.it-contact-role{font-size:0.82rem;color:#555;}
.it-contact-org{font-size:0.82rem;color:#555;}
.it-contact-email a,.it-contact-phone a,.it-contact-url a{color:#111;text-decoration:underline;font-size:0.85rem;}
.it-deadline{padding:8px 12px;border-left:3px solid #4caf50;margin:5px 0;}
.it-deadline-name{font-weight:600;color:#111;}
.it-deadline-date{font-size:0.9rem;font-weight:600;color:#111;}
.it-deadline-consequence{font-size:0.85rem;color:#555;font-style:italic;}
.it-deadline-owner{font-size:0.82rem;color:#555;}
.it-deadline-authority{font-size:0.82rem;color:#555;}
.it-deadline-green{border-color:#4caf50;}
.it-deadline-amber{border-color:#f57c00;}
.it-deadline-red{border-color:#c62828;}
${themeCSS}
</style>
${html}
</div>`;
}

// Build dynamic CSS from font: and page: blocks
function buildDynamicCSS(doc: IntentDocument): string {
  const fontBlock = doc.blocks.find((b) => b.type === "font");
  const pageBlock = doc.blocks.find((b) => b.type === "page");

  const fontFamily = String(fontBlock?.properties?.family || "Georgia, serif");
  const fontSize = String(fontBlock?.properties?.size || "12pt");
  const leading = String(fontBlock?.properties?.leading || "1.6");
  const rawSize = String(pageBlock?.properties?.size || "A4");
  const margins = String(pageBlock?.properties?.margins || "20mm");

  // v2.9: Resolve paper size — named sizes or custom dimensions
  let pageSize: string;
  if (rawSize === "custom") {
    const w = String(pageBlock?.properties?.width || "210mm");
    const h = String(pageBlock?.properties?.height || "297mm");
    pageSize = `${escapeHtml(w)} ${escapeHtml(h)}`;
  } else {
    pageSize = escapeHtml(PAPER_SIZES[rawSize] || rawSize);
  }

  return `@page{size:${pageSize};margin:${escapeHtml(margins)};}body.it-print{font-family:${escapeHtml(fontFamily)};font-size:${escapeHtml(fontSize)};line-height:${escapeHtml(leading)};}`;
}

// Print-optimized HTML renderer
export function renderPrint(
  doc: IntentDocument,
  options?: RenderOptions,
): string {
  if (!doc || !doc.blocks) return "";

  const bodyHtml = renderBlocks(doc.blocks);

  // Collect and render footnotes at bottom
  const footnotes = collectFootnotes(doc.blocks);
  let footnotesHtml = "";
  if (footnotes.length > 0) {
    const items = footnotes
      .map((fn) => {
        const num = escapeHtml(fn.content);
        const text = fn.properties?.text
          ? escapeHtml(String(fn.properties.text))
          : escapeHtml(fn.content);
        return `<li id="fn-${num}" value="${num}">${text}</li>`;
      })
      .join("");
    footnotesHtml = `<div class="it-footnotes"><ol>${items}</ol></div>`;
  }

  const html = bodyHtml + footnotesHtml;
  const dynamicCSS = buildDynamicCSS(doc);
  const direction =
    doc.metadata?.language === "rtl" ? 'dir="rtl"' : 'dir="ltr"';

  // v2.10: Resolve theme
  const themeRef = options?.theme ?? doc.metadata?.meta?.theme ?? undefined;
  const theme = themeRef ? resolveThemeSync(themeRef) : undefined;
  const themeCSS = theme ? generateThemeCSS(theme, "print") : "";

  // v2.9: Collect print layout
  const layout = collectPrintLayout(doc);

  // v2.9: Build header/footer CSS
  let headerFooterCSS = "";
  if (layout.header) {
    const hp = layout.header.properties || {};
    const left = hp.left ? escapeHtml(String(hp.left)) : "";
    const center = hp.center ? escapeHtml(String(hp.center)) : "";
    const right = hp.right ? escapeHtml(String(hp.right)) : "";
    headerFooterCSS += `@page{@top-left{content:"${left}";}@top-center{content:"${center}";}@top-right{content:"${right}";}}`;
    if (String(hp["skip-first"]) === "true") {
      headerFooterCSS += `@page:first{@top-left{content:"";}@top-center{content:"";}@top-right{content:"";}}`;
    }
  }
  if (layout.footer) {
    const fp = layout.footer.properties || {};
    const left = fp.left ? escapeHtml(String(fp.left)) : "";
    const center = fp.center ? escapeHtml(String(fp.center)) : "";
    const right = fp.right ? escapeHtml(String(fp.right)) : "";
    headerFooterCSS += `@page{@bottom-left{content:"${left}";}@bottom-center{content:"${center}";}@bottom-right{content:"${right}";}}`;
    if (String(fp["skip-first"]) === "true") {
      headerFooterCSS += `@page:first{@bottom-left{content:"";}@bottom-center{content:"";}@bottom-right{content:"";}}`;
    }
  }

  // v2.9: Build break declaration CSS
  let breakCSS = "";
  for (const br of layout.breaks) {
    const before = br.properties?.before ? String(br.properties.before) : "";
    const keep = br.properties?.keep ? String(br.properties.keep) : "";
    if (before) {
      breakCSS += `.it-${escapeHtml(before)}{page-break-before:always;}`;
    }
    if (keep) {
      breakCSS += `.it-${escapeHtml(keep)}{break-inside:avoid;}`;
    }
  }

  // v2.9: Watermark HTML element
  let watermarkHtml = "";
  if (layout.watermark && layout.watermark.content) {
    const wp = layout.watermark.properties || {};
    const color = wp.color ? String(wp.color) : "rgba(0,0,0,0.08)";
    const angle = wp.angle ? String(wp.angle) : "-45";
    const size = wp.size ? String(wp.size) : "80pt";
    watermarkHtml = `<div class="it-watermark" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(${escapeHtml(angle)}deg);font-size:${escapeHtml(size)};color:${escapeHtml(color)};z-index:-1;pointer-events:none;white-space:nowrap;">${escapeHtml(layout.watermark.content)}</div>`;
  }

  // v2.9: Print mode class
  const pageBlock = layout.page;
  const printMode = pageBlock?.properties?.["print-mode"]
    ? String(pageBlock.properties["print-mode"])
    : "full";
  const bodyClass =
    printMode === "minimal-ink" ? "it-print it-print-minimal" : "it-print";

  // v2.9: Backward compat — page: header/footer string properties treated as center zone
  let backwardCompatCSS = "";
  if (!layout.header && pageBlock?.properties?.header) {
    const h = escapeHtml(String(pageBlock.properties.header));
    backwardCompatCSS += `@page{@top-center{content:"${h}";}}`;
  }
  if (!layout.footer && pageBlock?.properties?.footer) {
    const f = escapeHtml(String(pageBlock.properties.footer));
    backwardCompatCSS += `@page{@bottom-center{content:"${f}";}}`;
  }

  // v2.9: Minimal-ink CSS
  const minimalInkCSS =
    printMode === "minimal-ink"
      ? `
@media print{.it-print-minimal *{background-color:transparent !important;color:black !important;}.it-print-minimal strong,.it-print-minimal b{font-weight:bold;color:black !important;}.it-print-minimal em,.it-print-minimal i{font-style:italic;color:black !important;}.it-print-minimal .it-border{border:1px solid black !important;}}`
      : "";

  return `<!DOCTYPE html><html ${direction}><head><meta charset="utf-8"><style>
${dynamicCSS}
${themeCSS}
${headerFooterCSS}
${backwardCompatCSS}
${breakCSS}
${minimalInkCSS}
@page{counter-increment:page;}
@media print{body{margin:0;}.it-page-break{page-break-after:always;}.it-no-print{display:none;}a{text-decoration:none;color:inherit;}}
body.it-print{color:#000;background:#fff;}
body.it-print h1{font-size:1.8em;margin-bottom:0.3em;}
body.it-print h2{font-size:1.3em;margin-top:1.5em;}
body.it-print h3{font-size:1.1em;}
body.it-print p{margin:0 0 0.8em 0;orphans:3;widows:3;}
body.it-print table{width:100%;border-collapse:collapse;margin:1em 0;}
body.it-print th{border-bottom:2px solid #000;padding:4pt 8pt;text-align:left;}
body.it-print td{border-bottom:1px solid #ccc;padding:4pt 8pt;}
body.it-print section{page-break-inside:avoid;}
body.it-print .intent-callout{border-left:3pt solid #000;padding-left:10pt;margin:1em 0;}
body.it-print .intent-quote{font-style:italic;margin:1em 2em;}
body.it-print .it-byline{font-size:0.9em;color:#333;margin-bottom:1.5em;}
body.it-print .it-byline .it-byline-author{font-weight:bold;display:block;}
body.it-print .it-byline .it-byline-meta{font-size:0.85em;color:#666;}
body.it-print .it-epigraph{font-style:italic;text-align:center;margin:2em 3em;border:none;padding:0;}
body.it-print .it-epigraph .it-epigraph-by{display:block;text-align:right;font-size:0.9em;margin-top:0.5em;}
body.it-print .it-caption{font-size:0.85em;font-style:italic;text-align:center;color:#444;margin-top:0.3em;margin-bottom:1em;}
body.it-print .it-dedication{font-style:italic;text-align:center;margin:4em auto;page-break-after:always;}
body.it-print .it-toc{margin:2em 0;}
body.it-print .it-toc ol{list-style:none;padding:0;}
body.it-print .it-toc li{margin:0.3em 0;}
body.it-print .it-footnotes{border-top:1pt solid #ccc;margin-top:2em;padding-top:0.5em;font-size:0.85em;}
body.it-print .it-footnotes ol{padding-left:1.5em;margin:0;}
body.it-print .it-footnotes li{margin:0.3em 0;}
body.it-print sup.it-fn-ref{font-size:0.7em;vertical-align:super;}
body.it-print .it-page-break{page-break-after:always;break-after:page;height:0;}
body.it-print .intent-task-checkbox{display:none;}
body.it-print .intent-task::before{content:"\\2610 ";margin-right:4pt;}
body.it-print .intent-task-done::before{content:"\\2611 ";}
/* ── v2.11 Print ───────────────────────────────────────── */
body.it-print .it-ref-card{border:none;padding:0;margin:0.5em 0;font-style:italic;}
body.it-print .it-def{margin:0.3em 0;}
body.it-print .it-def-term{font-weight:bold;}
body.it-print .it-def-meaning{padding-left:1.5em;}
body.it-print .it-metric{border:1pt solid #ccc;padding:6pt 10pt;display:inline-block;min-width:100pt;margin:4pt;vertical-align:top;}
body.it-print .it-amendment{border:2pt solid #000;padding:8pt 12pt;margin:1em 0;}
body.it-print .it-amendment-ref{border:1pt solid #000;color:#000;}
body.it-print .it-figure{margin:1em 0;text-align:center;}
body.it-print .it-figure img{max-width:100%;border:1pt solid #ccc;}
body.it-print .it-figure-caption{font-size:0.85em;font-style:italic;text-align:center;margin-top:0.3em;}
body.it-print .it-signline{display:inline-block;width:45%;margin:2em 2%;vertical-align:top;}
body.it-print .it-signline-rule{border-bottom:1pt solid #000;margin-bottom:4pt;}
body.it-print .it-contact{border:none;padding:0;margin:0.3em 0;}
body.it-print .it-deadline{border-left:3pt solid #000;padding-left:8pt;margin:0.5em 0;}
body.it-print .it-deadline-date{font-weight:bold;text-decoration:underline;}
</style></head><body class="${bodyClass}"><div class="intent-document">${watermarkHtml}${html}</div></body></html>`;
}
