//! HTML renderer — converts an IntentDocument to HTML.
//!
//! Parity target: packages/core/src/renderer.ts
//! Supports print mode, themes, and per-block CSS classes.

use crate::inline::parse_inline;
use crate::types::{InlineNode, IntentBlock, IntentDocument, PrintLayout, RenderOptions};

/// Extract page/header/footer/watermark/break blocks for print layout control.
pub fn collect_print_layout(document: &IntentDocument) -> PrintLayout {
    let mut layout = PrintLayout::default();
    let mut stack: Vec<&IntentBlock> = document.blocks.iter().rev().collect();

    while let Some(block) = stack.pop() {
        if let Some(children) = &block.children {
            for child in children.iter().rev() {
                stack.push(child);
            }
        }

        match block.block_type.as_str() {
            "page" => {
                if layout.page.is_none() {
                    layout.page = Some(block.clone());
                }
            }
            "header" => layout.header = Some(block.clone()),
            "footer" => layout.footer = Some(block.clone()),
            "watermark" => layout.watermark = Some(block.clone()),
            "break" => {
                let has_rule = block
                    .properties
                    .as_ref()
                    .map(|p| p.contains_key("before") || p.contains_key("keep"))
                    .unwrap_or(false);
                if has_rule {
                    layout.breaks.push(block.clone());
                }
            }
            _ => {}
        }
    }

    layout
}

/// Render print-optimized full HTML output.
pub fn render_print(document: &IntentDocument, options: Option<RenderOptions>) -> String {
    if document.blocks.is_empty() {
        return String::new();
    }

    let mut opts = options.unwrap_or_default();
    opts.print_mode = true;
    let body = render(document, Some(opts));
    let dir = if document
        .metadata
        .as_ref()
        .and_then(|m| m.language.as_ref())
        .map(|l| l.eq_ignore_ascii_case("rtl"))
        .unwrap_or(false)
    {
        "rtl"
    } else {
        "ltr"
    };

    // Keep print CSS intentionally minimal and deterministic.
    format!(
        "<!DOCTYPE html><html dir=\"{dir}\"><head><meta charset=\"utf-8\"><style>@media print{{body{{margin:0;}}a{{text-decoration:none;color:inherit;}}}}body.it-print{{color:#000;background:#fff;}}</style></head><body class=\"it-print\">{body}</body></html>"
    )
}

/// Render a document to an HTML string.
pub fn render(document: &IntentDocument, options: Option<RenderOptions>) -> String {
    let opts = options.unwrap_or_default();
    let dir = if document
        .metadata
        .as_ref()
        .and_then(|m| m.language.as_ref())
        .map(|l| l.eq_ignore_ascii_case("rtl"))
        .unwrap_or(false)
    {
        "rtl"
    } else {
        "ltr"
    };

    let body = render_blocks(&document.blocks, document, &opts);
    let footnotes = render_footnotes(document);
    format!("<div class=\"intent-document\" dir=\"{dir}\">\n{body}{footnotes}</div>\n")
}

fn render_blocks(blocks: &[IntentBlock], doc: &IntentDocument, opts: &RenderOptions) -> String {
    let mut html = String::new();
    let mut i = 0;

    while i < blocks.len() {
        let block = &blocks[i];

        if block.block_type == "history" {
            i += 1;
            continue;
        }

        if block.block_type == "list-item" {
            html.push_str("<ul class=\"intent-list\">");
            while i < blocks.len() && blocks[i].block_type == "list-item" {
                html.push_str(&render_block(&blocks[i], opts));
                i += 1;
            }
            html.push_str("</ul>");
            continue;
        }

        if block.block_type == "step-item" {
            html.push_str("<ol class=\"intent-list\">");
            while i < blocks.len() && blocks[i].block_type == "step-item" {
                html.push_str(&render_block(&blocks[i], opts));
                i += 1;
            }
            html.push_str("</ol>");
            continue;
        }

        if block.block_type == "toc" {
            html.push_str(&render_toc(block, doc));
            i += 1;
            continue;
        }

        if block.block_type == "columns" || block.block_type == "table" {
            html.push_str(&render_table(block));
            i += 1;
            while i < blocks.len() && blocks[i].block_type == "row" {
                i += 1;
            }
            continue;
        }

        if block.block_type == "row"
            || block.block_type == "footnote"
            || block.block_type == "font"
            || block.block_type == "page"
        {
            i += 1;
            continue;
        }

        html.push_str(&render_block(block, opts));

        if (block.block_type == "section" || block.block_type == "sub")
            && block.children.as_ref().is_some_and(|c| !c.is_empty())
        {
            html.push_str(&render_blocks(
                block.children.as_deref().unwrap_or(&[]),
                doc,
                opts,
            ));
        }

        i += 1;
    }

    html
}

