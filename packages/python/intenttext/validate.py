from __future__ import annotations

import os
import re
from typing import Iterable

from .types import IntentDocument, ValidationIssue, ValidationResult
from .rust_bridge import validate_with_rust_core, should_fallback_to_python
from .source import to_source


_RUST_CODE_MAP = {
    "GATE_NO_APPROVER": "GATE_APPROVER_REQUIRED",
    "DUPLICATE_STEP_ID": "DUPLICATE_ID",
    "UNRESOLVED_VARIABLE": "VARIABLE_UNRESOLVED",
    "DEPENDS_REF_MISSING": "STEP_REF_MISSING",
}


def validate(doc: IntentDocument) -> ValidationResult:
    engine = os.getenv("INTENTTEXT_PY_VALIDATE_ENGINE", "rust").strip().lower()
    if engine in {"rust", "core"}:
        try:
            return _validate_with_rust(doc)
        except Exception:
            if not should_fallback_to_python():
                raise

    issues: list[ValidationIssue] = []

    def _semantic_id(block):
        pid = block.properties.get("id")
        if isinstance(pid, str) and pid.strip():
            return pid.strip()
        return block.id

    step_ids = {
        _semantic_id(block)
        for block in doc.blocks
        if block.type in {"step", "decision", "parallel", "gate", "call", "result", "handoff", "wait", "retry"}
    }
    all_ids = [_semantic_id(block) for block in doc.blocks]

    has_track = any(block.type == "track" for block in doc.blocks)
    has_sign = any(block.type == "sign" for block in doc.blocks)
    has_freeze = any(block.type == "freeze" for block in doc.blocks)

    # Duplicate block IDs
    seen: set[str] = set()
    for block_id in all_ids:
        if block_id in seen:
            issues.append(
                ValidationIssue(
                    block_id=block_id,
                    block_type="document",
                    type="error",
                    code="DUPLICATE_ID",
                    message=f"Duplicate block id '{block_id}'",
                )
            )
        seen.add(block_id)

    context_vars = set(doc.metadata.context.keys())
    produced_vars = {
        str(block.properties.get("output"))
        for block in doc.blocks
        if "output" in block.properties and str(block.properties.get("output"))
    }

    # Skip per-variable warnings for template documents
    is_template = (
        doc.metadata.meta.get("type") == "template"
        or any(block.type == "input" for block in doc.blocks)
    )

    for block in doc.blocks:
        if block.type == "gate" and not block.properties.get("approver"):
            issues.append(
                ValidationIssue(
                    block_id=block.id,
                    block_type=block.type,
                    type="error",
                    code="GATE_APPROVER_REQUIRED",
                    message="gate: block requires approver property",
                )
            )

        depends = block.properties.get("depends")
        if isinstance(depends, str) and depends and depends not in step_ids:
            issues.append(
                ValidationIssue(
                    block_id=block.id,
                    block_type=block.type,
                    type="error",
                    code="STEP_REF_MISSING",
                    message=f"depends references missing step '{depends}'",
                )
            )

        if block.type == "decision":
            for key in ("then", "else"):
                ref = block.properties.get(key)
                if isinstance(ref, str) and ref and ref not in step_ids:
                    issues.append(
                        ValidationIssue(
                            block_id=block.id,
                            block_type=block.type,
                            type="error",
                            code="STEP_REF_MISSING",
                            message=f"decision {key} references missing step '{ref}'",
                        )
                    )

        if block.type == "parallel":
            steps = block.properties.get("steps")
            if isinstance(steps, str):
                for ref in [s.strip() for s in steps.split(",") if s.strip()]:
                    if ref not in step_ids:
                        issues.append(
                            ValidationIssue(
                                block_id=block.id,
                                block_type=block.type,
                                type="error",
                                code="STEP_REF_MISSING",
                                message=f"parallel steps references missing step '{ref}'",
                            )
                        )

        for var in _extract_vars(block):
            # runtime placeholders are intentionally unresolved
            if var in {"page", "pages"}:
                continue
            # Skip for templates — placeholders resolved at merge time
            if is_template:
                continue
            top = var.split(".")[0]
            if top not in context_vars and top not in produced_vars:
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="warning",
                        code="VARIABLE_UNRESOLVED",
                        message=f"Variable '{{{{{var}}}}}' is not declared in context: or step output",
                    )
                )

    # policy: without condition (skip for templates)
    has_gate_block = any(block.type == "gate" for block in doc.blocks)
    valid_trends = {"up", "down", "stable", "at-risk"}
    for block in doc.blocks:
        if block.type == "policy" and not is_template:
            has_condition = (
                block.properties.get("if")
                or block.properties.get("always")
                or block.properties.get("never")
            )
            if not has_condition:
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="warning",
                        code="POLICY_NO_CONDITION",
                        message=f'Policy "{block.content}" has no condition (if:, always:, or never:). Add a condition or use text: instead.',
                    )
                )

            requires = block.properties.get("requires")
            if requires == "gate" and not has_gate_block:
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="error",
                        code="POLICY_GATE_REQUIRED",
                        message=f'Policy "{block.content}" requires a gate but no gate: block is present.',
                    )
                )

        if block.type == "metric" and not is_template:
            trend = block.properties.get("trend")
            if trend is not None and str(trend) not in valid_trends:
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="warning",
                        code="METRIC_INVALID_TREND",
                        message=f'metric: "{block.content}" has unknown trend "{trend}" — expected up, down, stable, or at-risk',
                    )
                )

        if block.type == "figure" and not is_template:
            if not block.properties.get("caption"):
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="warning",
                        code="FIGURE_MISSING_CAPTION",
                        message=f'figure: "{block.content}" has no caption: property — figures should have captions',
                    )
                )

    # Trust validation: freeze without sign
    if has_freeze and not has_sign:
        issues.append(
            ValidationIssue(
                block_id="document",
                block_type="document",
                type="warning",
                code="FREEZE_WITHOUT_SIGN",
                message="Document is frozen but has no signatures",
            )
        )

    # Trust validation: sign/freeze without track
    if (has_sign or has_freeze) and not has_track:
        issues.append(
            ValidationIssue(
                block_id="document",
                block_type="document",
                type="warning",
                code="TRUST_WITHOUT_TRACK",
                message="Document has sign/freeze blocks but no track: block",
            )
        )

    has_errors = any(issue.type == "error" for issue in issues)
    return ValidationResult(valid=not has_errors, issues=issues)


