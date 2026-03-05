# IntentText Python — Implementation Prompt
# Repo: github.com/intenttext/intenttext-python (new repo)
# Package: intenttext on PyPI
# Independent implementation — does NOT wrap the TypeScript package

---

## MISSION

Build a Python implementation of the IntentText parser and renderer.
This opens the entire Python AI ecosystem — LangChain, LlamaIndex, CrewAI,
AutoGen, and raw OpenAI/Anthropic SDK users — to the IntentText format.

The Python package is a clean reimplementation, not a wrapper around Node.js.
It should feel native to Python developers: dataclasses, type hints, Pythonic
naming, pip install.

Target parity with `@intenttext/core` v2.2.0 for the core operations.
Advanced operations (diffDocuments, extractWorkflow) are v1.1 scope.

---

## REPO STRUCTURE

```
intenttext-python/
├── intenttext/
│   ├── __init__.py           Public API
│   ├── parser.py             Core parser
│   ├── renderer.py           HTML and print renderer
│   ├── merge.py              Template + data merge
│   ├── validate.py           Semantic validation
│   ├── query.py              Document querying
│   ├── source.py             Document → .it source
│   └── types.py              Dataclasses and type definitions
├── tests/
│   ├── test_parser.py
│   ├── test_renderer.py
│   ├── test_merge.py
│   ├── test_validate.py
│   └── test_query.py
├── examples/
│   └── basic.py
├── pyproject.toml
├── README.md
└── .github/
    └── workflows/
        ├── test.yml
        └── publish.yml
```

---

## PART 1 — TYPE DEFINITIONS

File: `intenttext/types.py`

```python
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any, Optional, Union


@dataclass
class InlineSegment:
    type: str  # 'text' | 'bold' | 'italic' | 'code' | 'link' | 'strikethrough'
               # | 'highlight' | 'footnote-ref' | 'mention' | 'tag'
    value: str
    href: Optional[str] = None   # for 'link' type only


@dataclass
class IntentBlock:
    id: str
    type: str
    content: str
    original_content: str
    inline: list[InlineSegment] = field(default_factory=list)
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentMetadata:
    title: Optional[str] = None
    summary: Optional[str] = None
    agent: Optional[str] = None
    model: Optional[str] = None
    language: str = 'ltr'
    context: dict[str, str] = field(default_factory=dict)


@dataclass
class IntentDocument:
    version: str
    blocks: list[IntentBlock]
    metadata: IntentMetadata = field(default_factory=IntentMetadata)


@dataclass
class ParseWarning:
    line: int
    message: str
    code: str
    original: str


@dataclass
class ParseResult:
    document: IntentDocument
    warnings: list[ParseWarning] = field(default_factory=list)
    errors: list[ParseWarning] = field(default_factory=list)


@dataclass
class ValidationIssue:
    block_id: str
    block_type: str
    type: str   # 'error' | 'warning' | 'info'
    code: str
    message: str


@dataclass
class ValidationResult:
    valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)
```

---

## PART 2 — PARSER

File: `intenttext/parser.py`

### Keywords

Define all valid keywords as a set:

```python
DOCUMENT_HEADER_KEYWORDS = {
    'agent', 'context', 'font', 'page',
}

STRUCTURE_KEYWORDS = {
    'title', 'summary', 'section', 'sub', 'note',
    'toc', 'break',
}

CONTENT_KEYWORDS = {
    'task', 'done', 'ask', 'quote', 'info', 'warning',
    'tip', 'success', 'link', 'image', 'code', 'ref',
}

WRITER_KEYWORDS = {
    'byline', 'epigraph', 'caption', 'footnote',
    'dedication',
}

AGENTIC_KEYWORDS = {
    'step', 'decision', 'parallel', 'loop', 'call',
    'gate', 'wait', 'retry', 'error', 'trigger',
    'checkpoint', 'handoff', 'audit', 'emit', 'result',
    'progress', 'import', 'export',
}

ALL_KEYWORDS = (
    DOCUMENT_HEADER_KEYWORDS | STRUCTURE_KEYWORDS |
    CONTENT_KEYWORDS | WRITER_KEYWORDS | AGENTIC_KEYWORDS
)
```