fn render_block(block: &IntentBlock, opts: &RenderOptions) -> String {
    let props = block.properties.as_ref();
    let content_html = render_inline_nodes(&block.content, block.inline.as_deref());

    match block.block_type.as_str() {
        "title" => format!("<h1 class=\"intent-title\">{}</h1>\n", content_html),
        "summary" => format!("<div class=\"intent-summary\">{}</div>\n", content_html),
        "section" => format!(
            "<h2 id=\"{}\" class=\"intent-section\">{}</h2>\n",
            esc(&slugify(&block.content)),
            content_html
        ),
        "sub" => format!(
            "<h3 id=\"{}\" class=\"intent-sub\">{}</h3>\n",
            esc(&slugify(&block.content)),
            content_html
        ),
        "text" => {
            let style_attr = render_style_attr(props);
            let align_class = render_align_class(props);
            format!("<p class=\"intent-text{align_class}\"{style_attr}>{content_html}</p>\n")
        }
        "body-text" => {
            let style_attr = render_style_attr(props);
            let align_class = render_align_class(props);
            format!("<p class=\"intent-prose{align_class}\"{style_attr}>{content_html}</p>\n")
        }
        "byline" => {
            let date = props
                .and_then(|p| p.get("date"))
                .map(String::as_str)
                .unwrap_or("");
            let publication = props
                .and_then(|p| p.get("publication"))
                .map(String::as_str)
                .unwrap_or("");
            let role = props
                .and_then(|p| p.get("role"))
                .map(String::as_str)
                .unwrap_or("");

            let mut meta_parts: Vec<String> = Vec::new();
            if !role.is_empty() {
                meta_parts.push(esc(role));
            }
            if !date.is_empty() {
                meta_parts.push(esc(date));
            }
            if !publication.is_empty() {
                meta_parts.push(esc(publication));
            }

            let meta_html = if meta_parts.is_empty() {
                String::new()
            } else {
                format!(
                    "<span class=\"it-byline-meta\">{}</span>",
                    meta_parts.join(" · ")
                )
            };

            format!(
                "<div class=\"it-byline\"><span class=\"it-byline-author\">{}</span>{meta_html}</div>\n",
                content_html
            )
        }
        "epigraph" => {
            let by = props
                .and_then(|p| p.get("by"))
                .map(String::as_str)
                .unwrap_or("");
            let by_html = if by.is_empty() {
                String::new()
            } else {
                format!("<span class=\"it-epigraph-by\">— {}</span>", esc(by))
            };
            format!(
                "<blockquote class=\"it-epigraph\"><p>{}</p>{by_html}</blockquote>\n",
                content_html
            )
        }
        "caption" => {
            format!(
                "<figcaption class=\"it-caption\">{}</figcaption>\n",
                content_html
            )
        }
        "dedication" => {
            format!("<div class=\"it-dedication\">{}</div>\n", content_html)
        }
        "divider" => {
            let style = props
                .and_then(|p| p.get("style"))
                .map(String::as_str)
                .unwrap_or("solid");
            format!(
                "<div class=\"it-divider\"><hr class=\"it-divider\" style=\"border-style: {}\"></div>\n",
                esc(style)
            )
        }
        "quote" => {
            let author = props
                .and_then(|p| p.get("author"))
                .map(String::as_str)
                .unwrap_or("");
            if author.is_empty() {
                format!("<blockquote class=\"it-quote\">{content_html}</blockquote>\n")
            } else {
                let author_html = esc(author);
                format!(
                    "<blockquote class=\"it-quote\">{content_html}<footer class=\"it-quote__author\">{author_html}</footer></blockquote>\n"
                )
            }
        }
        "cite" => render_tag("cite", "it-cite", &block.content, true),
        "code" => {
            let lang = props
                .and_then(|p| p.get("lang"))
                .map(String::as_str)
                .unwrap_or("");
            let code_content = esc(&block.content);
            if lang.is_empty() {
                format!("<pre class=\"intent-code\"><code>{code_content}</code></pre>\n")
            } else {
                format!("<pre class=\"intent-code\" data-lang=\"{lang}\"><code class=\"language-{lang}\">{code_content}</code></pre>\n")
            }
        }
        "image" => {
            let src = props
                .and_then(|p| {
                    p.get("src")
                        .or_else(|| p.get("at"))
                        .or_else(|| p.get("url"))
                })
                .map(String::as_str)
                .unwrap_or(&block.content);
            let alt = props
                .and_then(|p| p.get("alt"))
                .map(String::as_str)
                .unwrap_or(&block.content);
            let caption = props
                .and_then(|p| p.get("caption"))
                .map(String::as_str)
                .unwrap_or("");
            let src_esc = esc(src);
            let alt_esc = esc(alt);
            if caption.is_empty() {
                format!("<figure class=\"intent-image\"><img class=\"intent-image-img\" src=\"{src_esc}\" alt=\"{alt_esc}\"></figure>\n")
            } else {
                let cap = render_inline(caption);
                format!(
                    "<figure class=\"intent-image\"><img class=\"intent-image-img\" src=\"{src_esc}\" alt=\"{alt_esc}\"><figcaption class=\"intent-image-caption\">{cap}</figcaption></figure>\n"
                )
            }
        }
        "link" => {
            let href = props
                .and_then(|p| {
                    p.get("to")
                        .or_else(|| p.get("href"))
                        .or_else(|| p.get("url"))
                })
                .map(String::as_str)
                .unwrap_or(&block.content);
            let label = if block.content.is_empty() {
                href
            } else {
                &block.content
            };
            let safe_href = sanitize_url(href);
            let href_esc = esc(&safe_href);
            let label_html = render_inline(label);
            format!("<p class=\"intent-link\"><a href=\"{href_esc}\">{label_html}</a></p>\n")
        }
        "info" => render_callout(block),
        "task" => render_task(block, false),
        "done" => render_task(block, true),
        "ask" => {
            let html = render_inline(&block.content);
            format!("<div class=\"intent-ask\"><span class=\"intent-ask-label\">Query</span><div class=\"intent-ask-content\">{html}</div></div>\n")
        }
        "decision" => render_tag("div", "it-decision", &block.content, true),
        "step" => {
            let id = props
                .and_then(|p| p.get("id"))
                .map(String::as_str)
                .unwrap_or("");
            let tool = props
                .and_then(|p| p.get("tool"))
                .map(String::as_str)
                .unwrap_or("");
            let status = props
                .and_then(|p| p.get("status"))
                .map(String::as_str)
                .unwrap_or("");
            let html = render_inline(&block.content);
            let mut attrs = "class=\"intent-step\"".to_string();
            if !id.is_empty() {
                attrs.push_str(&format!(" id=\"{}\"", esc(id)));
            }
            if !tool.is_empty() {
                attrs.push_str(&format!(" data-tool=\"{}\"", esc(tool)));
            }
            if !status.is_empty() {
                attrs.push_str(&format!(" data-status=\"{}\"", esc(status)));
            }
            format!("<div {attrs}><p>{html}</p></div>\n")
        }
        "gate" => {
            let html = render_inline(&block.content);
            let approver = props
                .and_then(|p| p.get("approver"))
                .map(String::as_str)
                .unwrap_or("");
            if approver.is_empty() {
                format!("<div class=\"it-gate\"><p>{html}</p></div>\n")
            } else {
                let app = esc(approver);
                format!("<div class=\"it-gate\" data-approver=\"{app}\"><p>{html}</p></div>\n")
            }
        }
        "trigger" => render_tag_data(block, "div", "it-trigger"),
        "result" => render_tag("div", "it-result", &block.content, true),
        "policy" => {
            let name_html = render_inline(&block.content);
            let if_rule = props
                .and_then(|p| p.get("if"))
                .map(String::as_str)
                .unwrap_or("");
            let always_rule = props
                .and_then(|p| p.get("always"))
                .map(String::as_str)
                .unwrap_or("");
            let never_rule = props
                .and_then(|p| p.get("never"))
                .map(String::as_str)
                .unwrap_or("");
            let action = props
                .and_then(|p| p.get("action"))
                .map(String::as_str)
                .unwrap_or("");
            let requires = props
                .and_then(|p| p.get("requires"))
                .map(String::as_str)
                .unwrap_or("");

            let mut out = format!(
                "<div class=\"it-policy\"><div class=\"it-policy-name\">{}</div>",
                name_html
            );
            if !if_rule.is_empty() {
                out.push_str(&format!(
                    "<div class=\"it-policy-condition\">if {}</div>",
                    esc(if_rule)
                ));
            }
            if !always_rule.is_empty() {
                out.push_str(&format!(
                    "<div class=\"it-policy-always\">always: {}</div>",
                    esc(always_rule)
                ));
            }
            if !never_rule.is_empty() {
                out.push_str(&format!(
                    "<div class=\"it-policy-never\">never: {}</div>",
                    esc(never_rule)
                ));
            }
            if !action.is_empty() {
                out.push_str(&format!(
                    "<div class=\"it-policy-action\">→ {}</div>",
                    esc(action)
                ));
            }
            if !requires.is_empty() {
                out.push_str(&format!(
                    "<div class=\"it-policy-requires\">requires: {}</div>",
                    esc(requires)
                ));
            }
            out.push_str("</div>\n");
            out
        }
        "audit" => render_tag("div", "it-audit", &block.content, false),
        "metric" => render_metric(block),
        "ref" => {
            let rel = props
                .and_then(|p| p.get("rel"))
                .map(String::as_str)
                .unwrap_or("");
            let href = props
                .and_then(|p| p.get("file").or_else(|| p.get("url")))
                .map(String::as_str)
                .unwrap_or("");
            let link = if href.is_empty() {
                format!(
                    "<span class=\"it-ref-name\">{}</span>",
                    render_inline(&block.content)
                )
            } else {
                format!(
                    "<a class=\"it-ref-link\" href=\"{}\">{}</a>",
                    esc(&sanitize_url(href)),
                    render_inline(&block.content)
                )
            };
            format!(
                "<div class=\"it-ref-card ref\">{}<span class=\"it-ref-rel\">{}</span></div>\n",
                link,
                esc(rel)
            )
        }
        "def" => {
            let meaning = props
                .and_then(|p| p.get("meaning"))
                .map(String::as_str)
                .unwrap_or("");
            format!(
                "<div class=\"it-def def\"><strong>{}</strong><span class=\"it-def-meaning\">{}</span></div>\n",
                render_inline(&block.content),
                render_inline(meaning)
            )
        }
        "figure" => {
            let src = props
                .and_then(|p| p.get("src"))
                .map(String::as_str)
                .unwrap_or("");
            let caption = props
                .and_then(|p| p.get("caption"))
                .map(String::as_str)
                .unwrap_or("");
            format!(
                "<figure class=\"it-figure\"><img src=\"{}\" alt=\"{}\"><figcaption>{}</figcaption></figure>\n",
                esc(&sanitize_url(src)),
                esc(&block.content),
                render_inline(if caption.is_empty() { &block.content } else { caption })
            )
        }
        "signline" => {
            let name = props
                .and_then(|p| p.get("name"))
                .map(String::as_str)
                .unwrap_or("");
            let role = props
                .and_then(|p| p.get("role"))
                .map(String::as_str)
                .unwrap_or("");
            let show_date = props
                .and_then(|p| p.get("date-line"))
                .map(|v| v == "true")
                .unwrap_or(false);
            let date_html = if show_date {
                "<div class=\"it-signline-date\">Date</div>"
            } else {
                ""
            };
            format!(
                "<div class=\"it-signline\"><div>{}</div><div>{}</div><div>{}</div>{}</div>\n",
                render_inline(&block.content),
                esc(name),
                esc(role),
                date_html
            )
        }
        "contact" => {
            let email = props
                .and_then(|p| p.get("email"))
                .map(String::as_str)
                .unwrap_or("");
            let phone = props
                .and_then(|p| p.get("phone"))
                .map(String::as_str)
                .unwrap_or("");
            let mut reach = String::new();
            if !email.is_empty() {
                reach.push_str(&format!(
                    "<a href=\"mailto:{}\">{}</a>",
                    esc(email),
                    esc(email)
                ));
            }
            if !phone.is_empty() {
                if !reach.is_empty() {
                    reach.push(' ');
                }
                reach.push_str(&format!(
                    "<a href=\"tel:{}\">{}</a>",
                    esc(phone),
                    esc(phone)
                ));
            }
            format!(
                "<div class=\"it-contact contact\"><strong>{}</strong> {}</div>\n",
                render_inline(&block.content),
                reach
            )
        }
        "deadline" => {
            let date = props
                .and_then(|p| p.get("date"))
                .map(String::as_str)
                .unwrap_or("");
            let consequence = props
                .and_then(|p| p.get("consequence"))
                .map(String::as_str)
                .unwrap_or("");
            format!(
                "<div class=\"it-deadline deadline\"><strong>{}</strong> <span>{}</span> <span>{}</span></div>\n",
                render_inline(&block.content),
                esc(date),
                esc(consequence)
            )
        }
        "list-item" => {
            let meta = render_list_meta(block);
            format!(
                "<li class=\"intent-list-item\">{}{}</li>\n",
                content_html, meta
            )
        }
        "step-item" => format!("<li class=\"intent-step-item\">{}</li>\n", content_html),
        "toc" => String::new(),
        "track" => {
            let html = render_inline(&block.content);
            format!("<div class=\"it-track\">{html}</div>\n")
        }
        "approve" => {
            let html = render_inline(&block.content);
            format!("<div class=\"it-approve\">{html}</div>\n")
        }
        "sign" => {
            let html = render_inline(&block.content);
            format!("<div class=\"it-sign\">{html}</div>\n")
        }
        "freeze" => {
            let html = render_inline(&block.content);
            format!("<div class=\"it-freeze\">{html}</div>\n")
        }
        "amendment" => {
            let was = props
                .and_then(|p| p.get("was"))
                .map(String::as_str)
                .unwrap_or("");
            let now = props
                .and_then(|p| p.get("now"))
                .map(String::as_str)
                .unwrap_or("");
            let html = render_inline(&block.content);
            format!(
                "<div class=\"it-amendment amendment\">{} <span class=\"it-amendment-was\">{}</span> <span class=\"it-amendment-now\">{}</span></div>\n",
                html,
                esc(was),
                esc(now)
            )
        }
        "page" => "<div class=\"it-page\"></div>\n".to_string(),
        "break" => {
            "<div class=\"it-page-break\" aria-hidden=\"true\" style=\"display:none\"></div>\n"
                .to_string()
        }
        "header" => {
            let html = render_inline(&block.content);
            format!("<header class=\"it-header\">{html}</header>\n")
        }
        "footer" => {
            let html = render_inline(&block.content);
            format!("<footer class=\"it-footer\">{html}</footer>\n")
        }
        "watermark" => {
            if !opts.print_mode {
                return String::new();
            }
            let html = render_inline(&block.content);
            format!("<div class=\"it-watermark\" aria-hidden=\"true\">{html}</div>\n")
        }
        "meta" => {
            // meta: blocks are never rendered in HTML output
            String::new()
        }
        "context" => String::new(), // always hidden
        _ => {
            // Extension blocks or unknown — render as a data div with class from block_type
            let safe_type = block.block_type.replace([':', ' '], "-");
            let html = render_inline(&block.content);
            let data_attrs = render_data_attrs(block);
            format!("<div class=\"it-ext it-{safe_type}\"{data_attrs}>{html}</div>\n")
        }
    }
}

