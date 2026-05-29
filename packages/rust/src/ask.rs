//! Natural-language query helpers (v2.10 parity surface).

use crate::index_builder::ComposedResult;

#[derive(Debug, Clone, Default)]
pub struct AskOptions {
    pub max_tokens: Option<usize>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct AskCorePayload {
    pub question: String,
    pub context: String,
    pub max_tokens: Option<usize>,
    pub format: Option<String>,
}

/// Host-provided ask transport boundary.
///
/// Core remains network-free; callers may provide an implementation that
/// forwards prompt/context to an external LLM provider.
#[cfg(feature = "ai_transport")]
pub trait AskTransport {
    fn ask(
        &self,
        question: &str,
        context: &str,
        options: Option<&AskOptions>,
    ) -> Result<String, String>;
}

/// Serialize composed results into compact prompt context.
pub fn serialize_context(results: &[ComposedResult]) -> String {
    let mut lines = Vec::new();
    let mut current_file = String::new();
    for r in results {
        if r.file != current_file {
            current_file = r.file.clone();
            lines.push(format!("\n--- {} ---", r.file));
        }
        let mut props: Vec<String> = r
            .block
            .properties
            .iter()
            .map(|(k, v)| format!("{k}: {v}"))
            .collect();
        props.sort();
        let props = props.join(" | ");
        let section = r
            .block
            .section
            .as_ref()
            .map(|s| format!(" [{s}]"))
            .unwrap_or_default();
        lines.push(format!(
            "[{}]{} {}{}",
            r.block.block_type,
            section,
            r.block.content,
            if props.is_empty() {
                String::new()
            } else {
                format!(" | {props}")
            }
        ));
    }
    lines.join("\n")
}

/// Build deterministic ask payload from indexed results.
pub fn ask_core(
    results: &[ComposedResult],
    question: &str,
    options: Option<AskOptions>,
) -> AskCorePayload {
    let opts = options.unwrap_or_default();
    AskCorePayload {
        question: question.to_string(),
        context: serialize_context(results),
        max_tokens: opts.max_tokens,
        format: opts.format,
    }
}

/// Ask a natural-language question about composed .it data.
///
/// Current implementation intentionally avoids network calls in-core and returns a
/// deterministic fallback response with actionable guidance.
pub fn ask_documents(
    results: &[ComposedResult],
    question: &str,
    options: Option<AskOptions>,
) -> String {
    let payload = ask_core(results, question, options);
    let count = results.len();
    format!(
        "LLM transport is not enabled in this crate build. Parsed {} block result(s). Question: {}\n\nContext preview:\n{}",
        count,
        payload.question,
        payload.context.lines().take(12).collect::<Vec<&str>>().join("\n")
    )
}

/// Ask using an explicit host transport.
#[cfg(feature = "ai_transport")]
pub fn ask_documents_with_transport<T: AskTransport>(
    results: &[ComposedResult],
    question: &str,
    options: Option<AskOptions>,
    transport: &T,
) -> Result<String, String> {
    let payload = ask_core(results, question, options);
    transport.ask(
        &payload.question,
        &payload.context,
        Some(&AskOptions {
            max_tokens: payload.max_tokens,
            format: payload.format,
        }),
    )
}
