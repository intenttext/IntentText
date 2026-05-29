//! HTML -> IntentText converter.
//!
//! Security posture:
//! - strips script/style/meta/link/head/noscript blocks
//! - drops javascript:/data: URLs
//! - enforces a maximum input size

use regex::Regex;

const MAX_HTML_INPUT: usize = 2_000_000;

/// Convert HTML input into IntentText source.
pub fn convert_html_to_intenttext(html: &str) -> String {
    if html.is_empty() {
        return String::new();
    }
    let mut input = if html.len() > MAX_HTML_INPUT {
        &html[..MAX_HTML_INPUT]
    } else {
        html
    }
    .to_string();

    input = strip_dangerous_tags(&input);

    let mut out: Vec<String> = Vec::new();
    extract_tagged(&input, "h1", |s| out.push(format!("title: {}", clean_inline(s))));
    extract_tagged(&input, "h2", |s| {
        out.push(format!("section: {}", clean_inline(s)));
        out.push(String::new());
    });
    extract_tagged(&input, "h3", |s| out.push(format!("sub: {}", clean_inline(s))));
    extract_tagged(&input, "h4", |s| out.push(format!("sub: {}", clean_inline(s))));
    extract_tagged(&input, "h5", |s| out.push(format!("sub: {}", clean_inline(s))));
    extract_tagged(&input, "h6", |s| out.push(format!("sub: {}", clean_inline(s))));

    let p_re = Regex::new(r"(?is)<p\b[^>]*>(.*?)</p>").expect("valid paragraph regex");
    for cap in p_re.captures_iter(&input) {
        let raw = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
        if let Some((label, href)) = extract_single_anchor(raw) {
            if is_safe_href(&href) {
                out.push(format!("link: {} | to: {}", clean_inline(&label), href));
            } else {
                out.push(format!("note: {}", clean_inline(&label)));
            }
        } else {
            let line = clean_inline(raw);
            if !line.is_empty() {
                out.push(format!("note: {line}"));
            }
        }
        out.push(String::new());
    }

    let li_re = Regex::new(r"(?is)<li\b[^>]*>(.*?)</li>").expect("valid list regex");
    for cap in li_re.captures_iter(&input) {
        let text = clean_inline(cap.get(1).map(|m| m.as_str()).unwrap_or_default());
        if !text.is_empty() {
            out.push(format!("- {text}"));
        }
    }

    let code_re = Regex::new(r"(?is)<pre\b[^>]*>(.*?)</pre>").expect("valid code regex");
    for cap in code_re.captures_iter(&input) {
        let mut code = strip_tags(cap.get(1).map(|m| m.as_str()).unwrap_or_default());
        code = html_entity_decode(&code);
        let code = code.trim_matches('\n');
        if !code.is_empty() {
            out.push("code:".to_string());
            out.extend(code.lines().map(|l| l.to_string()));
            out.push("end:".to_string());
            out.push(String::new());
        }
    }

    let img_re = Regex::new(r#"(?is)<img\b[^>]*>"#).expect("valid image regex");
    for m in img_re.find_iter(&input) {
        let tag = m.as_str();
        let src = get_attr(tag, "src").unwrap_or_default();
        if src.is_empty() || !is_safe_href(&src) {
            continue;
        }
        let alt = get_attr(tag, "alt").unwrap_or_else(|| "image".to_string());
        let title = get_attr(tag, "title");
        let mut line = format!("image: {} | src: {}", clean_inline(&alt), src);
        if let Some(caption) = title {
            if !caption.trim().is_empty() {
                line.push_str(&format!(" | caption: {}", clean_inline(&caption)));
            }
        }
        out.push(line);
    }

    while matches!(out.last(), Some(last) if last.is_empty()) {
        out.pop();
    }
    out.join("\n")
}

fn extract_tagged<F: FnMut(&str)>(input: &str, tag: &str, mut f: F) {
    let re = Regex::new(&format!(r"(?is)<{tag}\b[^>]*>(.*?)</{tag}>"))
        .expect("valid tagged regex");
    for cap in re.captures_iter(input) {
        let inner = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
        let cleaned = clean_inline(inner);
        if !cleaned.is_empty() {
            f(&cleaned);
        }
    }
}

fn strip_dangerous_tags(input: &str) -> String {
    let mut s = input.to_string();
    for tag in ["script", "style", "head", "meta", "link", "noscript"] {
        let re = Regex::new(&format!(r"(?is)<{tag}\b[^>]*>.*?</{tag}>"))
            .expect("valid strip regex");
        s = re.replace_all(&s, "").into_owned();
        let self_re = Regex::new(&format!(r"(?is)<{tag}\b[^>]*/>"))
            .expect("valid self-closing strip regex");
        s = self_re.replace_all(&s, "").into_owned();
    }
    s
}

fn extract_single_anchor(input: &str) -> Option<(String, String)> {
    let re = Regex::new(r#"(?is)^\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>\s*$"#)
        .expect("valid anchor regex");
    let caps = re.captures(input)?;
    let href = caps.get(1).map(|m| m.as_str().trim().to_string())?;
    let label = caps.get(2).map(|m| m.as_str().to_string())?;
    Some((strip_tags(&label), href))
}

fn is_safe_href(href: &str) -> bool {
    let lower = href.trim().to_ascii_lowercase();
    !(lower.starts_with("javascript:") || lower.starts_with("data:"))
}

fn get_attr(tag: &str, name: &str) -> Option<String> {
    let re = Regex::new(&format!(r#"(?is)\b{name}\s*=\s*["']([^"']*)["']"#))
        .expect("valid attr regex");
    re.captures(tag)
        .and_then(|c| c.get(1).map(|m| m.as_str().to_string()))
}

fn clean_inline(input: &str) -> String {
    let mut s = input.to_string();
    s = s.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n");
    s = strip_tags(&s);
    s = html_entity_decode(&s);
    s.split_whitespace().collect::<Vec<&str>>().join(" ")
}

fn strip_tags(input: &str) -> String {
    let re = Regex::new(r"(?is)<[^>]+>").expect("valid strip tags regex");
    re.replace_all(input, "").into_owned()
}

fn html_entity_decode(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}
