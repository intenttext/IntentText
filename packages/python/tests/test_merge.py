from __future__ import annotations

from intenttext import merge_data, parse, parse_and_merge


def test_merge_simple_variable() -> None:
    doc = parse("note: Hello {{name}}")
    merged = merge_data(doc, {"name": "World"})
    assert merged.blocks[0].content == "Hello World"


def test_merge_nested_variable() -> None:
    doc = parse("note: Client {{client.name}}")
    merged = merge_data(doc, {"client": {"name": "Acme"}})
    assert merged.blocks[0].content == "Client Acme"


def test_merge_list_index_variable() -> None:
    doc = parse("note: First {{items.0}}")
    merged = merge_data(doc, {"items": ["A", "B"]})
    assert merged.blocks[0].content == "First A"


def test_merge_leaves_runtime_page_var() -> None:
    doc = parse("page: | footer: {{page}} / {{pages}}")
    merged = merge_data(doc, {})
    assert "{{page}}" in merged.blocks[0].properties["footer"]
    assert "{{pages}}" in merged.blocks[0].properties["footer"]


def test_merge_keeps_missing_variable_unresolved() -> None:
    doc = parse("note: Hi {{missing.key}}")
    merged = merge_data(doc, {})
    assert "{{missing.key}}" in merged.blocks[0].content


def test_parse_and_merge_one_call() -> None:
    merged = parse_and_merge("title: Invoice {{invoice.number}}", {"invoice": {"number": "42"}})
    assert merged.metadata.title == "Invoice 42"


def test_merge_does_not_mutate_input() -> None:
    doc = parse("note: Hello {{name}}")
    _ = merge_data(doc, {"name": "World"})
    assert doc.blocks[0].content == "Hello {{name}}"