### Core parsing functions

```python
import re
import uuid
from typing import Optional
from .types import IntentDocument, IntentBlock, IntentMetadata, ParseResult, ParseWarning


def parse(source: str) -> IntentDocument:
    """
    Parse an IntentText source string into an IntentDocument.
    Raises ValueError on critical parse errors.
    Simple API — use parse_safe() for production use.
    """
    result = parse_safe(source)
    if result.errors:
        raise ValueError(f"Parse errors: {result.errors[0].message}")
    return result.document


def parse_safe(
    source: str,
    unknown_keyword: str = 'note',  # 'note' | 'skip' | 'throw'
    max_blocks: int = 10000,
    max_line_length: int = 50000,
) -> ParseResult:
    """
    Parse an IntentText source string, never raising exceptions.
    Returns a ParseResult with the document and any warnings/errors.
    """
    warnings: list[ParseWarning] = []
    errors: list[ParseWarning] = []
    blocks: list[IntentBlock] = []
    metadata = IntentMetadata()
    in_code_block = False
    code_lines: list[str] = []
    code_block_id = ''
    lines = source.splitlines()

    for line_num, raw_line in enumerate(lines, 1):
        # Enforce max line length
        if len(raw_line) > max_line_length:
            raw_line = raw_line[:max_line_length]
            warnings.append(ParseWarning(
                line=line_num,
                message=f'Line truncated at {max_line_length} characters',
                code='LINE_TRUNCATED',
                original=raw_line[:100] + '...',
            ))

        line = raw_line.strip()

        # Code block handling
        if line.startswith('```'):
            if in_code_block:
                # Close code block
                block = IntentBlock(
                    id=_generate_id(),
                    type='code',
                    content='\n'.join(code_lines),
                    original_content='\n'.join(code_lines),
                )
                blocks.append(block)
                in_code_block = False
                code_lines = []
            else:
                in_code_block = True
                code_block_id = _generate_id()
            continue

        if in_code_block:
            code_lines.append(raw_line)
            continue

        # Skip empty lines and comments
        if not line:
            continue
        if line.startswith('//'):
            block = IntentBlock(
                id=_generate_id(),
                type='comment',
                content=line[2:].strip(),
                original_content=line,
            )
            blocks.append(block)
            continue

        # Horizontal divider
        if line == '---':
            blocks.append(IntentBlock(
                id=_generate_id(), type='divider',
                content='', original_content='---',
            ))
            continue

        # Pipe table row
        if line.startswith('|') and line.endswith('|'):
            # Accumulate into table block or append to last table
            cells = [c.strip() for c in line[1:-1].split('|')]
            # Skip separator rows like | --- | --- |
            if all(re.match(r'^[-:]+$', c.strip()) for c in cells if c.strip()):
                continue
            # Check if last block is a table
            if blocks and blocks[-1].type == 'table':
                rows = blocks[-1].properties.get('rows', [])
                rows.append(cells)
                blocks[-1].properties['rows'] = rows
            else:
                blocks.append(IntentBlock(
                    id=_generate_id(),
                    type='table',
                    content='',
                    original_content=line,
                    properties={'rows': [cells]},
                ))
            continue

        # Check max blocks
        if len(blocks) >= max_blocks:
            warnings.append(ParseWarning(
                line=line_num,
                message=f'Max blocks ({max_blocks}) reached, stopping parse',
                code='MAX_BLOCKS_REACHED',
                original=line,
            ))
            break

        # Keyword block parsing
        block = _parse_keyword_line(line, line_num, unknown_keyword, warnings, errors)
        if block:
            blocks.append(block)
            # Extract metadata from header blocks
            _update_metadata(metadata, block)

    # Build document
    doc = IntentDocument(
        version='2.0',
        blocks=[b for b in blocks if b.type != 'comment'],
        metadata=metadata,
    )

    return ParseResult(document=doc, warnings=warnings, errors=errors)


