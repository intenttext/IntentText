---
sidebar_position: 1
title: Ecosystem
---

# IntentText Ecosystem

IntentText is more than a file format. It's a complete toolchain for structured documents.

## Core

| Tool                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| [Core Library](./core-api) | The npm package — parse, render, query, merge, trust |
| `@dotit/pdf`          | Server-side PDFs — issue (merge → seal) → real PDF bytes; opt-in companion |
| [CLI](./cli)               | Command-line tool for every operation                |

## Authoring

| Tool                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| [VS Code Extension](./vscode-extension) | Syntax highlighting, snippets, hover docs, trust commands |
| [Web Editor](./editor)                  | Word-like WYSIWYG pages, template mode, trust UI, print/PDF |

## Distribution

| Tool               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| [Hub](./hub)       | Template marketplace with 76 curated templates and 8 themes                            |
| [Themes](./themes) | 8 built-in themes — corporate, minimal, warm, technical, print, legal, editorial, dark |

## Integration

| Tool                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| [MCP Server](./mcp-server) | Model Context Protocol server for AI agents      |
| [Python Package](./python) | Thin Python client over the core CLI (experimental) |
| [ERP / App Integration](./erp-integration) | Use IntentText as a print/report engine in your app — template + data → HTML/PDF |
