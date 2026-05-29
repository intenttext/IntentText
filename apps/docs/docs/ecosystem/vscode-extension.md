---
sidebar_position: 7
title: VS Code Extension
---

# VS Code Extension

Full IntentText support inside VS Code: syntax highlighting, hover documentation, completions, snippets, diagnostics, and trust commands.

## Installation

Search "IntentText" in the VS Code Extensions panel, or:

```bash
code --install-extension intenttext.intenttext
```

## Features

### Syntax highlighting

IntentText keywords, aliases, and template markers are highlighted with semantic coloring:

| Category          | Color  | Keywords                                                                               |
| ----------------- | ------ | -------------------------------------------------------------------------------------- |
| Document identity | Blue   | title, summary, meta, context, track                                                   |
| Content           | Green  | note, quote, warning, tip, code, image, link, cite, def, figure, contact               |
| Structure         | Purple | section, sub, break, group, ref, deadline                                              |
| Data              | Orange | input, output, table, metric                                                           |
| Agent             | Red    | step, gate, trigger, emit, decision, context, memory, prompt, tool, audit, done, error |
| Trust             | Gold   | approve, sign, freeze, revision, policy, amendment                                     |
| Layout            | Teal   | page, font, header, footer, watermark, signline                                        |

Aliases get the same highlighting as their canonical keyword. Template variables (`{{name}}`) are highlighted distinctly.

### Hover documentation

Hover over any keyword to see:

- Description and category
- Available pipe properties
- Example usage
- Link to full documentation

### Completions

Type any keyword and get intelligent completions:

- Keyword names with descriptions
- Pipe properties after `|`
- Template variable names inside `{{}}`
- Theme names after `--theme`
- Alias suggestions (with canonical keyword shown)

### Snippets

Type a keyword prefix and press Tab:

| Prefix         | Expands to                   |
| -------------- | ---------------------------- |
| `it-doc`       | Full document skeleton       |
| `it-section`   | Section with content         |
| `it-table`     | Table with headers and rows  |
| `it-step`      | Step with details            |
| `it-gate`      | Gate with condition          |
| `it-approve`   | Approval block               |
| `it-seal`      | Sign/seal block              |
| `it-template`  | Template with variables      |
| `it-metric`    | Metric with value and target |
| `it-contact`   | Contact with details         |
| `it-deadline`  | Deadline with date           |
| `it-amendment` | Amendment block              |

### Diagnostics

Real-time error detection:

- Unknown keywords flagged
- Missing required properties
- Invalid pipe property combinations
- Duplicate section names
- Trust chain warnings (e.g., modifying content after seal)

### Commands

Access via Command Palette (`Cmd+Shift+P`):

| Command                       | Description                         |
| ----------------------------- | ----------------------------------- |
| `IntentText: Seal Document`   | Seal the current file               |
| `IntentText: Verify Document` | Check integrity                     |
| `IntentText: Amend Document`  | Create amendment to frozen document |
| `IntentText: View History`    | Show trust history                  |
| `IntentText: Preview`         | Render and preview in side panel    |
| `IntentText: Change Theme`    | Switch preview theme                |
| `IntentText: Pull Template`   | Download template from Hub          |

### Preview panel

Live-rendered preview in a side panel:

- Updates on save
- Theme picker in the toolbar
- Trust status badge (sealed/verified/amended)
- Print preview mode

## Configuration

```json
{
  "intenttext.defaultTheme": "corporate",
  "intenttext.preview.autoOpen": true,
  "intenttext.diagnostics.enabled": true,
  "intenttext.hub.autoSuggestTemplates": true
}
```

## Source

Repository: [intenttext-vscode](https://github.com/intenttext/intenttext-vscode)
