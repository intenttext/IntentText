from __future__ import annotations

from collections import Counter

from intenttext import parse, to_source


def test_to_source_round_trip_types_and_content() -> None:
    source = "\n".join(
        [
            "title: Demo",
            "section: Tasks",
            "task: Write tests | owner: Ahmed",
            "done: Ship feature | owner: Sarah",
            "| Name | Value |",
            "| A | 1 |",
            "---",
        ]
    )

    doc1 = parse(source)
    source2 = to_source(doc1)
    doc2 = parse(source2)

    assert Counter((b.type, b.content) for b in doc1.blocks) == Counter(
        (b.type, b.content) for b in doc2.blocks
    )


def test_to_source_preserves_done_status_behavior() -> None:
    doc = parse("done: Closed ticket | owner: N")
    source = to_source(doc)
    assert source.startswith("done: Closed ticket")


def test_to_source_rust_engine_roundtrip(monkeypatch) -> None:
    monkeypatch.setenv("INTENTTEXT_PY_SOURCE_ENGINE", "rust")
    monkeypatch.setenv("INTENTTEXT_PY_FALLBACK", "1")

    source = "\n".join(
        [
            "title: Demo",
            "task: Write tests | owner: Ahmed",
            "done: Ship feature | owner: Sarah",
        ]
    )

    doc1 = parse(source)
    source2 = to_source(doc1)
    doc2 = parse(source2)

    assert Counter((b.type, b.content) for b in doc1.blocks) == Counter(
        (b.type, b.content) for b in doc2.blocks
    )
