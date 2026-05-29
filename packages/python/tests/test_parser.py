from __future__ import annotations

import pytest

from intenttext.parser import ALL_KEYWORDS, parse, parse_safe


def test_parse_returns_document_and_metadata() -> None:
    doc = parse(
        "\n".join(
            [
                "title: Demo",
                "summary: A short summary",
                "agent: orchestrator | model: gpt-5",
                "context: | userId: u1 | plan: pro",
                "section: Tasks",
                "task: Ship feature | owner: Emad",
            ]
        )
    )

    assert doc.version
    assert doc.metadata.title == "Demo"
    assert doc.metadata.summary == "A short summary"
    assert doc.metadata.agent == "orchestrator"
    assert doc.metadata.model == "gpt-5"
    assert doc.metadata.context["userId"] == "u1"


@pytest.mark.parametrize("keyword", sorted(ALL_KEYWORDS))
def test_parse_handles_all_keywords(keyword: str) -> None:
    doc = parse(f"{keyword}: hello world")
    if keyword in {"agent", "model", "meta", "history"}:
        assert doc.blocks == []
        return

    assert len(doc.blocks) == 1
    if keyword == "done":
        assert doc.blocks[0].type == "task"
        assert doc.blocks[0].properties["status"] == "done"
    else:
        assert doc.blocks[0].type == keyword


def test_parse_safe_unknown_keyword_note_mode() -> None:
    result = parse_safe("unknownx: value", unknown_keyword="text")
    assert result.errors == []
    assert len(result.warnings) == 1
    assert result.document.blocks[0].type == "text"


def test_parse_safe_unknown_keyword_skip_mode() -> None:
    result = parse_safe("unknownx: value", unknown_keyword="skip")
    assert result.errors == []
    assert len(result.warnings) == 1
    assert result.document.blocks == []


def test_parse_safe_unknown_keyword_throw_mode() -> None:
    result = parse_safe("unknownx: value", unknown_keyword="throw")
    assert len(result.errors) == 1


def test_parse_raises_when_throw_mode_has_errors() -> None:
    with pytest.raises(ValueError):
        res = parse_safe("badkey: val", unknown_keyword="throw")
        if res.errors:
            raise ValueError(res.errors[0].message)


def test_parse_safe_never_raises_on_garbage() -> None:
    result = parse_safe("%%%%\n((((\n")
    assert result is not None
    assert result.document.blocks == []


def test_parse_table_rows() -> None:
    source = "\n".join(
        [
            "| Name | Value |",
            "| --- | --- |",
            "| A | 1 |",
            "| B | 2 |",
        ]
    )
    doc = parse(source)
    table = doc.blocks[0]
    assert table.type == "table"
    assert table.properties["rows"][0] == ["Name", "Value"]
    assert table.properties["rows"][2] == ["B", "2"]


def test_parse_code_fence() -> None:
    source = "\n".join(["```", "print('x')", "```"])
    doc = parse(source)
    assert doc.blocks[0].type == "code"
    assert "print('x')" in doc.blocks[0].content


def test_parse_pipe_properties() -> None:
    doc = parse("task: Test | owner: Emad | priority: 1 | done: false")
    block = doc.blocks[0]
    assert block.properties["owner"] == "Emad"
    assert block.properties["priority"] == "1"
    assert block.properties["done"] is False


def test_parse_inline_segments() -> None:
    doc = parse("text: *bold* _italic_ `code` [Docs](https://example.com)")
    kinds = [seg.type for seg in doc.blocks[0].inline]
    assert "bold" in kinds
    assert "italic" in kinds
    assert "code" in kinds
    assert "link" in kinds


def test_parse_max_blocks_cap() -> None:
    source = "\n".join(["text: one", "text: two", "text: three"])
    result = parse_safe(source, max_blocks=2)
    assert len(result.document.blocks) == 2
    assert any(w.code == "MAX_BLOCKS_REACHED" for w in result.warnings)


def test_parse_line_truncation_warning() -> None:
    source = "text: " + ("x" * 200)
    result = parse_safe(source, max_line_length=20)
    assert any(w.code == "LINE_TRUNCATED" for w in result.warnings)
