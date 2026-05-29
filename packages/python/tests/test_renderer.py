from __future__ import annotations

from intenttext import parse, render_html, render_markdown, render_print


def test_render_html_contains_content() -> None:
    doc = parse("title: Demo\ntext: Hello")
    out = render_html(doc)
    assert "Demo" in out
    assert "Hello" in out


def test_render_html_has_css_by_default() -> None:
    doc = parse("text: Hello")
    out = render_html(doc)
    assert "<style>" in out


def test_render_html_without_css() -> None:
    doc = parse("text: Hello")
    out = render_html(doc, include_css=False)
    assert "<style>" not in out


def test_render_print_wraps_document() -> None:
    doc = parse("text: Hello")
    out = render_print(doc)
    assert out.startswith("<!doctype html>")
    assert "it-document" in out


def test_render_markdown_tasks() -> None:
    doc = parse("task: Open item\ndone: Closed item")
    md = render_markdown(doc)
    assert "- [ ] Open item" in md
    assert "- [x] Closed item" in md


def test_render_markdown_table() -> None:
    doc = parse("| A | B |\n| 1 | 2 |")
    md = render_markdown(doc)
    assert "| A | B |" in md
    assert "| --- | --- |" in md


def test_render_html_rust_engine_mode(monkeypatch) -> None:
    monkeypatch.setenv("INTENTTEXT_PY_RENDER_ENGINE", "rust")
    monkeypatch.setenv("INTENTTEXT_PY_FALLBACK", "1")

    doc = parse("title: Demo\ntext: Hello")
    out = render_html(doc)
    assert "Demo" in out
    assert "Hello" in out


def test_render_html_rust_engine_without_css(monkeypatch) -> None:
    monkeypatch.setenv("INTENTTEXT_PY_RENDER_ENGINE", "rust")
    monkeypatch.setenv("INTENTTEXT_PY_FALLBACK", "1")

    doc = parse("text: Hello")
    out = render_html(doc, include_css=False)
    assert "<style>" not in out
    assert "Hello" in out