def _parse_keyword_line(
    line: str,
    line_num: int,
    unknown_keyword: str,
    warnings: list,
    errors: list,
) -> Optional[IntentBlock]:
    """Parse a single keyword line into an IntentBlock."""
    # Match keyword: content | prop: val | prop: val
    match = re.match(r'^(\w+):\s*(.*)', line)
    if not match:
        return None

    keyword = match.group(1).lower()
    rest = match.group(2)

    if keyword not in ALL_KEYWORDS:
        if unknown_keyword == 'skip':
            warnings.append(ParseWarning(
                line=line_num,
                message=f"Unknown keyword '{keyword}' skipped",
                code='UNKNOWN_KEYWORD',
                original=line,
            ))
            return None
        elif unknown_keyword == 'throw':
            errors.append(ParseWarning(
                line=line_num,
                message=f"Unknown keyword '{keyword}'",
                code='UNKNOWN_KEYWORD',
                original=line,
            ))
            return None
        else:  # 'note'
            warnings.append(ParseWarning(
                line=line_num,
                message=f"Unknown keyword '{keyword}' treated as note:",
                code='UNKNOWN_KEYWORD',
                original=line,
            ))
            keyword = 'note'

    # Split content from pipe properties
    content, properties = _parse_content_and_properties(rest)

    # Normalise done: → task with status=done
    if keyword == 'done':
        keyword = 'task'
        properties['status'] = 'done'

    block_id = properties.pop('id', _generate_id())

    return IntentBlock(
        id=block_id,
        type=keyword,
        content=_strip_inline(content),
        original_content=content,
        inline=_parse_inline(content),
        properties=properties,
    )


def _parse_content_and_properties(rest: str) -> tuple[str, dict]:
    """Split 'content | key: val | key: val' into (content, {key: val})."""
    parts = rest.split(' | ')
    content = parts[0].strip()
    properties: dict = {}
    for part in parts[1:]:
        kv_match = re.match(r'^(\w[\w-]*):\s*(.*)', part.strip())
        if kv_match:
            key = kv_match.group(1)
            value: Any = kv_match.group(2).strip()
            # Type coercion for known numeric properties
            if key in ('max', 'delay', 'leading', 'depth', 'columns'):
                try:
                    value = int(value) if '.' not in value else float(value)
                except ValueError:
                    pass
            elif value.lower() in ('true', 'false'):
                value = value.lower() == 'true'
            properties[key] = value
    return content, properties


def _parse_inline(text: str) -> list:
    """Parse inline formatting from content string."""
    from .types import InlineSegment
    segments = []
    # Simple inline parser — handles *bold*, _italic_, ~strike~, `code`, [label](url)
    pattern = re.compile(
        r'\*([^*]+)\*'          # bold
        r'|_([^_]+)_'           # italic
        r'|~([^~]+)~'           # strikethrough
        r'|\^([^^]+)\^'         # highlight
        r'|`([^`]+)`'           # code
        r'|\[([^\]]+)\]\(([^)]+)\)'  # link
        r'|\[\^(\d+)\]'         # footnote ref
        r'|@(\w+)'              # mention
        r'|#(\w+)'              # tag
    )
    last_end = 0
    for m in pattern.finditer(text):
        if m.start() > last_end:
            segments.append(InlineSegment(type='text', value=text[last_end:m.start()]))
        if m.group(1):
            segments.append(InlineSegment(type='bold', value=m.group(1)))
        elif m.group(2):
            segments.append(InlineSegment(type='italic', value=m.group(2)))
        elif m.group(3):
            segments.append(InlineSegment(type='strikethrough', value=m.group(3)))
        elif m.group(4):
            segments.append(InlineSegment(type='highlight', value=m.group(4)))
        elif m.group(5):
            segments.append(InlineSegment(type='code', value=m.group(5)))
        elif m.group(6):
            segments.append(InlineSegment(type='link', value=m.group(6), href=m.group(7)))
        elif m.group(8):
            segments.append(InlineSegment(type='footnote-ref', value=m.group(8)))
        elif m.group(9):
            segments.append(InlineSegment(type='mention', value=m.group(9)))
        elif m.group(10):
            segments.append(InlineSegment(type='tag', value=m.group(10)))
        last_end = m.end()
    if last_end < len(text):
        segments.append(InlineSegment(type='text', value=text[last_end:]))
    return segments


