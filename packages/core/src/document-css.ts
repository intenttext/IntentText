// Shared document element CSS — the .intent-*/.it-* rules used by both the
// screen renderer (renderHTML) and the print renderer (renderPrint), so print
// output is styled the same as screen (themes layer colors/fonts on top).
export const DOCUMENT_CSS = `
/* ── Base ──────────────────────────────────────────────── */
.intent-document{font-family:Georgia,'Times New Roman',serif;line-height:1.7;color:#111;max-width:680px;margin:0 auto;padding:32px 24px;}
/* ── Typography ────────────────────────────────────────── */
.intent-title{font-size:1.75rem;line-height:1.2;margin:0 0 12px;font-weight:700;letter-spacing:-0.01em;}
.intent-summary{margin:8px 0 20px;padding-block:8px;padding-inline:0;padding-inline-start:14px;border-inline-start:2px solid #999;color:#333;font-style:italic;font-size:0.95rem;}
.intent-section{margin:24px 0 8px;font-size:1.1rem;line-height:1.3;font-weight:600;padding-bottom:4px;border-bottom:1px solid #ccc;}
.intent-sub{margin:16px 0 6px;font-size:1rem;line-height:1.3;font-weight:600;}
.intent-note{margin:6px 0;color:#222;}
.intent-prose{margin:0 0 1em;color:#222;font-size:1rem;line-height:1.8;max-width:65ch;text-wrap:pretty;}
.intent-align-center{text-align:center;}
.intent-align-right{text-align:end;}
.intent-align-justify{text-align:justify;}
/* ── Two-sided rows (end:) — flex start/end, RTL-native ── */
.it-split{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
.it-split-main{min-width:0;}
.it-split-end{flex-shrink:0;}
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
.intent-ask{display:flex;gap:10px;margin:10px 0;padding-block:6px;padding-inline:0;padding-inline-start:12px;border-inline-start:2px solid #999;align-items:baseline;}
.intent-ask-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#555;flex-shrink:0;line-height:1.65;}
.intent-ask-content{flex:1;color:#333;font-style:italic;}
/* ── Quote ─────────────────────────────────────────────── */
.intent-quote{margin:14px 0;padding-block:2px;padding-inline:0;padding-inline-start:16px;border-inline-start:2px solid #999;font-style:italic;color:#333;}
.intent-quote p{margin:0;line-height:1.7;}
.intent-quote-cite{display:block;margin-top:5px;font-style:normal;color:#888;font-size:0.82rem;}
/* ── Code ──────────────────────────────────────────────── */
.intent-code{margin:10px 0;padding:10px 12px;background:#f5f5f5;border:1px solid #ddd;overflow-x:auto;}
.intent-code code{font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:0.85rem;color:#111;}
/* ── Table ─────────────────────────────────────────────── */
.intent-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:0.9em;}
.intent-table th,.intent-table-th{padding:6px 10px;text-align:start;font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid #333;}
.intent-table td,.intent-table-td{padding:6px 10px;text-align:start;border-bottom:1px solid #ddd;vertical-align:top;}
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
.intent-callout{display:flex;gap:10px;margin:10px 0;padding-block:6px;padding-inline:0;padding-inline-start:12px;border-inline-start:2px solid #888;align-items:baseline;}
.intent-callout-label{font-size:0.68rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0;white-space:nowrap;line-height:1.65;color:#444;}
.intent-callout-content{flex:1;color:#222;}
/* Info is the quiet variant: a soft gray panel with an ⓘ marker and italic
   text — "this is worth noting", not an alarm. */
.intent-info{background:#f5f6f8;border-inline-start:3px solid #c7ccd3;border-radius:0 3px 3px 0;padding-block:8px;padding-inline-start:12px;padding-inline-end:14px;}
.intent-info .intent-callout-label{display:none;}
.intent-info .intent-callout-content{font-style:italic;color:#4f4f4f;}
.intent-info .intent-callout-content::before{content:"ⓘ ";font-style:normal;font-weight:600;color:#6e6e6e;}
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
.intent-audit{margin:4px 0;padding:4px 8px;font-family:'SFMono-Regular',Consolas,monospace;font-size:0.8rem;color:#555;border-inline-start:2px solid #bbb;}
.intent-audit-prefix{color:#888;font-weight:600;}
.intent-error-block{border-color:#999;}
.intent-error-block .intent-callout-label{color:#333;}
.intent-error-fallback{font-size:0.8rem;color:#555;font-style:italic;margin-inline-start:6px;}
.intent-error-notify{font-size:0.8rem;color:#555;margin-inline-start:6px;}
.intent-context-table{width:auto;border-collapse:collapse;margin:6px 0;font-size:0.85rem;}
.intent-context-key{padding:3px 10px 3px 8px;font-weight:600;color:#333;font-family:monospace;border-bottom:1px solid #ddd;}
.intent-context-val{padding:3px 12px 3px 6px;color:#333;font-family:monospace;border-bottom:1px solid #ddd;}
.intent-context{margin:4px 0;font-size:0.85rem;color:#333;}
.intent-progress{display:flex;align-items:center;gap:8px;margin:6px 0;}
.intent-progress-label{font-size:0.85rem;color:#222;flex-shrink:0;}
.intent-progress-bar{flex:1;height:6px;background:#ddd;overflow:hidden;}
.intent-progress-fill{height:100%;background:#555;}
.intent-progress-pct{font-size:0.78rem;color:#555;font-weight:600;min-width:36px;text-align:end;}
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
.intent-wait{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;border-inline-start:2px solid #999;}
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
.it-epigraph .it-epigraph-by{display:block;text-align:end;font-size:0.9em;margin-top:4px;font-style:normal;color:#666;}
.it-caption{font-size:0.85em;font-style:italic;text-align:center;color:#444;margin-top:3px;margin-bottom:10px;}
.it-dedication{font-style:italic;text-align:center;margin:3em auto;}
.it-toc{margin:20px 0;}
.it-toc-title{font-size:1.1rem;font-weight:600;margin-bottom:8px;border:none;}
.it-toc ol{list-style:none;padding:0;margin:0;}
.it-toc li{margin:3px 0;}
.it-toc li a{color:#111;text-decoration:none;border-bottom:1px dotted #bbb;}
.it-toc li a:hover{border-bottom-style:solid;}
.it-toc .it-toc-sub{padding-inline-start:20px;font-size:0.92em;}
.it-footnotes{border-top:1px solid #ccc;margin-top:24px;padding-top:8px;font-size:0.85em;color:#444;}
.it-footnotes ol{padding-inline-start:1.5em;margin:0;}
.it-footnotes li{margin:3px 0;}
sup.it-fn-ref{font-size:0.7em;vertical-align:super;}
sup.it-fn-ref a{color:#111;text-decoration:none;border-bottom:1px solid #999;}
/* ── v2.8 Document Trust ───────────────────────────────── */
/* Trust blocks are typeset like entries in a legal document — hairlines and
   small-caps labels, no colored fills (ink-first; prints exactly as shown). */
.it-approval{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin:12px 0;padding:7px 2px;border-bottom:1px solid #ddd;}
.it-approval__icon{display:none;}
.it-approval__body{display:contents;}
.it-approval__label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#2e7d32;flex-shrink:0;}
.it-approval__label::before{content:'✓ ';}
.it-approval__what{font-size:0.9rem;font-weight:600;color:#111;}
.it-approval__who{font-size:0.9rem;color:#555;}
.it-approval__date{font-size:0.8rem;color:#777;margin-inline-start:auto;font-variant-numeric:tabular-nums;}
.it-signature{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin:14px 0 10px;padding:7px 2px 5px;border-top:1px solid #111;}
.it-signature--valid{border-top-color:#111;}
.it-signature--invalid{border-top-color:#c62828;}
.it-signature__name{font-weight:600;font-size:0.95rem;color:#111;}
.it-signature__role{font-size:0.85rem;color:#555;}
.it-signature__date{font-size:0.8rem;color:#777;font-variant-numeric:tabular-nums;}
.it-signature__status{font-size:0.72rem;font-weight:600;margin-inline-start:auto;text-transform:uppercase;letter-spacing:0.08em;color:#2e7d32;}
.it-signature--invalid .it-signature__status{color:#c62828;}
.it-sealed-banner{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;margin:18px 0;padding:8px 2px;border-top:1px solid #111;border-bottom:1px solid #111;}
.it-sealed-banner__icon{display:none;}
.it-sealed-banner__text{font-size:0.78rem;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.14em;}
.it-sealed-banner__date{font-size:0.8rem;color:#666;margin-inline-start:auto;font-variant-numeric:tabular-nums;}
.it-sealed-banner__hash{font-size:0.72rem;color:#999;font-family:'SFMono-Regular',Consolas,monospace;}
/* ── v2.11 Keyword Expansion ──────────────────────────── */
.it-ref-card{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid #ddd;margin:5px 0;}
.it-ref-icon{font-size:1rem;flex-shrink:0;}
.it-ref-link{color:#111;text-decoration:underline;font-weight:500;}
.it-ref-name{font-weight:500;}
.it-ref-rel{font-size:0.7rem;padding:1px 6px;border:1px solid #bbb;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;}
.it-def{margin:6px 0;padding:4px 0;}
.it-def-term{font-weight:700;font-size:0.95rem;color:#111;}
.it-def-abbr{font-weight:400;color:#555;}
.it-def-meaning{margin:2px 0 0 0;color:#333;font-size:0.92rem;padding-inline-start:1em;}
.it-metric{display:inline-block;padding:10px 14px;border:1px solid #ddd;margin:5px;min-width:140px;vertical-align:top;}
.it-metric-name{font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#555;}
.it-metric-value{font-size:1.6rem;font-weight:700;line-height:1.2;color:#111;}
.it-metric-unit{font-size:0.85rem;font-weight:400;color:#666;margin-inline-start:2px;}
.it-metric-target{font-size:0.78rem;color:#888;}
.it-metric-trend{font-size:1rem;font-weight:700;margin-top:2px;}
.it-metric-period{font-size:0.72rem;color:#888;}
.it-metric-green{border-color:#4caf50;}
.it-metric-green .it-metric-value{color:#2e7d32;}
.it-metric-red{border-color:#c62828;}
.it-metric-red .it-metric-value{color:#c62828;}
.it-metric-neutral{border-color:#ddd;}
/* Document total/line rows (invoice, receipt, statement) — matches the editor's
   itMetric node so editor-designed templates print identically. */
.it-metric-row{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid var(--it-color-border,#e5e7eb);}
.it-metric-row__label{color:var(--it-color-muted,#555);}
.it-metric-row__value{font-variant-numeric:tabular-nums;font-weight:600;color:var(--it-color-text,#111);white-space:nowrap;}
.it-metric-row--total{border-bottom:none;border-top:2px solid var(--it-color-text,#333);margin-top:2px;padding-top:8px;font-size:1.05em;}
.it-metric-row--total .it-metric-row__label{color:var(--it-color-text,#111);font-weight:600;}
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
.it-deadline{padding:8px 12px;border-inline-start:3px solid #4caf50;margin:5px 0;}
.it-deadline-name{font-weight:600;color:#111;}
.it-deadline-date{font-size:0.9rem;font-weight:600;color:#111;}
.it-deadline-consequence{font-size:0.85rem;color:#555;font-style:italic;}
.it-deadline-owner{font-size:0.82rem;color:#555;}
.it-deadline-authority{font-size:0.82rem;color:#555;}
.it-deadline-green{border-color:#4caf50;}
.it-deadline-amber{border-color:#f57c00;}
.it-deadline-red{border-color:#c62828;}
`;
