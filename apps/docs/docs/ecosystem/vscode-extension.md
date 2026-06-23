---
sidebar_position: 7
title: VS Code Extension
---

# VS Code Extension

IntentText support inside VS Code: syntax highlighting, hover documentation, completions, snippets, diagnostics, a live preview, and trust commands.

## Installation

Search "IntentText" in the VS Code Extensions panel, or:

```bash
code --install-extension intenttext.intenttext
```

The extension is also published as a `.vsix` in the repo (`packages/vscode`) for
manual install.

## Features

### Syntax highlighting

IntentText keywords and template markers are highlighted with semantic coloring. Only
**reserved** words are colored — the 41 canonical keywords, the 33 Arabic localized keyword
names, and the namespaced extension keywords. The Latin synonym aliases older versions shipped
(`note`, `warning`, `tip`, `columns`, …) have been removed, so they highlight as ordinary
custom keywords — which is exactly what they now are:

| Category          | Color  | Keywords                                                                               |
| ----------------- | ------ | -------------------------------------------------------------------------------------- |
| Document identity | Blue   | title, summary, meta, track                                                            |
| Content           | Green  | text, info, quote, code, image, link, cite, task, done (+ x-doc/x-writer: def, figure, contact) |
| Structure         | Purple | section, sub, break, toc (+ x-doc: ref, deadline)                                       |
| Data              | Orange | headers, row, metric (+ x-form: input, output)                                         |
| Agent             | Red    | context, ask, step, decision, gate, trigger, result, policy, audit (+ x-agent: memory, prompt, tool, error) |
| Trust             | Gold   | approve, sign, freeze, amendment, certify, route, require (+ audit log: revision)       |
| Layout            | Teal   | page, header, footer, watermark, style (+ x-layout/x-doc: font, signline)               |

Callout variants (`info: … | type: warning`) are driven by the `type:` property, not a separate
keyword. Arabic localized keyword names get the same color as their canonical keyword. Template
variables (`{{name}}`) are highlighted distinctly.

### Hover documentation

Hover over any keyword to see:

- Description and category
- Available pipe properties
- Example usage
- Link to full documentation

### Completions

Type at the start of a line and get keyword completions; type after a `|` and get
the pipe properties for that block type:

- Keyword names (with descriptions) — canonical, Arabic localized, and extension keywords
- Arabic localized keyword names (the canonical keyword is shown alongside)
- Pipe properties after `|`

### Snippets

Type a prefix and press Tab. The bundled snippets cover the common blocks, for example:

| Prefix      | Expands to                   |
| ----------- | ---------------------------- |
| `doc`       | Full document skeleton       |
| `section`   | Section with content         |
| `task`      | Task block                   |
| `step`      | Workflow step                |
| `gate`      | Gate with condition          |
| `approve`   | Approval block               |
| `sign`      | Signature block              |
| `metric`    | Metric with value and target |
| `contact`   | Contact with details         |
| `deadline`  | Deadline with date           |
| `amendment` | Amendment block              |

(Run `Insert Snippet` to see the full list — there are snippets for most keywords,
including `workflow`, `headers`, `input`/`output`, `route`/`require`, `certify`, `track`,
`freeze`, `revision`, `header`/`footer`/`watermark`, and `style`.)

### Diagnostics

Inline diagnostics surface the core validator's findings as you type — semantic issues
(broken references, unresolved variables, structural problems) and the parser's own
diagnostics, each marked as an error or warning.

### Commands

Access via Command Palette (`Cmd+Shift+P`):

| Command                              | Description                          |
| ------------------------------------ | ------------------------------------ |
| `IntentText: Open Preview`           | Render and preview the current file  |
| `IntentText: Open Preview to the Side` | Open the preview in a side panel   |
| `IntentText: Seal Document`          | Seal the current file                |
| `IntentText: Verify Document`        | Check integrity                      |
| `IntentText: Show Document History`  | Show the document's trust history    |

### Preview panel

A live-rendered HTML preview (`Open Preview` / `Open Preview to the Side`) that
re-renders as you edit the document.

## Source

Repository: [intenttext-vscode](https://github.com/intenttext/intenttext-vscode)
