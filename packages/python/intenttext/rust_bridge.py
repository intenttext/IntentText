from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from .types import (
    FreezeInfo,
    InlineSegment,
    IntentBlock,
    IntentDocument,
    IntentMetadata,
    ParseResult,
    ParseWarning,
    SignatureInfo,
    TrackingInfo,
)


def query_with_rust_core(
    source: str,
    *,
    query: dict[str, Any],
) -> list[IntentBlock]:
    """Query blocks with @intenttext/core queryDocument through Node.js."""
    payload = {"source": source, "query": query}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            raw = _run_node_query(spec, payload)
            return [_to_block(item) for item in raw]
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust query from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def render_html_with_rust_core(
    source: str,
    *,
    include_css: bool = True,
) -> str:
    """Render HTML with @intenttext/core Rust-backed renderer through Node.js."""
    payload = {"source": source, "includeCss": include_css}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_render_html(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust HTML render from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def to_source_with_rust_core(source: str) -> str:
    """Convert document to source with @intenttext/core through Node.js."""
    payload = {"source": source}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_to_source(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust source conversion from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def find_history_boundary_with_rust_core(source: str) -> int:
    payload = {"source": source}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_find_history_boundary(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust history-boundary detection from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def compute_document_hash_with_rust_core(source: str) -> str:
    payload = {"source": source}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_compute_document_hash(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust document hash from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def seal_document_with_rust_core(
    source: str,
    *,
    signer: str,
    role: str | None = None,
    skip_sign: bool = False,
) -> dict[str, Any]:
    payload = {
        "source": source,
        "signer": signer,
        "role": role,
        "skipSign": skip_sign,
    }

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_seal_document(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust seal operation from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def verify_document_with_rust_core(source: str) -> dict[str, Any]:
    payload = {"source": source}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_verify_document(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust verify operation from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def validate_with_rust_core(source: str) -> dict[str, Any]:
    """Validate with @intenttext/core semantic validator through Node.js."""
    payload = {"source": source}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            return _run_node_validate(spec, payload)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to run Rust semantic validation from Python bridge. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def parse_safe_with_rust_core(
    source: str,
    *,
    options: dict[str, Any] | None = None,
) -> ParseResult:
    """Parse with @intenttext/core (Rust-backed) through Node.js."""
    payload = {"source": source, "options": options}

    last_error: Exception | None = None
    for spec in _candidate_specs():
        try:
            raw = _run_node_parse(spec, payload)
            return _to_parse_result(raw)
        except Exception as exc:  # pragma: no cover - exercised through fallback path
            last_error = exc

    raise RuntimeError(
        "Unable to load Rust core for Python. Install @intenttext/core or set INTENTTEXT_CORE_PACKAGE_PATH."
    ) from last_error


def should_use_rust_core() -> bool:
    engine = os.getenv("INTENTTEXT_PY_ENGINE", "rust").strip().lower()
    return engine not in {"py", "python"}


def should_fallback_to_python() -> bool:
    value = os.getenv("INTENTTEXT_PY_FALLBACK", "1").strip().lower()
    return value not in {"0", "false", "no"}


def _candidate_specs() -> list[str]:
    specs: list[str] = []

    explicit_path = os.getenv("INTENTTEXT_CORE_PACKAGE_PATH", "").strip()
    if explicit_path:
        specs.append(_path_to_spec(Path(explicit_path)))

    explicit_module = os.getenv("INTENTTEXT_CORE_MODULE", "").strip()
    if explicit_module:
        specs.append(explicit_module)

    repo_root = Path(__file__).resolve().parents[2]
    local_core_dist = repo_root / "IntentText" / "packages" / "core" / "dist" / "index.js"
    if local_core_dist.exists():
        specs.append(_path_to_spec(local_core_dist))

    specs.append("@intenttext/core")

    # Preserve order while removing duplicates.
    deduped: list[str] = []
    seen: set[str] = set()
    for spec in specs:
        if spec not in seen:
            seen.add(spec)
            deduped.append(spec)
    return deduped


def _path_to_spec(path: Path) -> str:
    target = path
    if path.is_dir() and (path / "dist" / "index.js").exists():
        target = path / "dist" / "index.js"
    return target.resolve().as_uri()


def _run_node_parse(spec: str, payload: dict[str, Any]) -> dict[str, Any]:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.parseIntentTextSafe !== 'function') {
  throw new Error(`parseIntentTextSafe not found in module: ${spec}`);
}

const hasOptions = payload.options && Object.keys(payload.options).length > 0;
const result = hasOptions
    ? mod.parseIntentTextSafe(payload.source || '', payload.options)
    : mod.parseIntentTextSafe(payload.source || '');
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return json.loads(proc.stdout)


def _run_node_validate(spec: str, payload: dict[str, Any]) -> dict[str, Any]:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.parseIntentText !== 'function' || typeof mod.validateDocumentSemantic !== 'function') {
  throw new Error(`parseIntentText/validateDocumentSemantic not found in module: ${spec}`);
}

const doc = mod.parseIntentText(payload.source || '', { includeHistorySection: true });
const result = mod.validateDocumentSemantic(doc);
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return json.loads(proc.stdout)


def _run_node_query(spec: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.parseIntentText !== 'function' || typeof mod.queryDocument !== 'function') {
  throw new Error(`parseIntentText/queryDocument not found in module: ${spec}`);
}

const doc = mod.parseIntentText(payload.source || '', { includeHistorySection: true });
const result = mod.queryDocument(doc, payload.query || {});
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return json.loads(proc.stdout)


def _run_node_render_html(spec: str, payload: dict[str, Any]) -> str:
    script = r"""
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.parseIntentText !== 'function' || typeof mod.renderHTML !== 'function') {
    throw new Error(`parseIntentText/renderHTML not found in module: ${spec}`);
}

const doc = mod.parseIntentText(payload.source || '', { includeHistorySection: true });
let html = mod.renderHTML(doc);
if (!payload.includeCss) {
    html = html.replace(/<style[^>]*>[\s\S]*?<\/style>\s*/gi, '');
}
process.stdout.write(String(html));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return proc.stdout


def _run_node_to_source(spec: str, payload: dict[str, Any]) -> str:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.parseIntentText !== 'function' || typeof mod.documentToSource !== 'function') {
  throw new Error(`parseIntentText/documentToSource not found in module: ${spec}`);
}

const doc = mod.parseIntentText(payload.source || '', { includeHistorySection: true });
const result = mod.documentToSource(doc);
process.stdout.write(String(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return proc.stdout


def _run_node_find_history_boundary(spec: str, payload: dict[str, Any]) -> int:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.findHistoryBoundaryInSource !== 'function') {
  throw new Error(`findHistoryBoundaryInSource not found in module: ${spec}`);
}

const result = mod.findHistoryBoundaryInSource(payload.source || '');
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return int(json.loads(proc.stdout))


def _run_node_compute_document_hash(spec: str, payload: dict[str, Any]) -> str:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.computeDocumentHash !== 'function') {
  throw new Error(`computeDocumentHash not found in module: ${spec}`);
}

const result = mod.computeDocumentHash(payload.source || '');
process.stdout.write(String(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return proc.stdout.strip()


def _run_node_seal_document(spec: str, payload: dict[str, Any]) -> dict[str, Any]:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.sealDocument !== 'function') {
  throw new Error(`sealDocument not found in module: ${spec}`);
}

const result = mod.sealDocument(payload.source || '', {
  signer: payload.signer || '',
  role: payload.role || undefined,
  skipSign: !!payload.skipSign,
});
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return json.loads(proc.stdout)


def _run_node_verify_document(spec: str, payload: dict[str, Any]) -> dict[str, Any]:
    script = """
import process from 'node:process';

const spec = process.argv[1];
let input = '';
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input || '{}');

const mod = await import(spec);
if (typeof mod.verifyDocument !== 'function') {
  throw new Error(`verifyDocument not found in module: ${spec}`);
}

const result = mod.verifyDocument(payload.source || '');
process.stdout.write(JSON.stringify(result));
""".strip()

    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script, spec],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )

    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "Unknown node bridge failure").strip()
        raise RuntimeError(message)

    return json.loads(proc.stdout)


def _to_parse_result(raw: dict[str, Any]) -> ParseResult:
    document_raw = raw.get("document") or {}
    metadata_raw = document_raw.get("metadata") or {}

    metadata = IntentMetadata(
        title=metadata_raw.get("title"),
        summary=metadata_raw.get("summary"),
        agent=metadata_raw.get("agent"),
        model=metadata_raw.get("model"),
        language=metadata_raw.get("language", "ltr"),
        context=dict(metadata_raw.get("context") or {}),
        tracking=_to_tracking(metadata_raw.get("tracking")),
        signatures=[_to_signature(item) for item in (metadata_raw.get("signatures") or [])],
        freeze=_to_freeze(metadata_raw.get("freeze")),
        meta=dict(metadata_raw.get("meta") or {}),
    )

    blocks = [_to_block(item) for item in (document_raw.get("blocks") or [])]
    normalized_blocks: list[IntentBlock] = []
    for block in blocks:
        if block.type == "agent":
            metadata.agent = block.content or metadata.agent
            if isinstance(block.properties.get("model"), str) and block.properties.get("model"):
                metadata.model = str(block.properties["model"])
            continue
        if block.type == "model":
            metadata.model = block.content or metadata.model
            continue
        normalized_blocks.append(block)

    blocks = normalized_blocks
    warnings = [_to_warning(item) for item in (raw.get("warnings") or [])]
    errors = [_to_warning(item) for item in (raw.get("errors") or [])]

    document = IntentDocument(
        version=str(document_raw.get("version") or "2.14.2"),
        blocks=blocks,
        metadata=metadata,
    )
    return ParseResult(document=document, warnings=warnings, errors=errors)


def _to_block(raw: dict[str, Any]) -> IntentBlock:
    block_type = str(raw.get("type") or "text")
    # Keep Python API compatibility for unknown-keyword fallback blocks.
    if block_type == "body-text":
        block_type = "text"

    inline = [_to_inline(seg) for seg in (raw.get("inline") or [])]
    properties = _normalize_properties(dict(raw.get("properties") or {}))

    if block_type == "info":
        callout_type = str(properties.get("type") or "").strip().lower()
        if callout_type in {"warning", "danger", "tip", "success"}:
            block_type = callout_type

    if block_type == "done":
        block_type = "task"
        properties.setdefault("status", "done")

    table = raw.get("table")
    if isinstance(table, dict):
        headers = table.get("headers") or []
        rows = table.get("rows") or []
        if headers or rows:
            properties.setdefault("rows", [headers, *rows])

    return IntentBlock(
        id=str(raw.get("id") or ""),
        type=block_type,
        content=str(raw.get("content") or ""),
        original_content=str(raw.get("originalContent") or raw.get("original_content") or raw.get("content") or ""),
        inline=inline,
        properties=properties,
    )


def _to_inline(raw: dict[str, Any]) -> InlineSegment:
    return InlineSegment(
        type=str(raw.get("type") or "text"),
        value=str(raw.get("value") or ""),
        href=raw.get("href"),
    )


def _normalize_properties(properties: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in properties.items():
        if isinstance(value, str):
            low = value.lower()
            if low == "true":
                normalized[key] = True
                continue
            if low == "false":
                normalized[key] = False
                continue
        normalized[key] = value
    return normalized


def _to_warning(raw: dict[str, Any]) -> ParseWarning:
    return ParseWarning(
        line=int(raw.get("line") or 0),
        message=str(raw.get("message") or ""),
        code=str(raw.get("code") or "UNKNOWN"),
        original=str(raw.get("original") or ""),
    )


def _to_tracking(raw: dict[str, Any] | None) -> TrackingInfo | None:
    if not raw:
        return None
    return TrackingInfo(
        version=str(raw.get("version") or ""),
        by=str(raw.get("by") or ""),
        active=bool(raw.get("active")),
    )


def _to_signature(raw: dict[str, Any]) -> SignatureInfo:
    return SignatureInfo(
        signer=str(raw.get("signer") or ""),
        role=raw.get("role"),
        at=str(raw.get("at") or ""),
        hash=str(raw.get("hash") or ""),
        valid=raw.get("valid"),
    )


def _to_freeze(raw: dict[str, Any] | None) -> FreezeInfo | None:
    if not raw:
        return None
    return FreezeInfo(
        at=str(raw.get("at") or ""),
        hash=str(raw.get("hash") or ""),
        status=str(raw.get("status") or "locked"),
    )
