# IntentText — Architecture

_Last updated: 2026-06-09_

## Single source of truth

**`@dotit/core` (TypeScript) is the one canonical implementation** of the
IntentText language. The grammar, parser, merge, query, render, validation, and
trust/freeze logic live in [`packages/core/src`](packages/core/src) and nowhere
else. No other language or package re-implements the grammar.

Historical note: earlier versions (≤ v3.3) routed parsing through a Rust/WASM core
and a separate Python parser. Both were **removed** — Rust/WASM in v3.4.0, the
Python and Rust duplicates in the v4.1 finalization. Any document, plan, or comment
that describes Rust as "the source of truth" is obsolete; this file is authoritative.

## The keyword contract

The reserved keyword set is defined once in
[`packages/core/src/language-registry.ts`](packages/core/src/language-registry.ts)
(`LANGUAGE_REGISTRY`). Everything else is **derived** from it: the `KEYWORDS` array,
the `BlockType` union, and the alias map in [`types.ts`](packages/core/src/types.ts).

Downstream consumers (README table, VSCode snippets/grammar, docs reference) must not
hand-maintain their own keyword lists. The consistency gate
(`pnpm --filter @dotit/core keywords:check`) enforces that they match the
registry; CI fails on drift.

## Packages (@dotit/* — published to npm)

| Package | Ver | Role | Deps |
| --- | --- | --- | --- |
| `packages/core` | 1.12 | The language: parser, merge, query, render, trust, **forms, redline/compare, redaction, attachments, two-party form trust, conditional/computed fields, math markers, hub-submit client**. The only grammar implementation. | **zero** |
| `packages/editor` | 1.8 | Embeddable React editor: `IntentTextWorkbench` (edit/fill/review/view), ribbon, trust banner. Imports `@dotit/core` (external). Browser-only. | react |
| `packages/sign` | 1.4 | Ed25519 signatures + UTS certification (root→intermediate chain). | — |
| `packages/pades` | 1.0 | PAdES PDF signatures: ECDSA P-256 + X.509 + CMS; CSR/CA issuance; RFC-3161 timestamps. | pkijs, @signpdf |
| `packages/pdf` | 1.1 | Server-side PDF + PDF/A (`toPdfA`) + PAdES-signed PDF. | core, pdf-lib; puppeteer/pades peers |
| `packages/math` | 0.1 | Renders core's math placeholders → MathML (lite) / KaTeX (optional peer). | — |
| `packages/mcp` | 1.1 | MCP server exposing `.it` tools to AI agents. | core |
| `packages/vscode` | — | VSCode extension: highlighting, snippets, hover. | core |

**Principle:** `@dotit/core` stays **dependency-free** and runs in Node + browser +
print path. Heavy runtime deps live in optional sibling packages/peers (puppeteer in
`@dotit/pdf`, pkijs in `@dotit/pades`, KaTeX as a `@dotit/math` peer). Validators
(veraPDF for PDF/A) are CI-only, never shipped.

## Apps & services

`apps/desktop` (**Electron** enterprise document manager — migrated from Tauri),
`apps/editor` (web editor), `apps/docs` (Docusaurus site), `apps/hub` (Next.js template
gallery + `/api/responses` form-submission receiver). `services/uts-certify` is the
certification authority (Ed25519 + an **X.509 CA** for PAdES, `POST /certify/x509`).
All build against the same `@dotit/*` packages.

> `apps/builder` was retired (2026-06). Its ERP integration patterns live in
> `demo/erp-integration/`; the full embedding guide is `INTEGRATION.md`.

## Data flow

```
.it text ──▶ parseIntentText() ──▶ IntentDocument (typed blocks)
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              ▼                          ▼                           ▼
        renderHTML()              queryBlocks()              trust: sign/freeze/verify
```

Custom (non-reserved) keywords pass through as `type: "custom"` blocks, preserved
verbatim — so the format is extensible without growing the reserved set.
