"""Smoke tests for the thin CLI bridge.

These require Node and the core CLI to be reachable (see intenttext.parser).
They are skipped automatically when the core CLI cannot be located.
"""

from __future__ import annotations

import pytest

from intenttext import IntentTextCoreNotFound, parse, parse_safe


def _core_available() -> bool:
    try:
        parse("title: probe")
        return True
    except IntentTextCoreNotFound:
        return False


pytestmark = pytest.mark.skipif(
    not _core_available(), reason="core CLI not available"
)


def test_parse_title_and_block() -> None:
    doc = parse("title: Hello\ntask: Do a thing")
    assert doc.metadata.title == "Hello"
    assert any(b.type == "task" for b in doc.blocks)


def test_parse_keeps_properties() -> None:
    doc = parse("task: Ship it | owner: Ada | priority: high")
    task = next(b for b in doc.blocks if b.type == "task")
    assert task.properties.get("owner") == "Ada"
    assert task.properties.get("priority") == "high"


def test_parse_safe_returns_result() -> None:
    result = parse_safe("title: Doc")
    assert result.document.metadata.title == "Doc"
    assert result.warnings == []
    assert result.errors == []