def _strip_inline(text: str) -> str:
    """Remove inline formatting markers from text."""
    text = re.sub(r'\*([^*]+)\*', r'\1', text)
    text = re.sub(r'_([^_]+)_', r'\1', text)
    text = re.sub(r'~([^~]+)~', r'\1', text)
    text = re.sub(r'\^([^^]+)\^', r'\1', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    text = re.sub(r'\[\^(\d+)\]', r'[\1]', text)
    return text


def _generate_id() -> str:
    return str(uuid.uuid4())[:8]


def _update_metadata(metadata: IntentMetadata, block: IntentBlock) -> None:
    if block.type == 'title':
        metadata.title = block.content
    elif block.type == 'summary':
        metadata.summary = block.content
    elif block.type == 'agent':
        metadata.agent = block.content
        if 'model' in block.properties:
            metadata.model = block.properties['model']
    elif block.type == 'context':
        metadata.context.update({
            k: str(v) for k, v in block.properties.items()
        })
```

---

## PART 3 — PUBLIC API

File: `intenttext/__init__.py`

```python
from .parser import parse, parse_safe
from .renderer import render_html, render_print, render_markdown
from .merge import merge_data, parse_and_merge
from .validate import validate
from .query import query
from .source import to_source
from .types import (
    IntentDocument, IntentBlock, IntentMetadata,
    InlineSegment, ParseResult, ParseWarning,
    ValidationResult, ValidationIssue,
)

__version__ = "1.0.0"
__all__ = [
    "parse", "parse_safe",
    "render_html", "render_print", "render_markdown",
    "merge_data", "parse_and_merge",
    "validate",
    "query",
    "to_source",
    "IntentDocument", "IntentBlock", "IntentMetadata",
    "InlineSegment", "ParseResult", "ParseWarning",
    "ValidationResult", "ValidationIssue",
]
```

---

## PART 4 — RENDERER

File: `intenttext/renderer.py`

Implement `render_html(doc, include_css=True) -> str`
and `render_print(doc) -> str`.

Port the HTML renderer from the TypeScript source.
Same CSS classes (`it-block`, `it-keyword`, `it-callout`, etc.)
Same block type → HTML element mapping.

For `render_markdown(doc) -> str` — a basic Markdown export:
- `title:` → `# Title`
- `section:` → `## Section`
- `sub:` → `### Sub`
- `note:` → paragraph
- `task:` → `- [ ] task text`
- `done:` → `- [x] task text`
- `quote:` → `> text\n> — author`
- `info:` / `warning:` / `tip:` → `> **INFO:** text`
- tables → pipe tables

---

## PART 5 — MERGE ENGINE

File: `intenttext/merge.py`

```python
import re
from datetime import datetime
from copy import deepcopy
from .types import IntentDocument, IntentBlock
from .parser import parse


def merge_data(template: IntentDocument, data: dict) -> IntentDocument:
    """
    Merge a template document with data, resolving {{variable}} references.
    Returns a new document — never mutates the input.
    """
    doc = deepcopy(template)
    system_vars = {
        'timestamp': datetime.now().isoformat(),
        'date': datetime.now().strftime('%d %B %Y'),
        'year': str(datetime.now().year),
    }
    merged_data = {**system_vars, **data}

    for block in doc.blocks:
        block.content = _resolve_string(block.content, merged_data)
        block.original_content = _resolve_string(block.original_content, merged_data)
        block.properties = {
            k: _resolve_string(str(v), merged_data) if isinstance(v, str) else v
            for k, v in block.properties.items()
        }

    return doc


def parse_and_merge(template_source: str, data: dict) -> IntentDocument:
    """Parse a template string and merge with data in one call."""
    template = parse(template_source)
    return merge_data(template, data)


def _resolve_string(text: str, data: dict) -> str:
    def replacer(match):
        path = match.group(1).strip()
        # Leave runtime variables unresolved
        if path in ('page', 'pages'):
            return match.group(0)
        value = _get_by_path(data, path)
        return str(value) if value is not None else match.group(0)
    return re.sub(r'\{\{([^}]+)\}\}', replacer, text)


def _get_by_path(obj, path: str):
    """Resolve dot-notation path: 'client.name', 'items.0.price'"""
    parts = path.split('.')
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
```

---

## PART 6 — pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "intenttext"
version = "1.0.0"
description = "IntentText — the semantic document format that is natively JSON"
readme = "README.md"
license = { text = "MIT" }
requires-python = ">=3.10"
dependencies = []

[project.urls]
Homepage = "https://github.com/intenttext/IntentText"
Repository = "https://github.com/intenttext/intenttext-python"
Documentation = "https://github.com/intenttext/IntentText/blob/main/docs/SPEC.md"

[project.optional-dependencies]
dev = ["pytest", "pytest-cov"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

---

## PART 7 — TESTS

Port the key tests from the TypeScript test suite.
Minimum 40 tests covering:

- `parse()` returns document with correct block types
- `parse()` handles all 36 keywords
- `parse_safe()` never raises on garbage input
- `parse_safe()` returns warnings for unknown keywords
- Tables parse to correct rows
- `merge_data()` resolves simple `{{key}}`
- `merge_data()` resolves nested `{{client.name}}`
- `merge_data()` leaves `{{page}}` unresolved
- `render_html()` returns string containing block content
- `render_markdown()` converts task: to `- [ ]`
- `validate()` catches broken step references
- `query()` filters by type
- `to_source()` round-trips correctly

---

## PART 8 — CI/CD

File: `.github/workflows/publish.yml`

```yaml
name: Publish to PyPI

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install hatch
      - run: hatch build
      - run: pip install pytest && pytest
      - uses: pypa/gh-action-pypi-publish@release/v1
        with:
          password: ${{ secrets.PYPI_API_TOKEN }}
```

---

## USAGE EXAMPLES (for README)

```python
from intenttext import parse, render_html, merge_data, validate, query

# Parse a document
doc = parse("""
title: Sprint Planning
section: Tasks
task: Write tests | owner: Ahmed | due: Friday
task: Deploy to staging | owner: Sarah | due: Monday
gate: Final approval | approver: Lead | timeout: 24h
""")

# Query for tasks
tasks = query(doc, type='task')
for task in tasks:
    print(f"{task.content} → {task.properties.get('owner', 'unassigned')}")

# Validate a workflow
result = validate(doc)
if not result.valid:
    for issue in result.issues:
        print(f"[{issue.type.upper()}] {issue.message}")

# Render to HTML
html = render_html(doc)

# Template merge
from intenttext import parse_and_merge
doc = parse_and_merge(template_source, {
    "client": {"name": "Acme Corp", "address": "Doha, Qatar"},
    "invoice": {"number": "2026-042", "total": "QAR 15,000"}
})
```

### Use with LangChain

```python
from intenttext import parse, validate, to_source
from langchain_anthropic import ChatAnthropic

llm = ChatAnthropic(model="claude-sonnet-4-20250514")

# Ask the LLM to generate a workflow as IntentText
response = llm.invoke(
    "Generate an IntentText workflow for user onboarding. "
    "Use step:, gate:, and result: blocks. Return only the .it source."
)

doc = parse(response.content)
result = validate(doc)

if result.valid:
    print("Valid workflow generated")
    print(to_source(doc))
else:
    print("Issues found:", result.issues)
```

---

*IntentText Python — Implementation Prompt v1.0 — March 2026*