fn render_style_attr(props: Option<&std::collections::HashMap<String, String>>) -> String {
    let Some(props) = props else {
        return String::new();
    };

    let mut styles: Vec<String> = Vec::new();
    for (prop, css_key) in [
        ("color", "color"),
        ("size", "font-size"),
        ("family", "font-family"),
        ("weight", "font-weight"),
        ("align", "text-align"),
        ("bg", "background-color"),
        ("indent", "padding-left"),
        ("opacity", "opacity"),
    ] {
        if let Some(value) = props.get(prop) {
            if !value.trim().is_empty() {
                styles.push(format!("{css_key}: {}", esc(value)));
            }
        }
    }

    if props.get("italic").map(String::as_str) == Some("true") {
        styles.push("font-style: italic".to_string());
    }
    if props.get("border").map(String::as_str) == Some("true") {
        styles.push("border: 1px solid currentColor".to_string());
    }

    if styles.is_empty() {
        String::new()
    } else {
        format!(" style=\"{}\"", styles.join("; "))
    }
}

fn render_callout(block: &IntentBlock) -> String {
    let callout_type = block
        .properties
        .as_ref()
        .and_then(|p| p.get("type"))
        .map(String::as_str)
        .unwrap_or("info");

    let css_class = match callout_type {
        "warning" => "callout-warning",
        "danger" => "callout-danger",
        "tip" => "callout-tip",
        "success" => "callout-success",
        _ => "callout-info",
    };

    let label = block
        .properties
        .as_ref()
        .and_then(|p| p.get("label"))
        .map(String::as_str)
        .unwrap_or("");

    let html = render_inline(&block.content);
    if label.is_empty() {
        format!("<div class=\"it-info {css_class}\">{html}</div>\n")
    } else {
        let label_html = esc(label);
        format!(
            "<div class=\"it-info {css_class}\"><p class=\"callout-label\">{label_html}</p>{html}</div>\n"
        )
    }
}

