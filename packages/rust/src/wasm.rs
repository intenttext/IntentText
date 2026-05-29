//! WebAssembly bindings for IntentText core APIs.
//!
//! These wrappers keep JS-facing inputs/outputs as plain JS objects/arrays/strings
//! while delegating all behavior to the Rust core implementation.

use wasm_bindgen::prelude::*;

use crate::types::{Diagnostic, DiagnosticSeverity, IntentDocument};

#[derive(serde::Serialize)]
struct JsDiagnostic {
    severity: &'static str,
    code: &'static str,
    message: String,
    line: usize,
    column: usize,
}

fn severity_str(severity: &DiagnosticSeverity) -> &'static str {
    match severity {
        DiagnosticSeverity::Error => "error",
        DiagnosticSeverity::Warning => "warning",
        DiagnosticSeverity::Info => "info",
    }
}

fn js_err(message: &str) -> JsValue {
    JsValue::from_str(message)
}

fn to_js_value<T: serde::Serialize>(value: &T) -> Result<JsValue, JsValue> {
    // Keep JS interop predictable for the TS layer:
    // serialize Rust maps as plain JS objects rather than Map instances.
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    value
        .serialize(&serializer)
        .map_err(|e| js_err(&format!("serialize to JS value failed: {e}")))
}

/// Parse `.it` source into an IntentDocument JS object.
#[wasm_bindgen]
pub fn parse_wasm(source: &str) -> Result<JsValue, JsValue> {
    let doc = crate::parse(source, None);
    let mut value = serde_json::to_value(&doc)
        .map_err(|e| js_err(&format!("serialize parsed document failed: {e}")))?;

    if let Some(diags) = &doc.diagnostics {
        let mapped: Vec<serde_json::Value> = diags
            .iter()
            .map(|d| {
                serde_json::json!({
                    "severity": severity_str(&d.severity),
                    "code": d.code.as_str(),
                    "message": d.message,
                    "line": d.line,
                    "column": d.column,
                })
            })
            .collect();
        if let Some(obj) = value.as_object_mut() {
            obj.insert("diagnostics".to_string(), serde_json::Value::Array(mapped));
        }
    }

    to_js_value(&value)
}

/// Convert an IntentDocument JS object back to `.it` source.
#[wasm_bindgen]
pub fn to_source_wasm(document: JsValue) -> Result<String, JsValue> {
    let doc: IntentDocument = serde_wasm_bindgen::from_value(document)
        .map_err(|e| js_err(&format!("invalid document JSON: {e}")))?;
    Ok(crate::to_source(&doc))
}

/// Render HTML from an IntentDocument JS object.
#[wasm_bindgen]
pub fn render_wasm(document: JsValue) -> Result<String, JsValue> {
    let doc: IntentDocument = serde_wasm_bindgen::from_value(document)
        .map_err(|e| js_err(&format!("invalid document JSON: {e}")))?;

    #[cfg(feature = "renderer")]
    {
        Ok(crate::render(&doc, None))
    }

    #[cfg(not(feature = "renderer"))]
    {
        let _ = doc;
        Err(js_err("renderer feature is not enabled"))
    }
}

/// Validate an IntentDocument JS object and return diagnostics array.
#[wasm_bindgen]
pub fn validate_wasm(document: JsValue) -> Result<JsValue, JsValue> {
    let doc: IntentDocument = serde_wasm_bindgen::from_value(document)
        .map_err(|e| js_err(&format!("invalid document JSON: {e}")))?;

    #[cfg(feature = "validate")]
    {
        let diagnostics: Vec<Diagnostic> = crate::validate(&doc);
        let js_diags: Vec<JsDiagnostic> = diagnostics
            .into_iter()
            .map(|d| JsDiagnostic {
                severity: severity_str(&d.severity),
                code: d.code.as_str(),
                message: d.message,
                line: d.line,
                column: d.column,
            })
            .collect();
        to_js_value(&js_diags)
    }

    #[cfg(not(feature = "validate"))]
    {
        let _ = doc;
        Err(js_err("validate feature is not enabled"))
    }
}
