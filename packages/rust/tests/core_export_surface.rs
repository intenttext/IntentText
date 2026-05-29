use std::collections::HashMap;

use intenttext::{
    ask_core, build_index_entry, build_shallow_index, check_staleness, compose_indexes,
    format_csv, format_json, format_query_result, format_table, parse, parse_query,
    query_document, query_composed, serialize_context, update_index,
};
#[cfg(feature = "ai_transport")]
use intenttext::{ask_documents_with_transport, AskTransport};

#[test]
fn query_helpers_work() {
    let doc = parse("task: Write tests | by: emad\ntask: Ship | by: team", None);
    let opts = parse_query("type=task limit:1");
    assert_eq!(opts.block_type.as_deref(), Some("task"));

    let result = query_document(&doc, "type=task");
    let text = format_query_result(&result);
    assert!(text.contains("match(es)"));
    assert!(text.contains("[task] Write tests"));
}

#[test]
fn index_builder_helpers_work() {
    let doc = parse("title: A\nsection: Ops\nstep: Deploy | status: done", None);

    let mut files: HashMap<String, (String, intenttext::IntentDocument, String)> = HashMap::new();
    files.insert(
        "a.it".to_string(),
        (
            "title: A\nsection: Ops\nstep: Deploy | status: done".to_string(),
            doc.clone(),
            "2026-03-09T00:00:00Z".to_string(),
        ),
    );

    let index = build_shallow_index("docs", &files, "2.14.2");
    assert_eq!(index.scope, "shallow");
    assert!(index.files.contains_key("a.it"));

    let mut current_files = HashMap::new();
    current_files.insert(
        "a.it".to_string(),
        (
            "title: A\nsection: Ops\nstep: Deploy | status: done".to_string(),
            "2026-03-09T00:00:00Z".to_string(),
        ),
    );
    let (stale, added, removed, unchanged) = check_staleness(&index, &current_files);
    assert!(stale.is_empty());
    assert!(added.is_empty());
    assert!(removed.is_empty());
    assert_eq!(unchanged, vec!["a.it".to_string()]);

    let composed = compose_indexes(std::slice::from_ref(&index));
    assert!(!composed.is_empty());

    let mut filters = HashMap::new();
    filters.insert("type".to_string(), "step".to_string());
    let filtered = query_composed(&composed, &filters);
    assert_eq!(filtered.len(), 1);

    assert!(format_table(&filtered).contains("TYPE"));
    assert!(format_json(&filtered).contains("\"file\""));
    assert!(format_csv(&filtered).contains("file,type,content"));

    let entry = build_index_entry(
        &doc,
        "title: A\nsection: Ops\nstep: Deploy | status: done",
        "2026-03-09T00:00:00Z",
    );
    assert!(!entry.hash.is_empty());

    let mut updates = HashMap::new();
    updates.insert(
        "b.it".to_string(),
        (
            "title: B\ntext: new".to_string(),
            parse("title: B\ntext: new", None),
            "2026-03-10T00:00:00Z".to_string(),
        ),
    );
    let updated = update_index(&index, &updates, &[]);
    assert!(updated.files.contains_key("b.it"));
}

#[test]
fn serialize_context_outputs_file_sections() {
    let doc = parse("section: S\nnote: Hello | by: emad", None);
    let entry = build_index_entry(&doc, "section: S\nnote: Hello | by: emad", "2026-03-09T00:00:00Z");
    let mut idx = intenttext::ItIndex {
        scope: "shallow".to_string(),
        folder: "docs".to_string(),
        ..Default::default()
    };
    idx.files.insert("x.it".to_string(), entry);

    let composed = compose_indexes(&[idx]);
    let serialized = serialize_context(&composed);
    assert!(serialized.contains("--- docs/x.it ---"));
}

#[test]
fn ask_core_builds_context_payload() {
    let doc = parse("section: S\nnote: Hello | by: emad", None);
    let entry = build_index_entry(&doc, "section: S\nnote: Hello | by: emad", "2026-03-09T00:00:00Z");
    let mut idx = intenttext::ItIndex {
        scope: "shallow".to_string(),
        folder: "docs".to_string(),
        ..Default::default()
    };
    idx.files.insert("x.it".to_string(), entry);

    let composed = compose_indexes(&[idx]);
    let payload = ask_core(&composed, "What changed?", None);
    assert_eq!(payload.question, "What changed?");
    assert!(payload.context.contains("--- docs/x.it ---"));
}

#[cfg(feature = "ai_transport")]
#[test]
fn ask_transport_hook_is_used() {
    struct MockTransport;

    impl AskTransport for MockTransport {
        fn ask(
            &self,
            question: &str,
            context: &str,
            _options: Option<&intenttext::AskOptions>,
        ) -> Result<String, String> {
            let header = context
                .lines()
                .find(|line| !line.trim().is_empty())
                .unwrap_or("");
            Ok(format!("Q={question}; C={header}"))
        }
    }

    let doc = parse("section: S\nnote: Hello | by: emad", None);
    let entry = build_index_entry(&doc, "section: S\nnote: Hello | by: emad", "2026-03-09T00:00:00Z");
    let mut idx = intenttext::ItIndex {
        scope: "shallow".to_string(),
        folder: "docs".to_string(),
        ..Default::default()
    };
    idx.files.insert("x.it".to_string(), entry);

    let composed = compose_indexes(&[idx]);
    let answer = ask_documents_with_transport(&composed, "What is this?", None, &MockTransport)
        .expect("transport should succeed");
    assert!(answer.contains("Q=What is this?"));
    assert!(answer.contains("C=--- docs/x.it ---"));
}
