# IntentText Validate

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-IntentText%20Validate-blue?logo=github)](https://github.com/marketplace/actions/intenttext-validate)

GitHub Action to validate [IntentText](https://github.com/intenttext/IntentText) (`.it`) workflow and document files in CI.

**What is IntentText?** A human-readable structured document format where every line is a typed keyword block (`step:`, `gate:`, `decision:`, `task:`, etc.) with pipe-separated properties. Used for writing agentic workflows, structured documents, and print-ready publications — all in plain text.

## Usage

### Basic — validate all .it files

```yaml
- uses: intenttext/intenttext-action@v1
```

### In a full workflow

```yaml
name: Validate IntentText
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: intenttext/intenttext-action@v1
        with:
          path: "workflows/**/*.it"
          strict: false
          annotate: true
```

### With strict mode (fail on warnings too)

```yaml
- uses: intenttext/intenttext-action@v1
  with:
    strict: true
```

### With document integrity verification

```yaml
- uses: intenttext/intenttext-action@v1
  with:
    verify: true
```

## Inputs

| Input            | Description                                          | Default           |
| ---------------- | ---------------------------------------------------- | ----------------- |
| `path`           | Glob pattern for .it files                           | `**/*.it`         |
| `strict`         | Fail on warnings too                                 | `false`           |
| `ignore`         | Patterns to ignore (comma-separated)                 | `node_modules/**` |
| `annotate`       | Add inline PR annotations                            | `true`            |
| `verify`         | Verify integrity of sealed (frozen/signed) documents | `false`           |
| `verify-pattern` | Glob for files to verify                             | `**/*.it`         |

## Outputs

| Output          | Description               |
| --------------- | ------------------------- |
| `files_checked` | Number of files validated |
| `issues_found`  | Total issues found        |
| `valid`         | `true` if all passed      |

## What gets validated

Checks run on every `.it` file:

- **Syntax** — all keywords are valid, pipe properties are well-formed
- **Step references** — `decision:` then/else, `depends:` and `parallel:` steps exist
- **Required properties** — `gate:` has `approver:`, workflow blocks have expected fields
- **Duplicate IDs** — no two blocks share the same explicit `id:`
- **Variable references** — `{{variables}}` are declared in `context:` or produced by steps
- **Trust integrity** — when `verify: true`, checks that frozen/signed documents haven't been tampered with

See the [IntentText documentation](https://itdocs.vercel.app) for the full spec.

## Links

- [IntentText Docs](https://itdocs.vercel.app)
- [IntentText Core](https://www.npmjs.com/package/@intenttext/core)
- [IntentText MCP Server](https://www.npmjs.com/package/@intenttext/mcp-server)
- [IntentText Python](https://pypi.org/project/intenttext/)
