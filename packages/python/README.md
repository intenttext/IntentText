# IntentText Python

[![PyPI](https://img.shields.io/pypi/v/intenttext)](https://pypi.org/project/intenttext/)

Python API for IntentText with Rust-core parsing by default.

The package uses `@intenttext/core` (Rust-backed) for parser parity and keeps Python-native rendering/query/validation helpers for Python workflows and AI stacks.

Engine controls:

- `INTENTTEXT_PY_ENGINE=rust` (default) to use Rust core through Node.
- `INTENTTEXT_PY_ENGINE=py` to force legacy Python parser.
- `INTENTTEXT_PY_FALLBACK=0` to disable automatic fallback to Python parser when Rust core is unavailable.
- `INTENTTEXT_PY_VALIDATE_ENGINE=rust` to use Rust semantic validation through Node (default); set `py` to force Python compatibility mode.
- `INTENTTEXT_PY_QUERY_ENGINE=rust` to use Rust-backed query execution (`py` by default for compatibility with regex property filters).
- `INTENTTEXT_PY_RENDER_ENGINE=rust` to use Rust-backed HTML rendering (`py` by default for compatibility).
- `INTENTTEXT_PY_SOURCE_ENGINE=rust` to use Rust-backed `to_source` conversion (`py` by default for compatibility).
- `INTENTTEXT_PY_TRUST_ENGINE=rust` to use Rust-backed trust helpers (`py` by default for compatibility).

## Install

```bash
pip install intenttext
```

## Quick Start

```python
from intenttext import parse, render_html, merge_data, validate, query

# Parse a document
source = """
title: Sprint Planning
section: Tasks
task: Write tests | owner: Ahmed | due: Friday
task: Deploy to staging | owner: Sarah | due: Monday
gate: Final approval | approver: Lead | timeout: 24h
""".strip()

doc = parse(source)

# Query for tasks
tasks = query(doc, type="task")
for task in tasks:
    print(f"{task.content} -> {task.properties.get('owner', 'unassigned')}")

# Validate workflow semantics
result = validate(doc)
if not result.valid:
    for issue in result.issues:
        print(f"[{issue.type.upper()}] {issue.message}")

# Render to HTML
html = render_html(doc)
```

## API

- `parse(source: str) -> IntentDocument`
- `parse_safe(source: str, ...) -> ParseResult`
- `render_html(doc: IntentDocument, include_css: bool = True) -> str`
- `render_print(doc: IntentDocument) -> str`
- `render_markdown(doc: IntentDocument) -> str`
- `merge_data(template: IntentDocument, data: dict) -> IntentDocument`
- `parse_and_merge(template_source: str, data: dict) -> IntentDocument`
- `validate(doc: IntentDocument) -> ValidationResult`
- `query(doc: IntentDocument, ...) -> list[IntentBlock]`
- `to_source(doc: IntentDocument) -> str`

## Development

```bash
pip install -e .[dev]
pytest
```

## Release (PyPI)

```bash
# 1) Ensure tests pass
python3 -m pytest -q

# 2) Build source + wheel
python3 -m pip install -U hatch twine
hatch build

# 3) Validate package metadata and long description
twine check dist/*

# 4) Upload (interactive)
twine upload dist/*
```

Tag-based release flow:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Action publish workflow uses `PYPI_API_TOKEN` for automated release on `v*` tags.

## License

MIT
