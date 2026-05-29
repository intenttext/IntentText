//! Document schema validation parity surface.

use std::collections::HashMap;

use once_cell::sync::Lazy;

use crate::types::{IntentBlock, IntentDocument};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum PropertyType {
    #[default]
    String,
    Number,
    Boolean,
    Date,
    Enum,
    Url,
    Email,
}

#[derive(Debug, Clone, Default)]
pub struct PropertySchema {
    pub property_type: PropertyType,
    pub required: bool,
    pub enum_values: Vec<String>,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct ContentSchema {
    pub required: bool,
    pub min_length: Option<usize>,
    pub max_length: Option<usize>,
}

#[derive(Debug, Clone, Default)]
pub struct BlockSchema {
    pub block_type: String,
    pub content: Option<ContentSchema>,
    pub properties: HashMap<String, PropertySchema>,
    pub allow_unknown_properties: bool,
}

#[derive(Debug, Clone, Default)]
pub struct DocumentSchema {
    pub name: String,
    pub description: Option<String>,
    pub required_blocks: Vec<String>,
    pub block_schemas: HashMap<String, BlockSchema>,
    pub allow_unknown_blocks: bool,
}

#[derive(Debug, Clone, Default)]
pub struct ValidationError {
    pub block_id: String,
    pub block_type: String,
    pub field: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone, Default)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<ValidationError>,
    pub warnings: Vec<ValidationError>,
}

pub static PREDEFINED_SCHEMAS: Lazy<HashMap<String, DocumentSchema>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("project".to_string(), project_schema());
    m.insert("meeting".to_string(), meeting_schema());
    m.insert("article".to_string(), article_schema());
    m.insert("checklist".to_string(), checklist_schema());
    m.insert("agentic".to_string(), agentic_schema());
    m
});

pub fn create_schema(name: &str) -> Option<DocumentSchema> {
    PREDEFINED_SCHEMAS.get(name).cloned()
}

pub fn validate_document(document: &IntentDocument, schema: &DocumentSchema) -> ValidationResult {
    let mut out = ValidationResult::default();
    let blocks = &document.blocks;

    for req in &schema.required_blocks {
        if !blocks.iter().any(|b| b.block_type == *req) {
            out.errors.push(ValidationError {
                block_id: String::new(),
                block_type: req.clone(),
                field: "type".to_string(),
                message: format!("Required block type missing: {req}"),
                severity: "error".to_string(),
            });
        }
    }

    for b in blocks {
        if let Some(bs) = schema.block_schemas.get(&b.block_type) {
            validate_block(b, bs, &mut out);
        } else if !schema.allow_unknown_blocks {
            out.warnings.push(ValidationError {
                block_id: b.id.clone(),
                block_type: b.block_type.clone(),
                field: "type".to_string(),
                message: format!("Unknown block type for schema: {}", b.block_type),
                severity: "warning".to_string(),
            });
        }
    }

    out.valid = out.errors.is_empty();
    out
}

pub fn format_validation_result(result: &ValidationResult) -> String {
    if result.valid && result.warnings.is_empty() {
        return "Validation passed".to_string();
    }
    let mut lines = Vec::new();
    if !result.errors.is_empty() {
        lines.push(format!("Errors: {}", result.errors.len()));
        for e in &result.errors {
            lines.push(format!("- {} [{}:{}]", e.message, e.block_type, e.field));
        }
    }
    if !result.warnings.is_empty() {
        lines.push(format!("Warnings: {}", result.warnings.len()));
        for w in &result.warnings {
            lines.push(format!("- {} [{}:{}]", w.message, w.block_type, w.field));
        }
    }
    lines.join("\n")
}

fn validate_block(block: &IntentBlock, schema: &BlockSchema, out: &mut ValidationResult) {
    if let Some(c) = &schema.content {
        let len = block.content.chars().count();
        if c.required && block.content.trim().is_empty() {
            out.errors.push(ValidationError {
                block_id: block.id.clone(),
                block_type: block.block_type.clone(),
                field: "content".to_string(),
                message: "Content is required".to_string(),
                severity: "error".to_string(),
            });
        }
        if let Some(min) = c.min_length {
            if len < min {
                out.errors.push(ValidationError {
                    block_id: block.id.clone(),
                    block_type: block.block_type.clone(),
                    field: "content".to_string(),
                    message: format!("Content must be at least {min} characters"),
                    severity: "error".to_string(),
                });
            }
        }
        if let Some(max) = c.max_length {
            if len > max {
                out.errors.push(ValidationError {
                    block_id: block.id.clone(),
                    block_type: block.block_type.clone(),
                    field: "content".to_string(),
                    message: format!("Content must be at most {max} characters"),
                    severity: "error".to_string(),
                });
            }
        }
    }

    let props = block.properties.as_ref().cloned().unwrap_or_default();
    for (key, ps) in &schema.properties {
        let v = props.get(key);
        if ps.required && v.is_none() {
            out.errors.push(ValidationError {
                block_id: block.id.clone(),
                block_type: block.block_type.clone(),
                field: key.clone(),
                message: format!("Property \"{key}\" is required"),
                severity: "error".to_string(),
            });
            continue;
        }
        if let Some(v) = v {
            validate_property(block, key, v, ps, out);
        }
    }

    if !schema.allow_unknown_properties {
        for key in props.keys() {
            if !schema.properties.contains_key(key) {
                out.warnings.push(ValidationError {
                    block_id: block.id.clone(),
                    block_type: block.block_type.clone(),
                    field: key.clone(),
                    message: format!("Unknown property for schema: {key}"),
                    severity: "warning".to_string(),
                });
            }
        }
    }
}

