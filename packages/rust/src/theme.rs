//! Theme system parity surface.

use std::collections::HashMap;
use std::sync::RwLock;

use once_cell::sync::Lazy;

#[derive(Debug, Clone, Default)]
pub struct ThemeFonts {
    pub body: String,
    pub heading: String,
    pub mono: String,
    pub size: String,
    pub leading: String,
}

#[derive(Debug, Clone, Default)]
pub struct ThemeSpacing {
    pub page_margin: String,
    pub section_gap: String,
    pub block_gap: String,
    pub indent: String,
}

#[derive(Debug, Clone, Default)]
pub struct IntentTheme {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub fonts: ThemeFonts,
    pub colors: HashMap<String, String>,
    pub spacing: ThemeSpacing,
    pub blocks: HashMap<String, HashMap<String, String>>,
}

static BUILTIN_THEMES: Lazy<RwLock<HashMap<String, IntentTheme>>> = Lazy::new(|| {
    let mut themes = HashMap::new();
    themes.insert("minimal".to_string(), minimal_theme());
    themes.insert("corporate".to_string(), corporate_theme());
    themes.insert("dark".to_string(), dark_theme());
    RwLock::new(themes)
});

pub fn register_builtin_theme(theme: IntentTheme) {
    if let Ok(mut map) = BUILTIN_THEMES.write() {
        map.insert(theme.name.clone(), theme);
    }
}

pub fn get_builtin_theme(name: &str) -> Option<IntentTheme> {
    BUILTIN_THEMES.read().ok()?.get(name).cloned()
}

pub fn list_builtin_themes() -> Vec<String> {
    let mut names: Vec<String> = BUILTIN_THEMES
        .read()
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default();
    names.sort();
    names
}

pub fn generate_theme_css(theme: &IntentTheme, mode: Option<&str>) -> String {
    let mode = mode.unwrap_or("web");
    let mut css = String::from(":root{");
    css.push_str(&format!("--it-font-body:{};", theme.fonts.body));
    css.push_str(&format!("--it-font-heading:{};", theme.fonts.heading));
    css.push_str(&format!("--it-font-mono:{};", theme.fonts.mono));
    css.push_str(&format!("--it-font-size:{};", theme.fonts.size));
    css.push_str(&format!("--it-leading:{};", theme.fonts.leading));
    for (k, v) in &theme.colors {
        css.push_str(&format!("--it-color-{k}:{v};"));
    }
    css.push_str("}\n");

    css.push_str(".intent-document{font-family:var(--it-font-body);font-size:var(--it-font-size);line-height:var(--it-leading);color:var(--it-color-text);background:var(--it-color-background);}\n");
    css.push_str(".intent-title,.intent-section,.intent-sub{font-family:var(--it-font-heading);color:var(--it-color-heading);}\n");
    css.push_str("code,.intent-code{font-family:var(--it-font-mono);background:var(--it-color-code-bg);}\n");

    for (block, styles) in &theme.blocks {
        css.push_str(&format!(".intent-{block}{{"));
        for (prop, val) in styles {
            css.push_str(&format!("{prop}:{val};"));
        }
        css.push_str("}\n");
    }

    if mode == "print" {
        css.push_str("@media print{.intent-document{margin:0;}}\n");
    }
    css
}

fn base_theme(name: &str, body: &str, heading: &str, bg: &str, text: &str) -> IntentTheme {
    let mut colors = HashMap::new();
    colors.insert("text".to_string(), text.to_string());
    colors.insert("heading".to_string(), heading.to_string());
    colors.insert("muted".to_string(), "#6b7280".to_string());
    colors.insert("accent".to_string(), "#2563eb".to_string());
    colors.insert("border".to_string(), "#d1d5db".to_string());
    colors.insert("background".to_string(), bg.to_string());
    colors.insert("code-bg".to_string(), "#f3f4f6".to_string());

    IntentTheme {
        name: name.to_string(),
        version: "1.0".to_string(),
        description: None,
        author: Some("intenttext-rust".to_string()),
        fonts: ThemeFonts {
            body: body.to_string(),
            heading: heading.to_string(),
            mono: "ui-monospace, SFMono-Regular, Menlo, monospace".to_string(),
            size: "16px".to_string(),
            leading: "1.6".to_string(),
        },
        colors,
        spacing: ThemeSpacing {
            page_margin: "24px".to_string(),
            section_gap: "28px".to_string(),
            block_gap: "14px".to_string(),
            indent: "20px".to_string(),
        },
        blocks: HashMap::new(),
    }
}

fn minimal_theme() -> IntentTheme {
    base_theme("minimal", "system-ui, sans-serif", "system-ui, sans-serif", "#ffffff", "#111827")
}

fn corporate_theme() -> IntentTheme {
    base_theme("corporate", "Inter, system-ui, sans-serif", "Inter, system-ui, sans-serif", "#ffffff", "#1f2937")
}

fn dark_theme() -> IntentTheme {
    let mut t = base_theme("dark", "system-ui, sans-serif", "system-ui, sans-serif", "#0f172a", "#e5e7eb");
    t.colors.insert("code-bg".to_string(), "#111827".to_string());
    t
}
