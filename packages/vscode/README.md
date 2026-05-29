# IntentText for VS Code

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/intenttext.intenttext?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=intenttext.intenttext)

**Syntax highlighting, live preview, validation, and auto-completion for [IntentText](https://github.com/intenttext/IntentText) (`.it`) documents.**

## Features

### Syntax Highlighting

Full TextMate grammar covering the canonical keyword set plus aliases and extension keywords — structure, content, agentic workflow, document-generation, and metadata blocks. Inline formatting (`**bold**`, `*italic*`, `` `code` ``, `==highlight==`), template variables (`{{var}}`), and comments (`//`) are all highlighted.

### Live Preview

Open a side-by-side HTML preview of any `.it` file:

- **Command:** `IntentText: Preview Document`
- **Keybinding:** `Cmd+Shift+V` (macOS) / `Ctrl+Shift+V`

The preview updates automatically as you edit.

### Inline Validation

Real-time diagnostics powered by `@intenttext/core`:

- Red squiggles for errors (broken step references, invalid properties)
- Yellow squiggles for warnings
- Runs on every change with 500 ms debounce

### Hover Documentation

Hover over any keyword (`step:`, `gate:`, `decision:`, `task:`, …) to see:

- What the keyword does
- Available pipe-separated properties
- Link to the full IntentText spec

### Auto-Completion

- **Keywords** — type at the start of a line to get suggestions for all IntentText keywords
- **Properties** — type `|` on a keyword line to get property completions for that block type

### Snippets

13 built-in snippets for common patterns:

| Prefix     | Description                  |
| ---------- | ---------------------------- |
| `doc`      | Full document skeleton       |
| `section`  | Section heading              |
| `task`     | Task with owner and due date |
| `step`     | Workflow step                |
| `decision` | If/then/else branch          |
| `gate`     | Human approval gate          |
| `note`     | Note callout                 |
| `warning`  | Warning callout              |
| `code`     | Code block with language     |
| `parallel` | Parallel execution block     |
| `workflow` | Full workflow template       |
| `var`      | Template variable            |
| `print`    | Print layout settings        |

## Requirements

- VS Code 1.85.0 or later

## Extension Settings

This extension does not add custom settings. It activates automatically for `.it` files (language ID: `intenttext`).

## Links

- [IntentText Docs](https://itdocs.vercel.app/docs/reference)
- [IntentText Core](https://www.npmjs.com/package/@intenttext/core)
- [IntentText MCP Server](https://www.npmjs.com/package/@intenttext/mcp-server)
