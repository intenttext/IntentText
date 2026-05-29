from __future__ import annotations

import re
from copy import deepcopy
from datetime import datetime
from typing import Any

from .parser import parse
from .types import IntentDocument


def merge_data(template: IntentDocument, data: dict[str, Any]) -> IntentDocument:
    doc = deepcopy(template)
    now = datetime.now()
    system_vars = {
        "timestamp": now.isoformat(),
        "date": now.strftime("%d %B %Y"),
        "year": str(now.year),
    }
    merged_data = {**system_vars, **data}

    for block in doc.blocks:
        block.content = _resolve_string(block.content, merged_data)
        block.original_content = _resolve_string(block.original_content, merged_data)
        block.properties = {
            k: _resolve_string(v, merged_data) if isinstance(v, str) else v
            for k, v in block.properties.items()
        }

    _refresh_metadata(doc)

    return doc


def parse_and_merge(template_source: str, data: dict[str, Any]) -> IntentDocument:
    template = parse(template_source)
    return merge_data(template, data)


def _resolve_string(text: str, data: dict[str, Any]) -> str:
    def replacer(match: re.Match[str]) -> str:
        path = match.group(1).strip()
        if path in ("page", "pages"):
            return match.group(0)
        value = _get_by_path(data, path)
        return str(value) if value is not None else match.group(0)

    return re.sub(r"\{\{([^}]+)\}\}", replacer, text)


def _get_by_path(obj: Any, path: str) -> Any:
    parts = path.split(".")
    current = obj

    for part in parts:
        if current is None:
            return None

        if isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None

    return current


def _refresh_metadata(doc: IntentDocument) -> None:
    for block in doc.blocks:
        if block.type == "title":
            doc.metadata.title = block.content
        elif block.type == "summary":
            doc.metadata.summary = block.content
        elif block.type == "agent":
            doc.metadata.agent = block.content
            if "model" in block.properties:
                doc.metadata.model = str(block.properties["model"])
        elif block.type == "context":
            doc.metadata.context.update(
                {k: str(v) for k, v in block.properties.items()}
            )
