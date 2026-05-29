from __future__ import annotations

import os

from .rust_bridge import should_fallback_to_python, to_source_with_rust_core
from .types import IntentDocument


def to_source(doc: IntentDocument) -> str:
    engine = os.getenv("INTENTTEXT_PY_SOURCE_ENGINE", "py").strip().lower()
    if engine in {"rust", "core"}:
        try:
            return to_source_with_rust_core(_to_source_with_python(doc))
        except Exception:
            if not should_fallback_to_python():
                raise

    return _to_source_with_python(doc)


def _to_source_with_python(doc: IntentDocument) -> str:
    lines: list[str] = []

    for block in doc.blocks:
        if block.type == "divider":
            lines.append("---")
            continue

        if block.type == "table":
            for row in block.properties.get("rows", []):
                lines.append("| " + " | ".join(str(c) for c in row) + " |")
            continue

        keyword = block.type
        props = dict(block.properties)

        if block.type == "task" and str(props.get("status", "")).lower() == "done":
            keyword = "done"
            props.pop("status", None)

        # Special case: break block
        if block.type == "break":
            prop_parts = [f"{k}: {v}" for k, v in props.items()]
            lines.append("break: | " + " | ".join(prop_parts) if prop_parts else "break:")
            continue

        # Special case: code block
        if block.type == "code":
            lang = str(props.get("lang", ""))
            lines.append(f"```{lang}\n{block.content}\n```")
            continue

        parts = [f"{keyword}: {block.original_content or block.content}".rstrip()]
        for key, value in props.items():
            parts.append(f"{key}: {value}")

        lines.append(" | ".join(parts))

    return "\n".join(lines)