fn render_task(block: &IntentBlock, done: bool) -> String {
    let checked = if done { " checked" } else { "" };
    let html = render_inline_nodes(&block.content, block.inline.as_deref());
    let props = block.properties.as_ref();
    let owner = props
        .and_then(|p| p.get("owner"))
        .map(|v| format!("<span class=\"intent-task-owner\">{}</span>", esc(v)))
        .unwrap_or_default();
    let due = props
        .and_then(|p| p.get("due"))
        .map(|v| format!("<span class=\"intent-task-due\">{}</span>", esc(v)))
        .unwrap_or_default();
    let time = props
        .and_then(|p| p.get("time"))
        .map(|v| format!("<span class=\"intent-task-time\">{}</span>", esc(v)))
        .unwrap_or_default();
    let done_class = if done { " intent-task-done" } else { "" };
    let text_done = if done { " intent-task-text-done" } else { "" };
    format!(
        "<div class=\"intent-task{done_class}\"><input class=\"intent-task-checkbox\" type=\"checkbox\"{checked} /><span class=\"intent-task-text{text_done}\">{html}</span><span class=\"intent-task-meta\">{owner}{due}{time}</span></div>\n"
    )
}

fn render_metric(block: &IntentBlock) -> String {
    let props = block.properties.as_ref();
    let value = props
        .and_then(|p| p.get("value"))
        .map(String::as_str)
        .unwrap_or(&block.content);
    let unit = props
        .and_then(|p| p.get("unit"))
        .map(String::as_str)
        .unwrap_or("");
    let label = if block.content.is_empty() {
        ""
    } else {
        &block.content
    };
    let value_esc = esc(value);
    let unit_esc = esc(unit);
    let trend = props
        .and_then(|p| p.get("trend"))
        .map(String::as_str)
        .unwrap_or("");
    let trend_symbol = match trend {
        "up" => "↑",
        "down" => "↓",
        "stable" => "→",
        _ => "",
    };

    let mut state_class = "";
    if let Some(target) = props.and_then(|p| p.get("target")) {
        if let (Ok(v), Ok(t)) = (value.parse::<f64>(), target.parse::<f64>()) {
            state_class = if v < t {
                " it-metric-red"
            } else {
                " it-metric-met"
            };
        }
    }
    let label_html = if label.is_empty() {
        String::new()
    } else {
        format!(
            "<span class=\"it-metric__label\">{}</span>",
            render_inline(label)
        )
    };
    format!(
        "<div class=\"it-metric{state_class}\">{label_html}<span class=\"it-metric__value\">{value_esc}</span><span class=\"it-metric__unit\">{unit_esc}</span><span class=\"it-metric__trend\">{}</span></div>\n",
        esc(trend_symbol)
    )
}

