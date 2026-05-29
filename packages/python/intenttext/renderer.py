from __future__ import annotations

import html
import os

from .rust_bridge import render_html_with_rust_core, should_fallback_to_python
from .source import to_source
from .types import IntentBlock, IntentDocument


BASE_CSS = """
.it-document { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #222; }
.it-block { margin: 0.6rem 0; }
.it-section { margin-top: 1.4rem; }
.it-sub { margin-top: 1rem; }
.it-callout { padding: 0.75rem 1rem; border-radius: 6px; border-left: 4px solid; }
.it-callout.info { background: #eef6ff; border-color: #1d70b8; }
.it-callout.warning { background: #fff7e6; border-color: #b26a00; }
.it-callout.tip { background: #eefbf2; border-color: #1f7a3d; }
.it-callout.success { background: #eefbf2; border-color: #1f7a3d; }
.it-task { display: flex; gap: 0.5rem; }
.it-task.done { color: #666; text-decoration: line-through; }
.it-table { width: 100%; border-collapse: collapse; }
.it-table th, .it-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
.it-table th { background: #f5f5f5; }
.it-divider { border: 0; border-top: 1px solid #ddd; margin: 1rem 0; }
""".strip()


def render_html(doc: IntentDocument, include_css: bool = True) -> str:
    engine = os.getenv("INTENTTEXT_PY_RENDER_ENGINE", "py").strip().lower()
    if engine in {"rust", "core"}:
        try:
            source = to_source(doc)
            return render_html_with_rust_core(source, include_css=include_css)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _render_html_with_python(doc, include_css)


def _render_html_with_python(doc: IntentDocument, include_css: bool = True) -> str:
    parts: list[str] = []
    if include_css:
        parts.append(f"<style>{BASE_CSS}</style>")

    parts.append('<div class="it-document">')
    for block in doc.blocks:
        parts.append(_render_block_html(block))
    parts.append("</div>")

    return "\n".join(p for p in parts if p)


def render_print(doc: IntentDocument) -> str:
    css = (
        BASE_CSS
        + "\n@media print { .it-document { font-family: Georgia, serif; } .it-block { break-inside: avoid; } }"
    )
    body = render_html(doc, include_css=False)
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\"/>"
        f"<style>{css}</style></head><body>{body}</body></html>"
    )


def render_markdown(doc: IntentDocument) -> str:
    lines: list[str] = []

    for block in doc.blocks:
        t = block.type
        content = block.original_content or block.content

        if t == "title":
            lines.append(f"# {content}")
        elif t == "section":
            lines.append(f"## {content}")
        elif t == "sub":
            lines.append(f"### {content}")
        elif t == "text":
            lines.append(content)
        elif t in {"task", "done"}:
            checked = t == "done" or str(block.properties.get("status", "")).lower() == "done"
            lines.append(f"- [{'x' if checked else ' '}] {content}")
        elif t == "quote":
            author = block.properties.get("by")
            lines.append(f"> {content}")
            if author:
                lines.append(f"> - {author}")
        elif t in {"info", "warning", "tip", "danger"}:
            lines.append(f"> **{t.upper()}:** {content}")
        elif t == "success":
            lines.append(f"> **SUCCESS:** {content}")
        elif t == "table":
            rows = block.properties.get("rows", [])
            if rows:
                header = rows[0]
                lines.append("| " + " | ".join(str(v) for v in header) + " |")
                lines.append("| " + " | ".join("---" for _ in header) + " |")
                for row in rows[1:]:
                    lines.append("| " + " | ".join(str(v) for v in row) + " |")
        elif t == "divider":
            lines.append("---")
        else:
            lines.append(f"{content}")

        if lines and lines[-1] != "":
            lines.append("")

    return "\n".join(lines).strip() + "\n"


