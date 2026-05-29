//! Keyword property schema registry for type-aware tooling.

use std::collections::HashMap;

use once_cell::sync::Lazy;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PropertyKind {
    String,
    Number,
    Boolean,
    Date,
    Enum,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PropertySpec {
    pub kind: PropertyKind,
    pub enum_values: Vec<&'static str>,
}

pub static KEYWORD_PROPERTY_SCHEMA: Lazy<HashMap<&'static str, HashMap<&'static str, PropertySpec>>> = Lazy::new(|| {
    let mut m = HashMap::new();

    let mut task = HashMap::new();
    task.insert("owner", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    task.insert("due", PropertySpec { kind: PropertyKind::Date, enum_values: vec![] });
    task.insert("priority", PropertySpec {
        kind: PropertyKind::Enum,
        enum_values: vec!["low", "medium", "high"],
    });
    m.insert("task", task);

    let mut step = HashMap::new();
    step.insert("tool", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    step.insert("timeout", PropertySpec { kind: PropertyKind::Number, enum_values: vec![] });
    step.insert("retries", PropertySpec { kind: PropertyKind::Number, enum_values: vec![] });
    m.insert("step", step);

    let mut gate = HashMap::new();
    gate.insert("approver", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    gate.insert("timeout", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    m.insert("gate", gate);

    let mut track = HashMap::new();
    track.insert("version", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    track.insert("by", PropertySpec { kind: PropertyKind::String, enum_values: vec![] });
    m.insert("track", track);

    m
});

pub fn property_schema_for(keyword: &str) -> Option<&'static HashMap<&'static str, PropertySpec>> {
    KEYWORD_PROPERTY_SCHEMA.get(keyword)
}

pub fn property_kind(keyword: &str, property: &str) -> Option<PropertyKind> {
    property_schema_for(keyword)?.get(property).map(|p| p.kind.clone())
}
