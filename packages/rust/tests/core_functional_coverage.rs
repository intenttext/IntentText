use intenttext::{
    create_schema, detect_history_boundary, format_validation_result, generate_theme_css,
    get_builtin_theme, list_builtin_themes, parse, parse_intent_text_safe, reset_id_counter,
    validate_document,
};

#[test]
fn theme_registry_and_css_work() {
    let names = list_builtin_themes();
    assert!(names.iter().any(|n| n == "minimal"));
    let theme = get_builtin_theme("minimal").expect("minimal theme should exist");
    let css = generate_theme_css(&theme, Some("web"));
    assert!(css.contains(":root"));
    assert!(css.contains("--it-font-body"));
}

#[test]
fn schema_validation_works() {
    let schema = create_schema("project").expect("project schema should exist");
    let doc = parse("title: X\ntask: Ship | priority: high | due: 2026-03-09", None);
    let result = validate_document(&doc, &schema);
    assert!(result.valid);
    let text = format_validation_result(&result);
    assert!(text.contains("Validation passed") || text.contains("Warnings"));
}

#[test]
fn safe_parse_caps_and_warns() {
    let src = "unknownk: payload\ntext: hello";
    let res = parse_intent_text_safe(src, None);
    assert!(!res.document.blocks.is_empty());
    assert!(!res.warnings.is_empty());
}

#[test]
fn parser_boundary_detection_and_reset_api() {
    reset_id_counter();
    let lines = vec!["title: A", "history:", "revision: | version: 1.0"];
    assert_eq!(detect_history_boundary(&lines), 1);
}

#[cfg(feature = "trust")]
#[test]
fn trust_helper_internal_apis_work() {
    use intenttext::{
        block_fingerprint, compute_document_hash, compute_trust_diff, find_history_boundary_in_source,
        increment_version, seal_document, verify_document, BlockSnapshot, SealOptions,
    };

    let src = "title: A\ntext: B\nhistory:\nrevision: | version: 1.0";
    assert!(find_history_boundary_in_source(src) >= 0);
    assert!(compute_document_hash(src).starts_with("sha256:"));
    assert_eq!(block_fingerprint("  Hello   WORLD "), "hello world");
    assert_eq!(increment_version("1.2", "minor"), "1.3");

    let sealed = seal_document(
        "title: A\ntext: B",
        &SealOptions {
            signer: "Alice".to_string(),
            role: None,
            skip_sign: false,
        },
    );
    assert!(sealed.success);
    let verified = verify_document(&sealed.source);
    assert!(verified.frozen);

    let before = vec![BlockSnapshot {
        id: "x1".to_string(),
        block_type: "text".to_string(),
        content: "a".to_string(),
        section: "root".to_string(),
        properties: std::collections::HashMap::new(),
    }];
    let after = vec![BlockSnapshot {
        id: "x1".to_string(),
        block_type: "text".to_string(),
        content: "b".to_string(),
        section: "root".to_string(),
        properties: std::collections::HashMap::new(),
    }];
    let diff = compute_trust_diff(&before, &after);
    assert_eq!(diff.modified.len(), 1);
}
