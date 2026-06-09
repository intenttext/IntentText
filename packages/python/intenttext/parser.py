"""Thin client over the canonical IntentText core.

This package does NOT re-implement the IntentText grammar. The single source of
truth is the TypeScript core (`@intenttext/core`). This module shells out to the
core CLI and maps its JSON output into Python dataclasses, so the Python and JS
parsers can never drift.

Resolving the core CLI (first match wins):
  1. The ``INTENTTEXT_CLI`` environment variable — path to ``cli.js`` (or any
     executable that accepts ``<file.it>`` and prints the document JSON to stdout).
  2. ``cli.js`` discovered by walking up from this file (monorepo checkout).
  3. ``intenttext`` on PATH (a globally installed core CLI).

If none is found, a clear ``IntentTextCoreNotFound`` error is raised.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Optional

from .types import (
    InlineSegment,
    IntentBlock,
    IntentDocument,
    IntentMetadata,
    ParseResult,
)


class IntentTextCoreNotFound(RuntimeError):
    """Raised when the canonical core CLI cannot be located."""


class IntentTextParseError(RuntimeError):
    """Raised when the core CLI fails to parse the input."""


def _find_cli() -> list[str]:
    env = os.environ.get("INTENTTEXT_CLI")
    if env:
        return ["node", env]

    # Walk up looking for the monorepo cli.js (dev / checkout use).
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "cli.js"
        if candidate.is_file():
            return ["node", str(candidate)]

    # Globally installed core CLI.
    on_path = shutil.which("intenttext")
    if on_path:
        return [on_path]

    raise IntentTextCoreNotFound(
        "Could not locate the IntentText core CLI. Set the INTENTTEXT_CLI "
        "environment variable to the path of cli.js, or install the core CLI."
    )


def _run_core(source: str) -> dict[str, Any]:
    cmd = _find_cli()
    with tempfile.NamedTemporaryFile(
        "w", suffix=".it", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(source)
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            [*cmd, tmp_path],
            capture_output=True,
            text=True,
            check=False,
        )
    finally:
        os.unlink(tmp_path)

    if result.returncode != 0:
        raise IntentTextParseError(
            f"core CLI exited {result.returncode}: {result.stderr.strip()}"
        )
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise IntentTextParseError(
            f"core CLI returned non-JSON output: {exc}"
        ) from exc


def _to_inline(items: Any) -> list[InlineSegment]:
    out: list[InlineSegment] = []
    for it in items or []:
        out.append(
            InlineSegment(
                type=it.get("type", "text"),
                value=it.get("value", ""),
                href=it.get("href"),
            )
        )
    return out


def _to_block(raw: dict[str, Any]) -> IntentBlock:
    block = IntentBlock(
        id=raw.get("id", ""),
        type=raw.get("type", "text"),
        content=raw.get("content", ""),
        original_content=raw.get("originalContent", raw.get("content", "")),
        inline=_to_inline(raw.get("inline")),
        properties=raw.get("properties", {}) or {},
    )
    return block


def _to_metadata(raw: Optional[dict[str, Any]]) -> IntentMetadata:
    raw = raw or {}
    return IntentMetadata(
        title=raw.get("title"),
        summary=raw.get("summary"),
        agent=raw.get("agent"),
        model=raw.get("model"),
        language=raw.get("language", "ltr"),
        context=raw.get("context", {}) or {},
        meta=raw.get("meta", {}) or {},
    )


def _to_document(raw: dict[str, Any]) -> IntentDocument:
    return IntentDocument(
        version=raw.get("version", ""),
        blocks=[_to_block(b) for b in raw.get("blocks", [])],
        metadata=_to_metadata(raw.get("metadata")),
    )


def parse(source: str) -> IntentDocument:
    """Parse IntentText source into an :class:`IntentDocument` via the core CLI."""
    return _to_document(_run_core(source))


def parse_safe(source: str) -> ParseResult:
    """Parse and return a :class:`ParseResult`.

    The CLI bridge surfaces parse failures as exceptions, so on success the
    ``warnings``/``errors`` lists are empty.
    """
    return ParseResult(document=parse(source), warnings=[], errors=[])
