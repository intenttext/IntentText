import { IntentBlock, IntentDocument, InlineNode } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
          case "code":
            return `<code>${escapeHtml(node.value)}</code>`;
          case "link":
            return `<a href="${escapeHtml(sanitizeUrl(node.href))}" class="intent-inline-link">${escapeHtml(node.value)}</a>`;
          default:
            return escapeHtml((node as { value: string }).value);
        }
      })
      .join("");
  }

  return escapeHtml(originalContent || content);
}

// Helper function to render a single block
function renderBlock(block: IntentBlock): string {
  const content = applyInlineFormatting(
    block.content,
    block.inline,
    block.originalContent,
  );
  const props = block.properties || {};

  switch (block.type) {
    case "title":
      return `<h1 class="intent-title">${content}</h1>`;

    case "summary":
      return `<div class="intent-summary">${content}</div>`;

    case "section":
      return `<h2 class="intent-section">${content}</h2>`;

    case "sub":
      return `<h3 class="intent-sub">${content}</h3>`;

    case "divider":
      const label = content
        ? `<span class="intent-divider-label">${content}</span>`
        : "";
      return `<div class="intent-divider">
        <hr class="intent-divider-line" />
        ${label}
      </div>`;

    case "note":
    case "body-text":
      return `<p class="intent-note">${content}</p>`;

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

    case "schema": {
      const extendsBase = props.extends
        ? ` extends ${escapeHtml(String(props.extends))}`
        : "";
      return `<div class="intent-file-ref intent-schema"><span class="intent-file-ref-icon">📐</span> schema: ${content}${extendsBase}</div>`;
    }

    // ─── v2.1 Agentic Workflow Blocks ──────────────────────────────────

    case "status": {
      const phase = props.phase
        ? `<span class="intent-status-phase">${escapeHtml(String(props.phase))}</span>`
        : "";
      const updated = props.updated
        ? `<span class="intent-status-updated">${escapeHtml(String(props.updated))}</span>`
        : "";
      const levelBadge = props.level
        ? `<span class="intent-badge intent-badge-level">${escapeHtml(String(props.level))}</span>`
        : "";
      return `<div class="intent-status-block">
        <span class="intent-status-icon">📊</span>
        <span class="intent-status-content">${content}</span>
        <span class="intent-status-meta">${phase}${levelBadge}${updated}</span>
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
      const timeoutVal = props.timeout
        ? `<span class="intent-badge intent-badge-timeout">${escapeHtml(String(props.timeout))}</span>`
        : "";
      const fallbackVal = props.fallback
        ? `<span class="intent-wait-fallback">fallback → ${escapeHtml(String(props.fallback))}</span>`
        : "";
      return `<div class="intent-wait">
        <span class="intent-wait-icon">⏳</span>
        <span class="intent-wait-content">${content}</span>
        <span class="intent-wait-meta">${timeoutVal}${fallbackVal}</span>
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
      return `<div class="intent-parallel">
        <span class="intent-parallel-icon">⏩</span>
        <span class="intent-parallel-content">${content}</span>
        <span class="intent-parallel-steps">${stepBadges}</span>
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

    default:
      return `<div class="intent-unknown">
        <small class="intent-unknown-type">[${block.type}]</small> ${content}
      </div>`;
  }
}

// Render a list of blocks, properly grouping consecutive list/step items
// and recursing into section/sub children.
function renderBlocks(blocks: IntentBlock[]): string {
  let html = "";
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

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
      html += renderBlocks(block.children);
    }

    i++;
  }

  return html;
}

// Main HTML renderer function
export function renderHTML(document: IntentDocument): string {
  const html = renderBlocks(document.blocks);

  // Wrap in a container
  const direction =
    document.metadata?.language === "rtl" ? 'dir="rtl"' : 'dir="ltr"';

  return `<div class="intent-document" ${direction}>
<style>
.intent-document{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;color:#1e293b;max-width:760px;margin:0 auto;padding:32px 24px;}
.intent-title{font-size:1.9rem;line-height:1.2;margin:0 0 14px;letter-spacing:-0.02em;font-weight:700;}
.intent-summary{margin:12px 0 24px;padding:10px 0 10px 14px;border-left:3px solid #e2e8f0;color:#475569;font-style:italic;}
.intent-section{margin:28px 0 8px;font-size:1.15rem;line-height:1.3;font-weight:600;padding-bottom:5px;border-bottom:1px solid #e2e8f0;}
.intent-sub{margin:18px 0 6px;font-size:1rem;line-height:1.3;color:#374151;font-weight:600;}
.intent-note{margin:8px 0;color:#374151;}
.intent-divider{margin:22px 0;text-align:center;}
.intent-divider-line{border:none;border-top:1px solid #e2e8f0;margin:0;}
.intent-divider-label{display:inline-block;padding:0 12px;background:white;color:#94a3b8;font-size:0.8rem;position:relative;top:-10px;}
.intent-task{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;}
.intent-task-checkbox{margin-top:3px;flex-shrink:0;}
.intent-task-text{flex:1;}
.intent-task-meta{display:flex;gap:8px;color:#94a3b8;font-size:0.8rem;white-space:nowrap;}
.intent-task-owner::before{content:'@ ';opacity:0.6;}
.intent-task-due::before{content:'due ';}
.intent-task-time::before{content:'at ';}
.intent-task-text-done{text-decoration:line-through;color:#94a3b8;}
.intent-ask{display:flex;gap:12px;margin:12px 0;padding:8px 0 8px 14px;border-left:2px solid #94a3b8;align-items:baseline;}
.intent-ask-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;flex-shrink:0;line-height:1.65;}
.intent-ask-content{flex:1;color:#374151;font-style:italic;}
.intent-quote{margin:16px 0;padding:2px 0 2px 18px;border-left:3px solid #cbd5e1;font-style:italic;color:#475569;}
.intent-quote p{margin:0;line-height:1.7;}
.intent-quote-cite{display:block;margin-top:6px;font-style:normal;color:#94a3b8;font-size:0.82rem;}
.intent-code{margin:12px 0;padding:12px 14px;border-radius:6px;background:#0d1117;color:#e2e8f0;overflow-x:auto;}
.intent-code code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:0.875rem;}
.intent-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:0.9em;}
.intent-table th,.intent-table-th{padding:7px 12px;text-align:left;font-weight:600;color:#475569;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;}
.intent-table td,.intent-table-td{padding:8px 12px;text-align:left;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:top;}
.intent-row:last-child .intent-table-td,.intent-row:last-child td{border-bottom:none;}
.intent-image{margin:14px 0;}
.intent-image-img{max-width:100%;height:auto;border-radius:6px;border:1px solid #e2e8f0;}
.intent-image-caption{margin-top:6px;color:#64748b;font-size:0.82rem;text-align:center;}
.intent-link{margin:6px 0;}
.intent-link a{color:#2563eb;text-decoration:none;}
.intent-link a:hover{text-decoration:underline;}
.intent-ref{margin:6px 0;}
.intent-ref a{color:#2563eb;text-decoration:none;font-style:italic;}
.intent-ref a:hover{text-decoration:underline;}
.intent-unknown{margin:8px 0;padding:8px 12px;border:1px dashed #e2e8f0;border-radius:6px;color:#94a3b8;}
.intent-embed{margin:16px 0;}
.intent-embed iframe,.intent-embed video,.intent-embed audio{display:block;width:100%;border-radius:6px;border:1px solid #e2e8f0;}
.intent-callout{display:flex;gap:12px;margin:12px 0;padding:8px 0 8px 14px;border-left:2px solid;align-items:baseline;}
.intent-callout-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0;white-space:nowrap;line-height:1.65;}
.intent-callout-content{flex:1;color:#374151;}
.intent-info{border-color:#93c5fd;}
.intent-info .intent-callout-label{color:#2563eb;}
.intent-warning{border-color:#fcd34d;}
.intent-warning .intent-callout-label{color:#b45309;}
.intent-tip{border-color:#6ee7b7;}
.intent-tip .intent-callout-label{color:#047857;}
.intent-success{border-color:#6ee7b7;}
.intent-success .intent-callout-label{color:#047857;}
.intent-inline-link{color:#2563eb;text-decoration:none;}
.intent-inline-link:hover{text-decoration:underline;}
ul,ol{margin:8px 0 8px 20px;padding:0;}
li{margin:4px 0;color:#374151;}
/* v2 Agentic Workflow Blocks */
.intent-step{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;background:#fafbfc;}
.intent-step-icon{font-size:0.85rem;color:#3b82f6;flex-shrink:0;}
.intent-step-content{flex:1;font-weight:500;}
.intent-step-meta{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.intent-step-id{font-size:0.72rem;color:#94a3b8;font-family:monospace;}
.intent-step-depends{font-size:0.75rem;color:#6366f1;font-style:italic;}
.intent-badge{font-size:0.7rem;padding:2px 7px;border-radius:999px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;}
.intent-badge-tool{background:#ede9fe;color:#7c3aed;}
.intent-status-pending{background:#f1f5f9;color:#64748b;}
.intent-status-running{background:#dbeafe;color:#2563eb;animation:intent-pulse 1.5s ease-in-out infinite;}
.intent-status-blocked{background:#fff7ed;color:#c2410c;}
.intent-status-failed{background:#fef2f2;color:#dc2626;}
.intent-status-done{background:#ecfdf5;color:#059669;}
.intent-status-skipped,.intent-status-cancelled{background:#f1f5f9;color:#94a3b8;text-decoration:line-through;}
@keyframes intent-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
.intent-decision{display:flex;gap:12px;margin:10px 0;padding:10px 14px;border:1px solid #fbbf24;border-radius:8px;background:#fffbeb;}
.intent-decision-diamond{width:24px;height:24px;background:#fbbf24;transform:rotate(45deg);border-radius:3px;flex-shrink:0;margin-top:4px;}
.intent-decision-body{flex:1;}
.intent-decision-label{font-weight:600;margin-bottom:4px;}
.intent-decision-condition{font-size:0.85rem;color:#92400e;font-family:monospace;margin-bottom:4px;}
.intent-decision-branches{display:flex;gap:16px;font-size:0.82rem;}
.intent-decision-then{color:#059669;}
.intent-decision-else{color:#dc2626;}
.intent-trigger{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;background:#fefce8;}
.intent-trigger-icon{font-size:1rem;}
.intent-trigger-content{flex:1;font-weight:500;}
.intent-badge-event{background:#fef3c7;color:#b45309;}
.intent-loop{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;background:#f0fdf4;}
.intent-loop-icon{font-size:1rem;}
.intent-loop-content{flex:1;font-weight:500;}
.intent-loop-over,.intent-loop-do{font-size:0.8rem;color:#047857;font-family:monospace;}
.intent-checkpoint{display:flex;align-items:center;gap:8px;margin:18px 0;color:#64748b;font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;}
.intent-checkpoint-flag{font-size:1rem;}
.intent-checkpoint-label{flex-shrink:0;}
.intent-checkpoint-line{flex:1;border:none;border-top:2px dashed #cbd5e1;margin:0;}
.intent-audit{margin:4px 0;padding:5px 10px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.8rem;color:#64748b;background:#f8fafc;border-radius:4px;border-left:3px solid #cbd5e1;}
.intent-audit-prefix{color:#94a3b8;font-weight:600;}
.intent-error-block{border-color:#f87171;}
.intent-error-block .intent-callout-label{color:#dc2626;}
.intent-error-fallback{font-size:0.8rem;color:#c2410c;font-style:italic;margin-left:6px;}
.intent-error-notify{font-size:0.8rem;color:#c2410c;margin-left:6px;}
.intent-context-table{width:auto;border-collapse:collapse;margin:8px 0;font-size:0.85rem;background:#f8fafc;border-radius:6px;overflow:hidden;}
.intent-context-key{padding:4px 12px 4px 10px;font-weight:600;color:#475569;font-family:monospace;border-bottom:1px solid #e2e8f0;}
.intent-context-val{padding:4px 14px 4px 8px;color:#374151;font-family:monospace;border-bottom:1px solid #e2e8f0;}
.intent-context{margin:6px 0;font-size:0.85rem;color:#475569;}
.intent-progress{display:flex;align-items:center;gap:10px;margin:8px 0;}
.intent-progress-label{font-size:0.85rem;color:#374151;flex-shrink:0;}
.intent-progress-bar{flex:1;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;}
.intent-progress-fill{height:100%;background:#3b82f6;border-radius:999px;transition:width 0.3s;}
.intent-progress-pct{font-size:0.78rem;color:#64748b;font-weight:600;min-width:36px;text-align:right;}
.intent-file-ref{display:flex;align-items:center;gap:8px;margin:4px 0;padding:6px 10px;border:1px dashed #e2e8f0;border-radius:6px;font-size:0.82rem;color:#64748b;font-family:monospace;}
.intent-file-ref-icon{font-size:0.9rem;}
/* v2.1 Agentic Workflow Blocks */
.intent-status-block{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #c4b5fd;border-radius:6px;margin:6px 0;background:#f5f3ff;}
.intent-status-icon{font-size:1rem;}
.intent-status-content{flex:1;font-weight:500;color:#5b21b6;}
.intent-status-meta{display:flex;gap:6px;align-items:center;}
.intent-status-phase{font-size:0.78rem;color:#7c3aed;font-weight:600;}
.intent-status-updated{font-size:0.72rem;color:#94a3b8;font-style:italic;}
.intent-badge-level{background:#ede9fe;color:#6d28d9;}
.intent-result{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border-radius:6px;margin:6px 0;flex-wrap:wrap;}
.intent-result-success{border:1px solid #86efac;background:#f0fdf4;}
.intent-result-error,.intent-result-failure{border:1px solid #fca5a5;background:#fef2f2;}
.intent-result-icon{font-size:1rem;flex-shrink:0;}
.intent-result-content{flex:1;font-weight:500;}
.intent-badge-code{background:#dbeafe;color:#1e40af;font-family:monospace;}
.intent-result-data{width:100%;margin-top:4px;padding:6px 10px;background:#f8fafc;border-radius:4px;font-size:0.82rem;overflow-x:auto;}
.intent-result-data code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.82rem;color:#475569;}
.intent-handoff{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #fbbf24;border-radius:6px;margin:6px 0;background:#fffbeb;}
.intent-handoff-icon{font-size:1rem;}
.intent-handoff-content{flex:1;font-weight:500;}
.intent-handoff-arrow{display:flex;align-items:center;gap:6px;font-size:0.82rem;color:#92400e;font-weight:600;}
.intent-handoff-agent{padding:2px 6px;border-radius:4px;background:#fef3c7;font-family:monospace;font-size:0.78rem;}
.intent-wait{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #e2e8f0;border-radius:6px;margin:6px 0;background:#f8fafc;border-left:3px solid #94a3b8;}
.intent-wait-icon{font-size:1rem;animation:intent-pulse 2s ease-in-out infinite;}
.intent-wait-content{flex:1;font-weight:500;color:#475569;}
.intent-wait-meta{display:flex;gap:6px;align-items:center;}
.intent-badge-timeout{background:#fef3c7;color:#b45309;font-family:monospace;}
.intent-wait-fallback{font-size:0.8rem;color:#c2410c;font-style:italic;}
.intent-parallel{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #93c5fd;border-radius:6px;margin:6px 0;background:#eff6ff;}
.intent-parallel-icon{font-size:1rem;}
.intent-parallel-content{flex:1;font-weight:500;color:#1e40af;}
.intent-parallel-steps{display:flex;gap:4px;flex-wrap:wrap;}
.intent-badge-parallel-step{background:#dbeafe;color:#1e40af;font-family:monospace;font-size:0.72rem;padding:2px 6px;border-radius:999px;}
.intent-retry{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #fdba74;border-radius:6px;margin:6px 0;background:#fff7ed;}
.intent-retry-icon{font-size:1rem;}
.intent-retry-content{flex:1;font-weight:500;color:#c2410c;}
.intent-retry-meta{display:flex;gap:6px;align-items:center;}
.intent-badge-retry-max{background:#fed7aa;color:#9a3412;font-size:0.72rem;}
.intent-badge-retry-delay{background:#fed7aa;color:#9a3412;font-size:0.72rem;font-family:monospace;}
.intent-badge-retry-backoff{background:#ffedd5;color:#c2410c;font-size:0.72rem;font-style:italic;}
</style>
${html}
</div>`;
}
