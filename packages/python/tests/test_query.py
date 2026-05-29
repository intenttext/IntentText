from __future__ import annotations

import re

from intenttext import parse, query


def _doc():
    return parse(
        "\n".join(
            [
                "section: Backlog",
                "task: Write tests | owner: Ahmed | priority: 1",
                "task: Ship build | owner: Sarah | priority: 2",
                "section: Deployment",
                "step: Run CI | tool: ci.test | id: s1",
                "gate: Approve | approver: Lead | depends: s1",
            ]
        )
    )


def test_query_by_type() -> None:
    tasks = query(_doc(), type="task")
    assert len(tasks) == 2


def test_query_by_section() -> None:
    deploy_blocks = query(_doc(), section="Deployment")
    assert any(b.type == "step" for b in deploy_blocks)
    assert all(b.type != "task" for b in deploy_blocks)


def test_query_by_property_exact() -> None:
    items = query(_doc(), type="task", properties={"owner": "Ahmed"})
    assert len(items) == 1
    assert items[0].properties["owner"] == "Ahmed"


def test_query_by_property_regex() -> None:
    items = query(_doc(), type="step", properties={"tool": re.compile("ci")})
    assert len(items) == 1


def test_query_limit() -> None:
    items = query(_doc(), type=["task", "step", "gate"], limit=2)
    assert len(items) == 2


def test_query_text_filter() -> None:
    items = query(_doc(), text="ship")
    assert len(items) == 1
    assert items[0].content == "Ship build"


def test_query_with_rust_engine_mode(monkeypatch) -> None:
    monkeypatch.setenv("INTENTTEXT_PY_QUERY_ENGINE", "rust")
    monkeypatch.setenv("INTENTTEXT_PY_FALLBACK", "1")

    items = query(_doc(), type="task", properties={"owner": "Ahmed"})
    assert len(items) == 1
    assert items[0].type == "task"
    assert items[0].properties["owner"] == "Ahmed"
