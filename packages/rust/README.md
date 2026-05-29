# intenttext-rs

> **Status: Preserved — not used in production.**
> The TS parser in `packages/core` is the active implementation. This Rust crate is kept here for future performance work. It is not built by default (`pnpm build` skips it).

Rust implementation of the [IntentText](https://intenttext.dev) document language — parser, renderer, query engine, trust system, and workflow executor.

**Parity target:** `@intenttext/core` v2.14.2 — v2.14 keyword freeze (37 canonical keywords).

## Features

| Feature    | Default | Description                                          |
| ---------- | ------- | ---------------------------------------------------- |
| `renderer` | ✅      | HTML rendering                                       |
| `query`    | ✅      | Block query engine                                   |
| `validate` | ✅      | Semantic validation (62 error codes)                 |
| `trust`    | —       | sign/freeze/verify/amend (SHA-256)                   |
| `executor` | —       | Workflow execution engine                            |
| `wasm`     | —       | WASM bindings (replaces @intenttext/core in browser) |
| `python`   | —       | Python bindings via PyO3                             |

## Quick start

```rust
use intenttext::{parse, render, validate};

let doc = parse(r#"
title: Service Agreement
meta: | author: Acme Corp | date: 2026-03-09

section: Terms
text: This agreement governs the use of services.

policy: Approvals required | requires: gate | gate: manager-approval
gate: Manager approval | id: manager-approval | approver: ops-manager
step: Deploy to production | depends: manager-approval | tool: deploy
"#, None);

let html = render(&doc, None);
let issues = validate(&doc);
```

## CLI

A native Rust CLI is available as `intenttext-cli`.

```bash
cargo run --bin intenttext-cli -- examples/sample.it
cargo run --bin intenttext-cli -- examples/sample.it --html
cargo run --bin intenttext-cli -- examples/sample.it --output
cargo run --bin intenttext-cli -- examples/sample.md --to-it
cargo run --bin intenttext-cli -- validate examples/sample.it
cargo run --bin intenttext-cli -- validate examples/sample.it --json
cargo run --bin intenttext-cli -- query examples/sample.it "type=task limit:5"
cargo run --bin intenttext-cli -- query examples/sample.it "type=task limit:5" --json
cargo run --bin intenttext-cli -- index examples
cargo run --bin intenttext-cli -- index examples --recursive
cargo run --bin intenttext-cli -- ask examples "what are top tasks"
cargo run --bin intenttext-cli -- ask examples "what are top tasks" --format json
cargo run --bin intenttext-cli -- seal examples/sample.it --signer Emad --role Owner
cargo run --bin intenttext-cli -- verify examples/sample.it
cargo run --bin intenttext-cli -- history examples/sample.it --json
cargo run --bin intenttext-cli -- amend examples/sample.it --section Scope --now "Updated terms" --ref "Amendment #1" --by Emad
```

## The 37 canonical keywords

| Category          | Keywords                                                     |
| ----------------- | ------------------------------------------------------------ |
| Document Identity | `title` `summary` `meta` `context`                           |
| Structure         | `section` `sub` `toc`                                        |
| Content           | `text` `info` `quote` `cite` `code` `image` `link`           |
| Tasks             | `task` `done` `ask`                                          |
| Data              | `columns` `row` `metric`                                     |
| Agentic Workflow  | `step` `decision` `gate` `trigger` `result` `policy` `audit` |
| Trust             | `track` `approve` `sign` `freeze` `amendment`                |
| Layout            | `page` `header` `footer` `watermark` `break`                 |

Extension keywords use the `x-ns: type` prefix (e.g. `x-agent: loop`, `x-doc: def`).

## Parity status

All 37 canonical keywords, all aliases, and all 62 diagnostic codes are implemented.
Behavioral parity is verified against the TypeScript test suite.

## License

MIT
