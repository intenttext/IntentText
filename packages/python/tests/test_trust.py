from __future__ import annotations

from intenttext.trust import (
    compute_document_hash,
    find_history_boundary,
    seal_document,
    verify_document,
)


def test_find_history_boundary_v212_keyword() -> None:
    source = "title: Demo\nhistory:\nrevision: | version: 1.0"
    idx = find_history_boundary(source)
    assert idx == source.index("history:")


def test_trust_roundtrip_python_mode() -> None:
    source = "title: Demo\ntext: Hello"
    sealed = seal_document(source, signer="Alice", role="Lead")
    assert sealed["success"] is True
    result = verify_document(sealed["source"])
    assert result["frozen"] is True
    assert result["intact"] is True
    assert isinstance(compute_document_hash(source), str)


def test_trust_roundtrip_rust_mode(monkeypatch) -> None:
    monkeypatch.setenv("INTENTTEXT_PY_TRUST_ENGINE", "rust")
    monkeypatch.setenv("INTENTTEXT_PY_FALLBACK", "1")

    source = "title: Demo\ntext: Hello"
    sealed = seal_document(source, signer="Alice", role="Lead")
    assert sealed["success"] is True
    assert sealed["hash"].startswith("sha256:")

    result = verify_document(sealed["source"])
    assert result["frozen"] is True
    assert result["intact"] is True
    assert isinstance(result.get("frozen_at"), str)