def _render_block_html(block: IntentBlock) -> str:
    t = block.type
    content = html.escape(block.content)

    if t == "title":
        return f'<h1 class="it-block it-title">{content}</h1>'
    if t == "summary":
        return f'<p class="it-block it-summary">{content}</p>'
    if t == "section":
        return f'<h2 class="it-block it-section">{content}</h2>'
    if t == "sub":
        return f'<h3 class="it-block it-sub">{content}</h3>'
    if t == "quote":
        by = block.properties.get("by")
        footer = f"<cite>{html.escape(str(by))}</cite>" if by else ""
        return f'<blockquote class="it-block it-quote"><p>{content}</p>{footer}</blockquote>'
    if t in {"text", "info", "warning", "danger", "tip", "success"}:
        extra = "it-callout " + (t if t != "text" else "info")
        return f'<div class="it-block {extra}"><span class="it-keyword">{t}:</span> {content}</div>'
    if t in {"task", "done"}:
        done = t == "done" or str(block.properties.get("status", "")).lower() == "done"
        mark = "[x]" if done else "[ ]"
        done_cls = " done" if done else ""
        return f'<div class="it-block it-task{done_cls}"><span>{mark}</span><span>{content}</span></div>'
    if t == "image":
        src = html.escape(str(block.properties.get("src", "")))
        alt = html.escape(str(block.properties.get("alt", block.content)))
        return f'<figure class="it-block it-image"><img src="{src}" alt="{alt}"/></figure>'
    if t == "link":
        href = html.escape(str(block.properties.get("href", "#")))
        return f'<p class="it-block it-link"><a href="{href}">{content}</a></p>'
    if t == "code":
        return f'<pre class="it-block it-code"><code>{content}</code></pre>'
    if t == "table":
        rows = block.properties.get("rows", [])
        if not rows:
            return ""
        header = rows[0]
        body_rows = rows[1:]
        thead = "".join(f"<th>{html.escape(str(c))}</th>" for c in header)
        tbody = "".join(
            "<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in row) + "</tr>"
            for row in body_rows
        )
        return f'<table class="it-block it-table"><thead><tr>{thead}</tr></thead><tbody>{tbody}</tbody></table>'
    if t == "divider":
        return '<hr class="it-block it-divider"/>'
    if t == "byline":
        date = block.properties.get("date", "")
        pub = block.properties.get("publication", "")
        meta = ""
        if date:
            meta += f' <span class="it-date">{html.escape(str(date))}</span>'
        if pub:
            meta += f' <span class="it-publication">{html.escape(str(pub))}</span>'
        return f'<p class="it-block it-byline">{content}{meta}</p>'
    if t == "epigraph":
        by = block.properties.get("by")
        attr = f"<cite>{html.escape(str(by))}</cite>" if by else ""
        return f'<blockquote class="it-block it-epigraph"><p>{content}</p>{attr}</blockquote>'
    if t == "caption":
        return f'<figcaption class="it-block it-caption">{content}</figcaption>'
    if t == "footnote":
        text = block.properties.get("text", content)
        return f'<aside class="it-block it-footnote"><sup>{content}</sup> {html.escape(str(text))}</aside>'
    if t == "toc":
        return f'<nav class="it-block it-toc"><strong>{content or "Table of Contents"}</strong></nav>'
    if t == "dedication":
        return f'<p class="it-block it-dedication"><em>{content}</em></p>'
    if t == "badge":
        return f'<span class="it-block it-badge">{content}</span>'
    # Trust blocks
    if t == "track":
        version = block.properties.get("version", "")
        by = block.properties.get("by", "")
        return f'<div class="it-block it-track">Tracking v{html.escape(str(version))} by {html.escape(str(by))}</div>'
    if t == "approve":
        by = block.properties.get("by", "")
        role = block.properties.get("role", "")
        return f'<div class="it-block it-approve">{content} — {html.escape(str(by))}{" (" + html.escape(str(role)) + ")" if role else ""}</div>'
    if t == "sign":
        role = block.properties.get("role", "")
        return f'<div class="it-block it-sign">Signed: {content}{" (" + html.escape(str(role)) + ")" if role else ""}</div>'
    if t == "freeze":
        return f'<div class="it-block it-freeze">Document sealed{" — " + html.escape(str(block.properties.get("status", ""))) if block.properties.get("status") else ""}</div>'
    if t == "revision":
        return f'<div class="it-block it-revision">{content}</div>'
    # Print layout
    if t in {"header", "footer", "watermark"}:
        return f'<div class="it-block it-{t}">{content}</div>'
    if t == "signline":
        return f'<div class="it-block it-signline"><hr/><span>{content}</span></div>'
    # v2.11 expansion
    if t == "def":
        meaning = block.properties.get("meaning", "")
        return f'<dl class="it-block it-def"><dt>{content}</dt><dd>{html.escape(str(meaning))}</dd></dl>'
    if t == "metric":
        value = block.properties.get("value", "")
        return f'<div class="it-block it-metric"><strong>{content}</strong>: {html.escape(str(value))}</div>'
    if t == "amendment":
        return f'<div class="it-block it-amendment">{content}</div>'
    if t == "figure":
        return f'<figure class="it-block it-figure">{content}</figure>'
    if t == "contact":
        role = block.properties.get("role", "")
        email = block.properties.get("email", "")
        parts = [content]
        if role:
            parts.append(html.escape(str(role)))
        if email:
            parts.append(f'<a href="mailto:{html.escape(str(email))}">{html.escape(str(email))}</a>')
        return f'<div class="it-block it-contact">{" — ".join(parts)}</div>'
    if t == "deadline":
        date = block.properties.get("date", "")
        return f'<div class="it-block it-deadline">{content}{" — " + html.escape(str(date)) if date else ""}</div>'
    # Agentic blocks
    if t in {"step", "decision", "gate", "checkpoint", "handoff", "trigger",
             "audit", "signal", "result", "policy", "error", "retry", "wait",
             "parallel", "loop", "call", "progress", "import", "export",
             "memory", "prompt", "tool"}:
        return f'<div class="it-block it-agentic it-{t}"><span class="it-keyword">{t}:</span> {content}</div>'
    if t == "assert":
        return f'<div class="it-block it-agentic it-assert"><span class="it-keyword">assert:</span> {content}</div>'
    if t == "secret":
        return f'<div class="it-block it-secret">[REDACTED]</div>'
    if t == "cite":
        author = block.properties.get("author", "")
        date = block.properties.get("date", "")
        cite_url = block.properties.get("url", "")
        parts = [content]
        if author:
            parts.append(html.escape(str(author)))
        if date:
            parts.append(html.escape(str(date)))
        if cite_url:
            parts.append(f'<a href="{html.escape(str(cite_url))}">{html.escape(str(cite_url))}</a>')
        return f'<blockquote class="it-block it-cite"><p>{" — ".join(parts)}</p></blockquote>'
    if t == "danger":
        return f'<div class="it-block it-callout danger"><span class="it-keyword">danger:</span> {content}</div>'
    if t == "columns":
        return f'<div class="it-block it-columns">{content}</div>'
    if t == "input":
        return f'<div class="it-block it-input"><span class="it-keyword">input:</span> {content}</div>'
    if t == "output":
        return f'<div class="it-block it-output"><span class="it-keyword">output:</span> {content}</div>'
    if t == "history":
        return ''
    if t == "agent":
        return ''
    if t == "model":
        return ''
    if t == "meta":
        return f'<div class="it-block it-meta">{content}</div>'
    if t == "embed":
        return f'<div class="it-block it-embed">{content}</div>'

    return f'<p class="it-block it-{html.escape(t)}">{content}</p>'
