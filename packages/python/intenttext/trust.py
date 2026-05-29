"""IntentText Document Trust — hash, seal, verify, history boundary."""

from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timezone
from typing import Optional

from .rust_bridge import (
    compute_document_hash_with_rust_core,
    find_history_boundary_with_rust_core,
    seal_document_with_rust_core,
    should_fallback_to_python,
    verify_document_with_rust_core,
)


def find_history_boundary(source: str) -> int:
    """Find position of the history boundary in source. Returns -1 if not found."""
    if _use_rust_trust_engine():
        try:
            return find_history_boundary_with_rust_core(source)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _find_history_boundary_with_python(source)


def _find_history_boundary_with_python(source: str) -> int:
    """Find position of the history boundary in source. Returns -1 if not found."""
    lines = source.split("\n")
    pos = 0
    for i in range(len(lines)):
        stripped = lines[i].strip()
        if stripped in {"history:", "history: "}:
            return pos
        if i == len(lines) - 1:
            pos += len(lines[i]) + 1
            continue
        if stripped == "---":
            next_stripped = lines[i + 1].strip()
            if next_stripped == "// history" or next_stripped.startswith(
                "// history"
            ):
                return pos
        pos += len(lines[i]) + 1
    return -1


def compute_document_hash(source: str) -> str:
    """Compute SHA-256 hash of document content above history boundary,
    excluding sign: and freeze: lines."""
    if _use_rust_trust_engine():
        try:
            return compute_document_hash_with_rust_core(source)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _compute_document_hash_with_python(source)


def _compute_document_hash_with_python(source: str) -> str:
    boundary = _find_history_boundary_with_python(source)
    content = source[:boundary] if boundary != -1 else source
    # Strip sign:, freeze:, and amendment: lines (their hashes reference the body without them)
    body_lines = [
        line
        for line in content.split("\n")
        if not line.startswith("sign:")
        and not line.startswith("freeze:")
        and not line.startswith("amendment:")
    ]
    body = "\n".join(body_lines).strip()
    hash_hex = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return f"sha256:{hash_hex}"


def _parse_props(text: str) -> dict:
    """Parse pipe-delimited properties from a line like 'key: value | k2: v2'."""
    props: dict = {}
    for segment in text.split("|"):
        segment = segment.strip()
        colon = segment.find(":")
        if colon != -1:
            props[segment[:colon].strip()] = segment[colon + 1 :].strip()
    return props


def verify_document(source: str) -> dict:
    """Verify integrity of a sealed IntentText document.

    Returns:
        dict with keys: intact, frozen, frozen_at, signers, hash, expected_hash, error
    """
    if _use_rust_trust_engine():
        try:
            raw = verify_document_with_rust_core(source)
            return _map_verify_result(raw)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _verify_document_with_python(source)


def _verify_document_with_python(source: str) -> dict:
    boundary = _find_history_boundary_with_python(source)
    content = source[:boundary] if boundary != -1 else source
    lines = content.split("\n")

    freeze_props: Optional[dict] = None
    sign_entries: list[dict] = []

    for line in lines:
        if line.startswith("freeze:"):
            freeze_props = _parse_props(line[len("freeze:") :])
        elif line.startswith("sign:"):
            rest = line[len("sign:") :].strip()
            # First segment before | is the signer name
            parts = rest.split("|")
            signer = parts[0].strip()
            props = _parse_props("|".join(parts[1:]))
            props["signer"] = signer
            sign_entries.append(props)

    if not freeze_props:
        return {
            "intact": False,
            "frozen": False,
            "warning": "Document is not sealed. No freeze: block found.",
        }

    current_hash = _compute_document_hash_with_python(source)
    expected_hash = freeze_props.get("hash", "")
    intact = current_hash == expected_hash

    signers = [
        {
            "signer": s.get("signer"),
            "role": s.get("role"),
            "at": s.get("at"),
            # True if this signer approved the sealed version
            "valid": s.get("hash") == expected_hash,
            # True if this signer's hash matches the current document
            "signed_current_version": s.get("hash") == current_hash,
        }
        for s in sign_entries
    ]

    return {
        "intact": intact,
        "frozen": True,
        "frozen_at": freeze_props.get("at"),
        "signers": signers,
        "hash": current_hash,
        "expected_hash": expected_hash,
        "error": None if intact else "Document has been modified since sealing.",
    }


def seal_document(
    source: str,
    signer: str,
    role: Optional[str] = None,
    skip_sign: bool = False,
) -> dict:
    """Seal a document with a signature and freeze block.

    Returns:
        dict with keys: success, hash, source, at
    """
    if _use_rust_trust_engine():
        try:
            raw = seal_document_with_rust_core(
                source,
                signer=signer,
                role=role,
                skip_sign=skip_sign,
            )
            return _map_seal_result(raw)
        except Exception:
            if not should_fallback_to_python():
                raise

    return _seal_document_with_python(source, signer, role, skip_sign)


def _seal_document_with_python(
    source: str,
    signer: str,
    role: Optional[str],
    skip_sign: bool,
) -> dict:
    hash_val = _compute_document_hash_with_python(source)
    at = datetime.now(timezone.utc).isoformat()

    boundary = _find_history_boundary_with_python(source)
    insert_before = boundary if boundary != -1 else len(source)

    before = source[:insert_before]
    after = source[insert_before:]

    sign_line = (
        ""
        if skip_sign
        else f"sign: {signer}{f' | role: {role}' if role else ''} | at: {at} | hash: {hash_val}\n"
    )
    freeze_line = f"freeze: | at: {at} | hash: {hash_val} | status: locked\n"

    needs_newline = before and not before.endswith("\n")
    updated = before + ("\n" if needs_newline else "") + sign_line + freeze_line + after

    return {"success": True, "hash": hash_val, "source": updated, "at": at}


def _use_rust_trust_engine() -> bool:
    engine = os.getenv("INTENTTEXT_PY_TRUST_ENGINE", "py").strip().lower()
    return engine in {"rust", "core"}


def _map_seal_result(raw: dict) -> dict:
    return {
        "success": bool(raw.get("success", False)),
        "hash": str(raw.get("hash") or ""),
        "source": str(raw.get("source") or ""),
        "at": str(raw.get("at") or ""),
        "error": raw.get("error"),
    }


def _map_verify_result(raw: dict) -> dict:
    return {
        "intact": bool(raw.get("intact", False)),
        "frozen": bool(raw.get("frozen", False)),
        "frozen_at": raw.get("frozenAt"),
        "signers": [
            {
                "signer": s.get("signer"),
                "role": s.get("role"),
                "at": s.get("at"),
                "valid": bool(s.get("valid", False)),
                "signed_current_version": bool(s.get("signedCurrentVersion", False)),
            }
            for s in (raw.get("signers") or [])
        ],
        "hash": raw.get("hash"),
        "expected_hash": raw.get("expectedHash"),
        "error": raw.get("error"),
        "warning": raw.get("warning"),
    }