fn render_table(block: &IntentBlock) -> String {
    if let Some(table) = &block.table {
        let headers = table.headers.as_deref().unwrap_or(&[]);
        if headers.is_empty() && table.rows.is_empty() {
            return String::new();
        }
        let mut html = String::from("<table class=\"it-table\">\n");
        if !headers.is_empty() {
            html.push_str("<thead><tr>");
            for h in headers {
                let cell = render_inline(h);
                html.push_str(&format!("<th>{cell}</th>"));
            }
            html.push_str("</tr></thead>\n");
        }
        if !table.rows.is_empty() {
            html.push_str("<tbody>\n");
            for row in &table.rows {
                html.push_str("<tr>");
                for cell in row {
                    let cell_html = render_inline(cell);
                    html.push_str(&format!("<td>{cell_html}</td>"));
                }
                html.push_str("</tr>\n");
            }
            html.push_str("</tbody>\n");
        }
        html.push_str("</table>\n");
        return html;
    }

    // columns block without structured table data
    let html = render_inline(&block.content);
    format!("<div class=\"it-columns\">{html}</div>\n")
}

fn render_tag(tag: &str, class: &str, content: &str, inline: bool) -> String {
    let inner = if inline {
        render_inline(content)
    } else {
        esc(content)
    };
    format!("<{tag} class=\"{class}\">{inner}</{tag}>\n")
}

