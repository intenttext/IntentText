use intenttext::{format_query_result, parse, parse_query, query_document, render, to_source};

#[derive(Clone)]
struct Fixture {
    name: &'static str,
    source: &'static str,
    expected_blocks: usize,
    expected_first_type: &'static str,
    query: &'static str,
    expected_query_hits: usize,
    render_contains: &'static str,
}

#[test]
fn core_smoke_fixtures_matrix() {
    let fixtures = fixtures();
    assert_eq!(
        fixtures.len(),
        20,
        "fixture harness must keep 20 high-value fixtures"
    );

    for f in fixtures {
        let doc = parse(f.source, None);
        assert_eq!(doc.blocks.len(), f.expected_blocks, "fixture: {}", f.name);
        assert_eq!(
            doc.blocks[0].block_type, f.expected_first_type,
            "fixture: {}",
            f.name
        );

        let html = render(&doc, None);
        assert!(html.contains(f.render_contains), "fixture: {}", f.name);

        let result = query_document(&doc, f.query);
        assert_eq!(result.total, f.expected_query_hits, "fixture: {}", f.name);

        let formatted = format_query_result(&result);
        if f.expected_query_hits == 0 {
            assert!(
                formatted.contains("No matching blocks"),
                "fixture: {}",
                f.name
            );
        } else {
            assert!(formatted.contains("match(es)"), "fixture: {}", f.name);
        }

        let serialized = to_source(&doc);
        assert!(!serialized.trim().is_empty(), "fixture: {}", f.name);

        // Keep parse_query in harness so parser and query-string surface stays covered.
        let parsed_query = parse_query(f.query);
        if f.query.contains("type=") {
            assert!(parsed_query.block_type.is_some(), "fixture: {}", f.name);
        }
    }
}

fn fixtures() -> Vec<Fixture> {
    vec![
        Fixture {
            name: "title-text",
            source: "title: Project\ntext: kickoff",
            expected_blocks: 2,
            expected_first_type: "title",
            query: "type=title",
            expected_query_hits: 1,
            render_contains: "intent-title",
        },
        Fixture {
            name: "section-task",
            source: "section: Build\ntask: Write parser | owner: emad",
            expected_blocks: 2,
            expected_first_type: "section",
            query: "type=task",
            expected_query_hits: 1,
            render_contains: "intent-task",
        },
        Fixture {
            name: "done-task",
            source: "done: Ship release",
            expected_blocks: 1,
            expected_first_type: "done",
            query: "type=done",
            expected_query_hits: 1,
            render_contains: "intent-task-done",
        },
        Fixture {
            name: "warning-callout",
            source: "warning: Rotate credentials",
            expected_blocks: 1,
            expected_first_type: "info",
            query: "type=info",
            expected_query_hits: 1,
            render_contains: "callout-warning",
        },
        Fixture {
            name: "danger-callout",
            source: "danger: Incident",
            expected_blocks: 1,
            expected_first_type: "info",
            query: "type=info",
            expected_query_hits: 1,
            render_contains: "callout-danger",
        },
        Fixture {
            name: "link",
            source: "link: Docs | to: https://example.com",
            expected_blocks: 1,
            expected_first_type: "link",
            query: "type=link",
            expected_query_hits: 1,
            render_contains: "https://example.com",
        },
        Fixture {
            name: "code",
            source: "code: println!(\"hi\") | lang: rust",
            expected_blocks: 1,
            expected_first_type: "code",
            query: "type=code",
            expected_query_hits: 1,
            render_contains: "language-rust",
        },
        Fixture {
            name: "quote",
            source: "quote: Build once | author: team",
            expected_blocks: 1,
            expected_first_type: "quote",
            query: "type=quote",
            expected_query_hits: 1,
            render_contains: "it-quote",
        },
        Fixture {
            name: "metric",
            source: "metric: uptime | value: 99.9 | unit: %",
            expected_blocks: 1,
            expected_first_type: "metric",
            query: "type=metric",
            expected_query_hits: 1,
            render_contains: "it-metric",
        },
        Fixture {
            name: "workflow-step",
            source: "step: Build | id: build\nstep: Deploy | id: deploy | depends: build",
            expected_blocks: 2,
            expected_first_type: "step",
            query: "type=step",
            expected_query_hits: 2,
            render_contains: "intent-step",
        },
        Fixture {
            name: "gate",
            source: "gate: Approve release | approver: lead",
            expected_blocks: 1,
            expected_first_type: "gate",
            query: "type=gate",
            expected_query_hits: 1,
            render_contains: "it-gate",
        },
        Fixture {
            name: "decision",
            source: "decision: Use Rust core",
            expected_blocks: 1,
            expected_first_type: "decision",
            query: "type=decision",
            expected_query_hits: 1,
            render_contains: "it-decision",
        },
        Fixture {
            name: "result",
            source: "result: complete",
            expected_blocks: 1,
            expected_first_type: "result",
            query: "type=result",
            expected_query_hits: 1,
            render_contains: "it-result",
        },
        Fixture {
            name: "header-footer",
            source: "page: A4\nheader: Team\nfooter: Internal",
            expected_blocks: 3,
            expected_first_type: "page",
            query: "type=header",
            expected_query_hits: 1,
            render_contains: "it-header",
        },
        Fixture {
            name: "watermark-break",
            source: "watermark: draft\nbreak: section | before: section",
            expected_blocks: 2,
            expected_first_type: "watermark",
            query: "type=break",
            expected_query_hits: 1,
            render_contains: "it-page-break",
        },
        Fixture {
            name: "table-columns-row",
            source: "columns: name | role\nrow: emad | lead",
            expected_blocks: 1,
            expected_first_type: "columns",
            query: "type=columns",
            expected_query_hits: 1,
            render_contains: "it-table",
        },
        Fixture {
            name: "track-sign-freeze",
            source: "track: release | version: 1.2 | by: emad\nsign: emad | at: now | hash: h\nfreeze: | at: now | hash: h | status: locked",
            expected_blocks: 3,
            expected_first_type: "track",
            query: "type=freeze",
            expected_query_hits: 1,
            render_contains: "it-freeze",
        },
        Fixture {
            name: "meta-context-hidden",
            source: "meta: | domain: core\ncontext: | env: test\ntext: hello",
            expected_blocks: 2,
            expected_first_type: "context",
            query: "type=text",
            expected_query_hits: 1,
            render_contains: "intent-text",
        },
        Fixture {
            name: "unknown-extension",
            source: "x-agent: signal notify | channel: email",
            expected_blocks: 1,
            expected_first_type: "x-agent: signal",
            query: "type=x-agent:signal",
            expected_query_hits: 0,
            render_contains: "it-ext",
        },
        Fixture {
            name: "inline-formatting",
            source: "text: Hello **world** and [home](https://example.com)",
            expected_blocks: 1,
            expected_first_type: "text",
            query: "type=text",
            expected_query_hits: 1,
            render_contains: "intent-inline-link",
        },
    ]
}
