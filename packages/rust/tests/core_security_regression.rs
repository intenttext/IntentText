use intenttext::{
    convert_html_to_intenttext, convert_markdown_to_intenttext, extract_workflow, parse,
    parse_and_merge,
};

#[test]
fn markdown_converter_maps_headings_and_lists() {
    let md = "# My Doc\n\n## Tasks\n- Buy milk\n1. First\n";
    let it = convert_markdown_to_intenttext(md);
    assert!(it.contains("title: My Doc"));
    assert!(it.contains("section: Tasks"));
    assert!(it.contains("- Buy milk"));
    assert!(it.contains("1. First"));
}

#[test]
fn html_converter_strips_script_and_blocks_js_links() {
    let html = r#"
      <html><body>
        <h1>Hello</h1>
        <script>alert(1)</script>
        <p><a href="javascript:alert(1)">click me</a></p>
      </body></html>
    "#;
    let it = convert_html_to_intenttext(html);
    assert!(it.contains("title: Hello"));
    assert!(!it.contains("javascript:"));
    assert!(it.contains("note: click me"));
}

#[test]
fn workflow_extractor_builds_dependencies() {
    let src = "step: Build | id: build\nstep: Deploy | id: deploy | depends: build\nresult: Done | id: done | depends: deploy";
    let doc = parse(src, None);
    let graph = extract_workflow(&doc);

    assert!(graph.warnings.is_empty());
    assert!(graph.entry_points.iter().any(|e| e == "build"));
    assert_eq!(graph.execution_order.len(), 3);
    assert!(graph.has_terminal);
}

#[test]
fn parse_and_merge_supports_nested_dot_paths() {
    let src = "note: Hello {{user.name}}";
    let data = serde_json::json!({ "user": { "name": "Emad" } });
    let doc = parse_and_merge(src, &data);
    assert_eq!(doc.blocks[0].content, "Hello Emad");
}

#[cfg(feature = "trust")]
#[test]
fn trust_freeze_metadata_uses_at_and_status() {
    use intenttext::{freeze, parse};

    let doc = parse("title: Secure", None);
    let frozen = freeze(&doc, Some("v1"));
    let freeze_meta = frozen
        .metadata
        .as_ref()
        .and_then(|m| m.freeze.as_ref())
        .expect("freeze metadata should exist");

    assert_eq!(freeze_meta.status, "locked");
    assert!(!freeze_meta.at.is_empty());
}