fn validate_property(
    block: &IntentBlock,
    field: &str,
    value: &str,
    schema: &PropertySchema,
    out: &mut ValidationResult,
) {
    match schema.property_type {
        PropertyType::Number => {
            if let Ok(n) = value.parse::<f64>() {
                if let Some(min) = schema.min {
                    if n < min {
                        out.errors
                            .push(prop_err(block, field, format!("must be >= {min}")));
                    }
                }
                if let Some(max) = schema.max {
                    if n > max {
                        out.errors
                            .push(prop_err(block, field, format!("must be <= {max}")));
                    }
                }
            } else {
                out.errors
                    .push(prop_err(block, field, "must be a number".to_string()));
            }
        }
        PropertyType::Enum => {
            if !schema.enum_values.is_empty() && !schema.enum_values.iter().any(|v| v == value) {
                out.errors.push(prop_err(
                    block,
                    field,
                    format!("must be one of: {}", schema.enum_values.join(", ")),
                ));
            }
        }
        PropertyType::Url => {
            let low = value.to_ascii_lowercase();
            if !(low.starts_with("http://")
                || low.starts_with("https://")
                || low.starts_with("/")
                || low.starts_with("./")
                || low.starts_with("../"))
            {
                out.errors
                    .push(prop_err(block, field, "must be a URL".to_string()));
            }
        }
        PropertyType::Email => {
            if !value.contains('@') {
                out.errors
                    .push(prop_err(block, field, "must be an email".to_string()));
            }
        }
        PropertyType::Date => {
            if let Some(fmt) = &schema.format {
                if fmt == "iso-date" {
                    let ok = value.len() == 10
                        && value.chars().nth(4) == Some('-')
                        && value.chars().nth(7) == Some('-');
                    if !ok {
                        out.errors.push(prop_err(
                            block,
                            field,
                            "must be in ISO date format (YYYY-MM-DD)".to_string(),
                        ));
                    }
                }
            }
        }
        PropertyType::String | PropertyType::Boolean => {}
    }
}

fn prop_err(block: &IntentBlock, field: &str, message: String) -> ValidationError {
    ValidationError {
        block_id: block.id.clone(),
        block_type: block.block_type.clone(),
        field: field.to_string(),
        message: format!("Property \"{field}\" {message}"),
        severity: "error".to_string(),
    }
}

fn project_schema() -> DocumentSchema {
    let mut task_props = HashMap::new();
    task_props.insert(
        "priority".to_string(),
        PropertySchema {
            property_type: PropertyType::Enum,
            enum_values: vec!["low".to_string(), "medium".to_string(), "high".to_string()],
            ..Default::default()
        },
    );
    task_props.insert(
        "due".to_string(),
        PropertySchema {
            property_type: PropertyType::Date,
            format: Some("iso-date".to_string()),
            ..Default::default()
        },
    );

    let mut block_schemas = HashMap::new();
    block_schemas.insert(
        "task".to_string(),
        BlockSchema {
            block_type: "task".to_string(),
            properties: task_props,
            allow_unknown_properties: true,
            ..Default::default()
        },
    );

    DocumentSchema {
        name: "project".to_string(),
        description: Some("Project planning document".to_string()),
        required_blocks: vec!["title".to_string()],
        block_schemas,
        allow_unknown_blocks: true,
    }
}

fn meeting_schema() -> DocumentSchema {
    DocumentSchema {
        name: "meeting".to_string(),
        description: Some("Meeting notes document".to_string()),
        required_blocks: vec!["title".to_string(), "section".to_string()],
        allow_unknown_blocks: true,
        ..Default::default()
    }
}

fn article_schema() -> DocumentSchema {
    DocumentSchema {
        name: "article".to_string(),
        description: Some("Article document".to_string()),
        required_blocks: vec!["title".to_string(), "summary".to_string()],
        allow_unknown_blocks: false,
        ..Default::default()
    }
}

fn checklist_schema() -> DocumentSchema {
    DocumentSchema {
        name: "checklist".to_string(),
        description: Some("Checklist document".to_string()),
        required_blocks: vec!["title".to_string()],
        allow_unknown_blocks: false,
        ..Default::default()
    }
}

fn agentic_schema() -> DocumentSchema {
    DocumentSchema {
        name: "agentic".to_string(),
        description: Some("Agentic workflow document".to_string()),
        required_blocks: vec!["title".to_string()],
        allow_unknown_blocks: true,
        ..Default::default()
    }
}
