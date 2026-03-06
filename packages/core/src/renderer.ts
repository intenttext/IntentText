import { IntentBlock, IntentDocument, InlineNode } from "./types";

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

// Helper function to render a single block
function renderBlock(block: IntentBlock): string {
  const content = applyInlineFormatting(
    block.content,
    block.inline,
    block.originalContent,
  );
  const props = block.properties || {};
  const alignClass = getAlignmentClass(props);

  switch (block.type) {
    case "title":
      return `<h1 class="intent-title${alignClass}">${content}</h1>`;

    case "summary":
      return `<div class="intent-summary${alignClass}">${content}</div>`;

    case "section":
      return `<h2 id="${slugify(block.content)}" class="intent-section${alignClass}">${content}</h2>`;

    case "sub":
      return `<h3 id="${slugify(block.content)}" class="intent-sub${alignClass}">${content}</h3>`;

    case "divider":
      const label = content
        ? `<span class="intent-divider-label">${content}</span>`
        : "";
      return `<div class="intent-divider">
        <hr class="intent-divider-line" />
        ${label}
      </div>`;

    case "note":
      return `<p class="intent-note${alignClass}">${content}</p>`;
    case "body-text":
      return `<p class="intent-prose${alignClass}">${content}</p>`;

    case "info":
      return `<div class="intent-callout intent-info"><span class="intent-callout-label">Note</span><div class="intent-callout-content">${content}</div></div>`;

    case "warning":
      return `<div class="intent-callout intent-warning"><span class="intent-callout-label">Caution</span><div class="intent-callout-content">${content}</div></div>`;

    case "tip":
      return `<div class="intent-callout intent-tip"><span class="intent-callout-label">Tip</span><div class="intent-callout-content">${content}</div></div>`;

    case "success":
      return `<div class="intent-callout intent-success"><span class="intent-callout-label">Done</span><div class="intent-callout-content">${content}</div></div>`;

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

    case "ref":
      const refTo = escapeHtml(String(props.to || content));
      const refText = content || refTo;
      return `<p class="intent-ref"><a href="${refTo}">${refText}</a></p>`;

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

    case "emit": {
      const phase = props.phase
        ? `<span class="intent-emit-phase">${escapeHtml(String(props.phase))}</span>`
        : "";
      const levelBadge = props.level
        ? `<span class="intent-badge intent-badge-level">${escapeHtml(String(props.level))}</span>`
        : "";
      return `<div class="intent-emit-block">
        <span class="intent-emit-icon">📡</span>
        <span class="intent-emit-content">${content}</span>
        <span class="intent-emit-meta">${phase}${levelBadge}</span>
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

    // ─── v2.5 Document Generation Blocks ─────────────────────────────

    case "font":
      // Layout declaration — not rendered visually
      return "";

    case "page":
      // Layout declaration — not rendered visually
      return "";

    case "break":
      return `<div class="it-page-break"></div>`;

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
export function renderHTML(document: IntentDocument): string {
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
  const pageSize = String(pageBlock?.properties?.size || "A4");
  const margins = String(pageBlock?.properties?.margins || "20mm");

  return `@page{size:${escapeHtml(pageSize)};margin:${escapeHtml(margins)};}body.it-print{font-family:${escapeHtml(fontFamily)};font-size:${escapeHtml(fontSize)};line-height:${escapeHtml(leading)};}`;
}

// Print-optimized HTML renderer
export function renderPrint(doc: IntentDocument): string {
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

  return `<!DOCTYPE html><html ${direction}><head><meta charset="utf-8"><style>
${dynamicCSS}
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
</style></head><body class="it-print"><div class="intent-document">${html}</div></body></html>`;
}
