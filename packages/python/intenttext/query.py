from __future__ import annotations

import os
from typing import Any, Optional

from .rust_bridge import query_with_rust_core, should_fallback_to_python
from .source import to_source
from .types import IntentBlock, IntentDocument


def query(
    doc: IntentDocument,
    type: Optional[str | list[str]] = None,
    section: Optional[str] = None,
    properties: Optional[dict[str, Any]] = None,
    text: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[IntentBlock]:
    engine = os.getenv("INTENTTEXT_PY_QUERY_ENGINE", "py").strip().lower()
    if engine in {"rust", "core"} and not _has_regex_filters(properties):
        try:
            return _query_with_rust(doc, type, section, properties, text, limit)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _query_with_python(doc, type, section, properties, text, limit)


def _query_with_python(
    doc: IntentDocument,
    type: Optional[str | list[str]],
    section: Optional[str],
    properties: Optional[dict[str, Any]],
    text: Optional[str],
    limit: Optional[int],
) -> list[IntentBlock]:
    results: list[IntentBlock] = []
    current_section = ""

    for block in doc.blocks:
        if block.type == "section":
            current_section = block.content

        if type is not None:
            if isinstance(type, str) and block.type != type:
                continue
            if isinstance(type, list) and block.type not in type:
                continue

        if section is not None and current_section != section:
            continue

        if text is not None and text.lower() not in block.content.lower():
            continue

        if properties:
            matches = True
            for key, expected in properties.items():
                actual = block.properties.get(key)
                if callable(getattr(expected, "search", None)):
                    if actual is None or expected.search(str(actual)) is None:
                        matches = False
                        break
                else:
                    if str(actual) != str(expected):
                        matches = False
                        break
            if not matches:
                continue

        results.append(block)

        if limit is not None and len(results) >= limit:
            break

    return results


def _query_with_rust(
    doc: IntentDocument,
    type: Optional[str | list[str]],
    section: Optional[str],
    properties: Optional[dict[str, Any]],
    text: Optional[str],
    limit: Optional[int],
) -> list[IntentBlock]:
    query_payload: dict[str, Any] = {}
    if type is not None:
        query_payload["type"] = type
    if section is not None:
        query_payload["section"] = section
    if text is not None:
        query_payload["content"] = text
    if properties:
        query_payload["properties"] = properties
    if limit is not None:
        query_payload["limit"] = limit

    source = to_source(doc)
    return query_with_rust_core(source, query=query_payload)


def _has_regex_filters(properties: Optional[dict[str, Any]]) -> bool:
    if not properties:
        return False
    return any(callable(getattr(value, "search", None)) for value in properties.values())
