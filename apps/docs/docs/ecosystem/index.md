---
sidebar_position: 1
title: Ecosystem
---

# IntentText Ecosystem

IntentText is more than a file format. It's a complete toolchain for structured documents.

> **New (2026-06):** `.it` now closes the PDF/Word gap — **forms** (fillable, signable,
> with conditional/computed fields + attachments + two-party trust), **redline & version
> compare**, **redaction**, **PAdES** legal PDF signatures, **PDF/A** archival, and
> **math**. Everything is in the packages below; the full developer guide is
> **[ERP integration](/docs/ecosystem/erp-integration)**.

## Core

| Tool                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| [Core Library](./core-api) | `@dotit/core` **1.21** — parse, render, query, merge, trust (versioned seal `spec: 3`), forms, redline/compare, redaction, attachments, math markers, convert |
| `@dotit/pdf` **1.1**       | Server-side PDFs — merge → seal → PDF; **PDF/A** archival; PAdES-signed PDF; opt-in |
| `@dotit/pades` **1.0**     | **PAdES** (Adobe/court-recognized) PDF signatures — X.509/ECDSA + CMS; CSR/CA issuance |
| `@dotit/sign` **1.4**      | Ed25519 signatures + UTS certification chain |
| `@dotit/math` **0.1**      | Math rendering — dependency-free lite MathML + optional KaTeX |
| [CLI](./cli)               | Command-line tool for every operation                |

## Authoring

| Tool                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| [VS Code Extension](./vscode-extension) | Syntax highlighting, snippets, hover docs, trust commands |
| [Editor](./editor)                      | `@dotit/editor` **1.15** — Word-like WYSIWYG **and** an embeddable React component: one `<IntentTextWorkbench>` with every mode (edit / fill / review / view), New ▸ Document/Form/Template, form builder, per-signer trust banner, version history, attachment fill, version-compare, print/PDF |

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