fn render_tag_data(block: &IntentBlock, tag: &str, class: &str) -> String {
    let html = render_inline(&block.content);
    let data = render_data_attrs(block);
    format!("<{tag} class=\"{class}\"{data}>{html}</{tag}>\n")
}

fn render_data_attrs(block: &IntentBlock) -> String {
    let mut out = String::new();
    if let Some(props) = &block.properties {
        for (k, v) in props {
            if k == "id" {
                continue;
            } // id is a real HTML attr, not data-
            let key = k.replace('_', "-");
            let val = esc(v);
            out.push_str(&format!(" data-{key}=\"{val}\""));
        }
    }
    out
}

/// Render inline nodes to HTML — renders each node to its HTML representation.
pub fn render_inline(content: &str) -> String {
    if content.is_empty() {
        return String::new();
    }
    let nodes = parse_inline(content);
    nodes.iter().map(node_to_html).collect()
}

fn render_inline_nodes(content: &str, inline: Option<&[InlineNode]>) -> String {
    if let Some(nodes) = inline {
        if !nodes.is_empty() {
            return nodes.iter().map(node_to_html).collect();
        }
    }
    render_inline(content)
}

fn node_to_html(node: &InlineNode) -> String {
    match node {
        InlineNode::Text { value } => esc(value),
        InlineNode::Bold { value } => format!("<strong>{}</strong>", esc(value)),
        InlineNode::Italic { value } => format!("<em>{}</em>", esc(value)),
        InlineNode::Strike { value } => format!("<del>{}</del>", esc(value)),
        InlineNode::Code { value } => format!("<span class=\"it-label\">{}</span>", esc(value)),
        InlineNode::Highlight { value } => format!("<mark>{}</mark>", esc(value)),
        InlineNode::InlineNote { value } => {
            format!("<span class=\"intent-inline-note\">{}</span>", esc(value))
        }
        InlineNode::InlineQuote { value } => {
            format!("<q class=\"intent-inline-quote\">{}</q>", esc(value))
        }
        InlineNode::Link { value, href } => {
            let safe_href = sanitize_url(href);
            let href_esc = esc(&safe_href);
            let text_esc = esc(value);
            format!("<a href=\"{href_esc}\" class=\"intent-inline-link\">{text_esc}</a>")
        }
        InlineNode::Mention { value } => {
            format!(
                "<span class=\"intent-inline-mention\">@{}</span>",
                esc(value)
            )
        }
        InlineNode::Tag { value } => {
            format!("<span class=\"intent-inline-tag\">#{}</span>", esc(value))
        }
        InlineNode::Date { value, iso } => {
            format!(
                "<time class=\"intent-inline-date\" datetime=\"{}\">{}</time>",
                esc(iso),
                esc(value)
            )
        }
        InlineNode::Label { value } => {
            format!("<span class=\"it-label\">{}</span>", esc(value))
        }
        InlineNode::FootnoteRef { value } => {
            let id_esc = esc(value);
            format!("<sup class=\"it-fn-ref\"><a href=\"#fn-{id_esc}\">{id_esc}</a></sup>")
        }
    }
}

