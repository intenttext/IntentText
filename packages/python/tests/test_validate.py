from __future__ import annotations

from intenttext import parse, validate


def test_validate_catches_missing_depends_reference() -> None:
    doc = parse("step: Start | id: s1\nstep: Next | depends: missing")
    result = validate(doc)
    assert result.valid is False
    assert any(i.code == "STEP_REF_MISSING" for i in result.issues)


def test_validate_catches_decision_branch_missing() -> None:
    doc = parse("step: A | id: a\ndecision: Check | then: missing | else: a")
    result = validate(doc)
    assert any(i.code == "STEP_REF_MISSING" for i in result.issues)


def test_validate_catches_parallel_missing_step() -> None:
    doc = parse("step: A | id: a\nparallel: P | steps: a,missing")
    result = validate(doc)
    assert any(i.code == "STEP_REF_MISSING" for i in result.issues)


def test_validate_requires_gate_approver() -> None:
    doc = parse("gate: Approval")
    result = validate(doc)
    assert any(i.code == "GATE_APPROVER_REQUIRED" for i in result.issues)


def test_validate_duplicate_ids() -> None:
    doc = parse("step: One | id: dup\nstep: Two | id: dup")
    result = validate(doc)
    assert any(i.code == "DUPLICATE_ID" for i in result.issues)


def test_validate_warns_unresolved_variable() -> None:
    doc = parse("note: Hello {{missing}}")
    result = validate(doc)
    assert any(i.code == "VARIABLE_UNRESOLVED" for i in result.issues)


def test_validate_accepts_context_declared_variable() -> None:
    doc = parse("context: | userId: u1\nnote: User {{userId}}")
    result = validate(doc)
    assert not any(i.code == "VARIABLE_UNRESOLVED" for i in result.issues)


def test_validate_policy_requires_gate_no_gate_present() -> None:
    doc = parse("policy: Approval required | requires: gate | always: true\nstep: Send | tool: email.send")
    result = validate(doc)
    assert any(i.code == "POLICY_GATE_REQUIRED" for i in result.issues)


def test_validate_policy_requires_gate_with_gate_present() -> None:
    doc = parse("policy: Approval required | requires: gate | always: true\ngate: Manager approval | approver: manager")
    result = validate(doc)
    assert not any(i.code == "POLICY_GATE_REQUIRED" for i in result.issues)


def test_validate_policy_without_requires_gate_no_error() -> None:
    doc = parse("policy: Audit only | action: log | always: true\nstep: Send | tool: email.send")
    result = validate(doc)
    assert not any(i.code == "POLICY_GATE_REQUIRED" for i in result.issues)