def _validate_with_rust(doc: IntentDocument) -> ValidationResult:
    source = to_source(doc)
    raw = validate_with_rust_core(source)
    issues: list[ValidationIssue] = []

    for item in raw.get("issues") or []:
        code = str(item.get("code") or "UNKNOWN")
        mapped = _RUST_CODE_MAP.get(code, code)
        issues.append(
            ValidationIssue(
                block_id=str(item.get("blockId") or ""),
                block_type=str(item.get("blockType") or "document"),
                type=str(item.get("type") or "warning"),
                code=mapped,
                message=str(item.get("message") or ""),
            )
        )

    # Preserve Python compatibility warning for policy requires: gate.
    has_gate_block = any(block.type == "gate" for block in doc.blocks)
    has_policy_gate_issue = any(i.code == "POLICY_GATE_REQUIRED" for i in issues)
    if not has_policy_gate_issue and not has_gate_block:
        for block in doc.blocks:
            if block.type == "policy" and block.properties.get("requires") == "gate":
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="error",
                        code="POLICY_GATE_REQUIRED",
                        message=f'Policy "{block.content}" requires a gate but no gate: block is present.',
                    )
                )

    # Preserve Python compatibility checks for missing workflow step references.
    step_ids = {
        (str(block.properties.get("id")).strip() if str(block.properties.get("id")).strip() else block.id)
        for block in doc.blocks
        if block.type in {"step", "decision", "parallel", "gate", "call", "result", "handoff", "wait", "retry"}
    }

    def _has_step_ref_issue(block_id: str, message: str) -> bool:
        return any(
            i.code == "STEP_REF_MISSING"
            and i.block_id == block_id
            and i.message == message
            for i in issues
        )

    for block in doc.blocks:
        depends = block.properties.get("depends")
        if isinstance(depends, str) and depends and depends not in step_ids:
            msg = f"depends references missing step '{depends}'"
            if not _has_step_ref_issue(block.id, msg):
                issues.append(
                    ValidationIssue(
                        block_id=block.id,
                        block_type=block.type,
                        type="error",
                        code="STEP_REF_MISSING",
                        message=msg,
                    )
                )

        if block.type == "decision":
            for key in ("then", "else"):
                ref = block.properties.get(key)
                if isinstance(ref, str) and ref and ref not in step_ids:
                    msg = f"decision {key} references missing step '{ref}'"
                    if not _has_step_ref_issue(block.id, msg):
                        issues.append(
                            ValidationIssue(
                                block_id=block.id,
                                block_type=block.type,
                                type="error",
                                code="STEP_REF_MISSING",
                                message=msg,
                            )
                        )

        if block.type == "parallel":
            steps = block.properties.get("steps")
            if isinstance(steps, str):
                for ref in [s.strip() for s in steps.split(",") if s.strip()]:
                    if ref not in step_ids:
                        msg = f"parallel steps references missing step '{ref}'"
                        if not _has_step_ref_issue(block.id, msg):
                            issues.append(
                                ValidationIssue(
                                    block_id=block.id,
                                    block_type=block.type,
                                    type="error",
                                    code="STEP_REF_MISSING",
                                    message=msg,
                                )
                            )

    valid = not any(issue.type == "error" for issue in issues)
    return ValidationResult(valid=valid, issues=issues)


def _extract_vars(block) -> Iterable[str]:
    pattern = re.compile(r"\{\{([^}]+)\}\}")
    values = [block.content, block.original_content]
    values.extend(str(v) for v in block.properties.values() if isinstance(v, str))

    for value in values:
        for match in pattern.finditer(value):
            yield match.group(1).strip()