fn render_align_class(props: Option<&std::collections::HashMap<String, String>>) -> &'static str {
    let Some(props) = props else {
        return "";
    };
    match props.get("align").map(|v| v.trim().to_ascii_lowercase()) {
        Some(v) if v == "center" => " intent-align-center",
        Some(v) if v == "right" => " intent-align-right",
        Some(v) if v == "justify" => " intent-align-justify",
        _ => "",
    }
}

fn slugify(s: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in s.chars() {
        let c = ch.to_ascii_lowercase();
        if c.is_ascii_alphanumeric() {
            out.push(c);
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

fn collect_sections(blocks: &[IntentBlock], out: &mut Vec<(usize, String, String)>) {
    for block in blocks {
        if block.block_type == "section" {
            out.push((1, block.content.clone(), slugify(&block.content)));
        }
        if block.block_type == "sub" {
            out.push((2, block.content.clone(), slugify(&block.content)));
        }
        if let Some(children) = &block.children {
            collect_sections(children, out);
        }
    }
}

fn render_toc(block: &IntentBlock, doc: &IntentDocument) -> String {
    let depth = block
        .properties
        .as_ref()
        .and_then(|p| p.get("depth"))
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(2);
    let title = block
        .properties
        .as_ref()
        .and_then(|p| p.get("title"))
        .map(String::as_str)
        .unwrap_or("Contents");
    let mut entries = Vec::new();
    collect_sections(&doc.blocks, &mut entries);
    let mut html = format!(
        "<nav class=\"it-toc\"><h2 class=\"it-toc-title\">{}</h2><ol>",
        esc(title)
    );
    for (level, label, slug) in entries {
        if level > depth {
            continue;
        }
        let class_attr = if level == 2 {
            " class=\"it-toc-sub\""
        } else {
            ""
        };
        html.push_str(&format!(
            "<li{class_attr}><a href=\"#{}\">{}</a></li>",
            esc(&slug),
            esc(&label)
        ));
    }
    html.push_str("</ol></nav>");
    html
}

fn collect_footnotes(blocks: &[IntentBlock], out: &mut Vec<IntentBlock>) {
    for block in blocks {
        if block.block_type == "footnote" {
            out.push(block.clone());
        }
        if let Some(children) = &block.children {
            collect_footnotes(children, out);
        }
    }
}

fn render_footnotes(doc: &IntentDocument) -> String {
    let mut notes = Vec::new();
    collect_footnotes(&doc.blocks, &mut notes);
    if notes.is_empty() {
        return String::new();
    }
    let mut out = String::from("<div class=\"it-footnotes\"><ol>");
    for fnote in notes {
        let num = esc(&fnote.content);
        let text = fnote
            .properties
            .as_ref()
            .and_then(|p| p.get("text"))
            .cloned()
            .unwrap_or_else(|| fnote.content.clone());
        out.push_str(&format!(
            "<li id=\"fn-{num}\" value=\"{num}\">{}</li>",
            esc(&text)
        ));
    }
    out.push_str("</ol></div>");
    out
}

fn render_list_meta(block: &IntentBlock) -> String {
    let Some(props) = block.properties.as_ref() else {
        return String::new();
    };
    let owner = props
        .get("owner")
        .map(|v| format!("<span class=\"intent-task-owner\">{}</span>", esc(v)))
        .unwrap_or_default();
    let due = props
        .get("due")
        .map(|v| format!("<span class=\"intent-task-due\">{}</span>", esc(v)))
        .unwrap_or_default();
    if owner.is_empty() && due.is_empty() {
        String::new()
    } else {
        format!(" <span class=\"intent-task-meta\">{owner}{due}</span>")
    }
}

/// Sanitize a URL — blocks dangerous schemes (javascript:, vbscript:, data:).
/// Returns `"#"` for any blocked URL; passes safe URLs through unchanged.
fn sanitize_url(url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    // Allow relative paths and fragments
    if trimmed.starts_with('/')
        || trimmed.starts_with("./")
        || trimmed.starts_with("../")
        || trimmed.starts_with('#')
    {
        return trimmed.to_string();
    }
    let lower = trimmed.to_lowercase();
    // Block dangerous schemes
    if lower.starts_with("javascript:")
        || lower.starts_with("vbscript:")
        || lower.starts_with("data:")
    {
        return "#".to_string();
    }
    // Allow bare relative paths (no scheme)
    if !lower.contains(':') && !lower.starts_with("//") {
        return trimmed.to_string();
    }
    // Allow safe explicit schemes
    if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
    {
        return trimmed.to_string();
    }
    "#".to_string()
}

/// Escape HTML special chars.
fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse;

    #[test]
    fn renders_title() {
        let doc = parse("title: Hello World", None);
        let html = render(&doc, None);
        assert!(html.contains("<h1 class=\"it-title\">Hello World</h1>"));
    }

    #[test]
    fn renders_section() {
        let doc = parse("section: Overview", None);
        let html = render(&doc, None);
        assert!(html.contains("<h2 class=\"it-section\">Overview</h2>"));
    }

    #[test]
    fn callout_info_type_warning() {
        let doc = parse("warning: This is a warning", None);
        let html = render(&doc, None);
        assert!(html.contains("callout-warning"));
    }

    #[test]
    fn callout_info_no_type() {
        let doc = parse("info: Note this", None);
        let html = render(&doc, None);
        assert!(html.contains("callout-info"));
    }

    #[test]
    fn callout_danger() {
        let doc = parse("danger: Critical issue", None);
        let html = render(&doc, None);
        assert!(html.contains("callout-danger"));
    }

    #[test]
    fn renders_bold_inline() {
        let doc = parse("text: Hello **world**", None);
        let html = render(&doc, None);
        assert!(html.contains("<strong>world</strong>"));
    }

    #[test]
    fn renders_task() {
        let doc = parse("task: Buy milk", None);
        let html = render(&doc, None);
        assert!(html.contains("it-task"));
        assert!(html.contains("Buy milk"));
    }

    #[test]
    fn renders_done_task() {
        let doc = parse("done: Write tests", None);
        let html = render(&doc, None);
        assert!(html.contains("it-task--done"));
        assert!(html.contains("checked"));
    }

    #[test]
    fn renders_code_block() {
        let doc = parse("code: print('hello') | lang: python", None);
        let html = render(&doc, None);
        assert!(html.contains("language-python"));
    }

    #[test]
    fn print_mode_class() {
        let doc = parse("text: hi", None);
        let html = render(
            &doc,
            Some(RenderOptions {
                print_mode: true,
                ..Default::default()
            }),
        );
        assert!(html.contains("intenttext--print"));
    }

    #[test]
    fn html_escaping() {
        let doc = parse("text: <script>alert('xss')</script>", None);
        let html = render(&doc, None);
        assert!(!html.contains("<script>"));
        assert!(html.contains("&lt;script&gt;"));
    }

    // ── URL sanitization ──────────────────────────────────────────────────────

    #[test]
    fn sanitize_url_blocks_javascript() {
        let doc = parse("link: Click me | to: javascript:alert(1)", None);
        let html = render(&doc, None);
        assert!(!html.contains("javascript:"));
        assert!(html.contains("href=\"#\""));
    }

    #[test]
    fn sanitize_url_blocks_data_uri() {
        let doc = parse(
            "link: Click me | to: data:text/html,<script>alert(1)</script>",
            None,
        );
        let html = render(&doc, None);
        assert!(!html.contains("data:"));
        assert!(html.contains("href=\"#\""));
    }

    #[test]
    fn sanitize_url_blocks_vbscript() {
        let doc = parse("link: Click me | to: vbscript:MsgBox(1)", None);
        let html = render(&doc, None);
        assert!(!html.contains("vbscript:"));
    }

    #[test]
    fn sanitize_url_allows_https() {
        let doc = parse("link: Docs | to: https://example.com", None);
        let html = render(&doc, None);
        assert!(html.contains("https://example.com"));
    }

    #[test]
    fn sanitize_url_allows_relative() {
        let doc = parse("link: Page | to: ./about.html", None);
        let html = render(&doc, None);
        assert!(html.contains("./about.html"));
    }

    #[test]
    fn link_block_uses_to_property() {
        let doc = parse("link: Visit | to: https://rust-lang.org", None);
        let html = render(&doc, None);
        assert!(html.contains("href=\"https://rust-lang.org\""));
        assert!(html.contains("Visit"));
    }

    #[test]
    fn collect_print_layout_extracts_latest_header_footer() {
        let src = "page: A4\nheader: H1\nheader: H2\nfooter: F1\nwatermark: DRAFT\nbreak: section | before: section";
        let doc = parse(src, None);
        let layout = collect_print_layout(&doc);
        assert!(layout.page.is_some());
        assert_eq!(
            layout.header.as_ref().map(|b| b.content.clone()),
            Some("H2".to_string())
        );
        assert!(layout.footer.is_some());
        assert!(layout.watermark.is_some());
        assert_eq!(layout.breaks.len(), 1);
    }

    #[test]
    fn render_print_outputs_full_html() {
        let doc = parse("title: A\ntext: B", None);
        let html = render_print(&doc, None);
        assert!(html.starts_with("<!DOCTYPE html>"));
        assert!(html.contains("<body class=\"it-print\">"));
        assert!(html.contains("it-title"));
    }
}
