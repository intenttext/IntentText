---
sidebar_position: 1
title: Ecosystem
---

# IntentText Ecosystem

IntentText is more than a file format. It's a toolchain that does three things, in order:

- **Author** — write `.it` by hand, generate it from a template + data, convert it from
  Markdown / HTML / Word / Excel, or edit it WYSIWYG. One plain-text source, no AST to store.
- **Render** — themed HTML, print-ready paged HTML, or real PDF bytes — the editor, the CLI,
  and the server all call the *same* core, so what you design is exactly what prints.
- **Prove** — seal it (a versioned SHA-256 content hash), sign it (Ed25519), route it for
  approval, and verify it **offline with no backend** — everything needed to check the
  document lives inside the file.

The result is **offline-verifiable, agent-native, and gov-ready**: an agent can drive the
whole lifecycle through the [MCP server](./mcp-server), and the same bytes are accepted by a
court (PAdES) or an archive (PDF/A).

### Which tool for which job

| I want to…                                          | Reach for                                         |
| --------------------------------------------------- | ------------------------------------------------- |
| Parse / render / query / merge / seal in code       | [`@dotit/core`](./core-api)                       |
| Do all of the above from the terminal or CI         | [the `dotit` CLI](./cli)                          |
| Let an AI agent drive the toolchain                 | [`@dotit/mcp`](./mcp-server)                      |
| Edit `.it` visually (web or embedded in your app)   | [`@dotit/editor`](./editor)                       |
| Author `.it` in VS Code                             | [VS Code extension](./vscode-extension)           |
| Generate real PDF bytes on a server (email/archive) | [`@dotit/pdf`](./erp-integration)                 |
| Apply a court-recognized PDF signature              | [`@dotit/pades`](./core-api#court-recognized-pdf-signatures) |
| Add Ed25519 signatures + an authority certify chain | [`@dotit/sign`](./core-api#cryptographic-signatures-and-certification) |
| Use `.it` as the print/report engine inside an ERP  | [ERP / App Integration](./erp-integration)        |

## Core

| Tool                       | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| [Core Library](./core-api) | `@dotit/core` **2.0** — parse, render, query, merge, trust (versioned seal `spec: 4`), forms, approval routing + audit chain, redline/version-compare, redaction, attachments, conformance, e-invoice (UBL), math markers, convert |
| `@dotit/pdf` **2.0**       | Server-side PDFs — merge → seal → PDF; **PDF/A** archival; PAdES-signed PDF; opt-in |
| `@dotit/pades` **1.0**     | **PAdES** (Adobe/court-recognized) PDF signatures — X.509/ECDSA + CMS; CSR/CA issuance |
| `@dotit/sign` **2.0**      | Ed25519 signatures + UTS certification chain |
| `@dotit/math` **0.1**      | Math rendering — dependency-free lite MathML + optional KaTeX |
| [CLI](./cli)               | Command-line tool for every operation                |

## Authoring

| Tool                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| [VS Code Extension](./vscode-extension) | Syntax highlighting, snippets, hover docs, trust commands |
| [Editor](./editor)                      | `@dotit/editor` **2.0** — Word-like WYSIWYG **and** an embeddable React component: `<IntentTextEditor>` plus the `<IntentTextWorkbench>` mode wrapper (edit / fill / review / view / auto), New ▸ Document/Form/Template, form builder, per-signer trust banner, approval-route panel, version history, attachment fill, version-compare, print/PDF |

## Distribution

| Tool               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| [Hub](./hub)       | Template gallery with 76 official templates                                            |
| [Themes](./themes) | 8 built-in themes — corporate, minimal, warm, technical, print, legal, editorial, dark |

## Integration

| Tool                       | Description                                      |
| -------------------------- | ------------------------------------------------ |
| [MCP Server](./mcp-server) | `@dotit/mcp` — Model Context Protocol server for AI agents |
| [ERP / App Integration](./erp-integration) | Use IntentText as a print/report engine in your app — template + data → HTML/PDF |
