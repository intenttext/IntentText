---
sidebar_position: 1
title: Ecosystem
---

# IntentText Ecosystem

IntentText is more than a file format. It's a complete toolchain for structured documents.

## Core

| Tool                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| [Core Library](./core-api) | `@dotit/core` 1.5 — parse, render, query, merge, trust, convert |
| `@dotit/pdf`          | Server-side PDFs — issue (merge → seal) → real PDF bytes; opt-in companion |
| [CLI](./cli)               | Command-line tool for every operation                |

## Authoring

| Tool                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| [VS Code Extension](./vscode-extension) | Syntax highlighting, snippets, hover docs, trust commands |
| [Editor](./editor)                      | Word-like WYSIWYG pages, template mode, trust UI, print/PDF — web app **and** embeddable React component (`@dotit/editor`) |

## Distribution

| Tool               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| [Hub](./hub)       | Template gallery with 76 official templates                                            |
| [Themes](./themes) | 8 built-in themes — corporate, minimal, warm, technical, print, legal, editorial, dark |

## Integration

| Tool                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| [MCP Server](./mcp-server) | `@dotit/mcp` — Model Context Protocol server for AI agents |
| [Python Package](./python) | Thin Python client over the core CLI (experimental) |
| [ERP / App Integration](./erp-integration) | Use IntentText as a print/report engine in your app — template + data → HTML/PDF |
