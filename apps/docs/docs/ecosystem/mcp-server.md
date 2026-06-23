---
sidebar_position: 6
title: MCP Server
---

# MCP Server

The IntentText MCP server gives LLMs direct access to the full `.it` toolchain — parsing, rendering, querying, template merging, and the complete trust workflow (integrity seals, Ed25519 signatures, and UTS certification verification) — through the Model Context Protocol. It is the way an agent inside a business ERP (or Claude Desktop) drives IntentText end to end.

## Installation

```bash
npm install -g @dotit/mcp
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "intenttext-mcp"
    }
  }
}
```

Or run it without a global install via `npx`:

```json
{
  "mcpServers": {
    "intenttext": {
      "command": "npx",
      "args": ["-y", "@dotit/mcp"]
    }
  }
}
```

### VS Code (Copilot)

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "intenttext": {
      "command": "intenttext-mcp"
    }
  }
}
```

### HTTP mode

For remote or shared setups, the package ships a second binary that serves the same tools over Streamable HTTP:

```bash
PORT=3847 intenttext-mcp-http
```

`PORT` defaults to 3000.

## Available tools

All tools operate on IntentText source strings — pass the `.it` text in, get JSON or rendered output back.

### Parse & serialize

| Tool                 | Parameters             | Description                                                                       |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `parse_intent_text`  | `source`, `safe`       | Parse `.it` source into a structured JSON document. `safe` (default `true`) collects warnings instead of throwing |
| `document_to_source` | `document`             | Convert a document JSON object back to `.it` source text                          |

### Render

| Tool           | Parameters        | Description                                                                  |
| -------------- | ----------------- | ----------------------------------------------------------------------------- |
| `render_html`  | `source`, `theme?` | Render to styled HTML. Optional built-in theme: `corporate`, `minimal`, `warm`, `technical`, `print`, `legal`, `editorial`, `dark` |
| `render_print` | `source`, `theme?` | Print-ready (paged) HTML with `@media print` CSS — applies `font:`, `page:`, and divider settings. Feed this HTML to any HTML-to-PDF renderer (`@dotit/pdf` server-side, or the browser print dialog). The MCP returns print-ready HTML, not a PDF binary (no headless browser is bundled). Same optional `theme` |

### Templates

| Tool             | Parameters                                | Description                                                       |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `merge_template` | `template`, `data`, `render?`, `missing?` | Merge `{{variable}}` placeholders with a data object. `render`: `none` (default, returns `.it` source), `html`, or `print`. `missing`: `keep` leaves unresolved placeholders visible (default), `blank` removes them so optional fields never print |

### Validate & query

| Tool                | Parameters                                | Description                                                          |
| ------------------- | ----------------------------------------- | --------------------------------------------------------------------- |
| `validate_document` | `source`                                  | Semantic validation beyond syntax: broken step references, missing required properties, unresolved variables, workflow logic errors |
| `query_document`    | `source`, `query?`, `type?`, `content?`, `section?`, `limit?` | Filter blocks. Either use the structured filters (type — comma-separated for multiple: `step,gate` — content substring, section) **or** pass a raw `query` string for richer filtering on properties, e.g. `type=task owner=Ahmed due<2026-03-01 sort:due:asc limit:10` (operators `= != < > <= >= :contains :startsWith ?`, plus `sort:field:asc\|desc` and `limit:N`/`offset:N`). `query` takes precedence when given |
| `diff_documents`    | `before`, `after`                         | Semantic diff between two versions — which blocks were added, removed, or modified |

### Workflow

| Tool               | Parameters | Description                                                                |
| ------------------ | ---------- | --------------------------------------------------------------------------- |
| `extract_workflow` | `source`   | Extract the execution graph: steps in topological order, dependencies, parallel batches, gate positions |

### Trust — integrity (SHA-256, zero-dependency)

This layer answers _"has the content changed?"_

| Tool                   | Parameters                       | Description                                                  |
| ---------------------- | -------------------------------- | -------------------------------------------------------------- |
| `seal_document`        | `source`, `signer`, `role?`      | Seal for integrity — appends a SHA-256 content hash (`sign:`) and a `freeze:` marker; returns sealed source + hash. Proves the content is unchanged, not cryptographically _who_ sealed it |
| `verify_document`      | `source`                         | Verify integrity of a sealed document — recompute the hash and report tampering |
| `compute_hash`         | `source`                         | Compute the canonical SHA-256 content hash (`sha256:<hex>`) — the same hash used by seals and signature payloads. Useful for an ERP anchoring a document in an audit log or external ledger |
| `get_document_history` | `source`, `block_id?`, `section?` | Revision history of a tracked document: what changed, who, when |

### Trust — cryptographic identity & certification (Ed25519, `@dotit/sign`)

This layer answers _"who signed it?"_ and _"did an authority certify it?"_ Verification needs no key and works offline — each `sign:`/`certify:` line carries the public key, so the `.it` file self-verifies.

| Tool                    | Parameters                                | Description                                                  |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `verify_signatures`     | `source`                                  | Verify every Ed25519 signature against the **current** content. Read-only, no key. Returns per-signer `{signer, role, at, publicKey, valid}`, a valid count, and `allSignaturesValid`. Any edit after signing flips signatures to invalid |
| `verify_certification`  | `source`, `issuer?`, `trustedKey?`        | Verify UTS (or other authority) `certify:` lines — proof an authority attested this exact content at a stated time, from a stated (optionally KYC-verified) account/entity. Pass `trustedKey` (the authority's published Ed25519 public key; for UTS, from `https://api.uts.qa/.well-known/uts-pubkey`) so a forged line with a different key is rejected. `issuer` defaults to `UTS` |
| `sign_document`         | `source`, `signer`, `privateKey`, `role?` | Add an Ed25519 signature using a private key **the caller supplies**. The `privateKey` is used in-process only for this single call and is never stored, logged, or transmitted. For ERPs holding their own signing key. Idempotent per public key |
| `generate_signing_key`  | _(none)_                                  | Generate a fresh Ed25519 keypair `{publicKey, privateKey}`. The caller MUST store `privateKey` securely (KMS / ERP secret store) — it is shown once and never persisted by the server |

:::note Where issuance lives
The MCP **verifies** certifications but never **issues** them. Certification issuance requires the UTS authority's private key, which lives only on the UTS service (`api.uts.qa`) and must never be placed in an MCP server. Document authors sign with their own keys (`sign_document`); the authority certifies separately.
:::

### Coverage

The tools above expose the **core** of the toolchain — parse, render, merge, validate,
query, diff, workflow extraction, and the full integrity + cryptographic-identity trust
layer. A few `@dotit/core` capabilities are not yet wired as MCP tools and are reached via
the library or CLI instead: **conformance** (`checkConformance`), the **Forms** API
(`applyAnswers` / `isFormComplete` / `sealFormStructure`), **version compare / 3-way merge**
(`compareVersions` / `mergeThreeWay`), the **binary converters** (`.xlsx`/`.docx` ⇄ `.it`),
**e-invoice (UBL)** export (`buildUBLInvoice`), and **approval routing** (`workflowState` /
`appendApproval`). These are on the MCP roadmap; until then, drive them through
[`@dotit/core`](./core-api) or the [CLI](./cli).

## Tool examples

### Parse and render

```
User: "Render this invoice as HTML with the corporate theme"

Claude calls: render_html({
  source: "title: Invoice #2847\n...",
  theme: "corporate"
})
```

### Merge a template

```
User: "Generate the invoice for Acme from the standard template"

Claude calls: merge_template({
  template: "title: Invoice {{number}}\n...",
  data: { "number": "INV-2847", "client": "Acme Corp" },
  render: "print",
  missing: "blank"
})
```

### Query a document

```
User: "What tasks are in this project plan?"

Claude calls: query_document({
  source: "title: Project Plan\n...",
  type: "task",
  limit: 20
})
```

### Seal a contract

```
User: "Seal this NDA as Maria Santos, COO"

Claude calls: seal_document({
  source: "title: NDA\n...",
  signer: "Maria Santos",
  role: "COO"
})
```

The result includes the sealed source — store it as returned. The seal is a SHA-256 hash over
the document's **content** (under `spec: 4`, which excludes styling/comments and normalizes
line endings + trailing whitespace), so a later reformat or CRLF change won't break it; only a
content change does. Byte-exact storage is good hygiene, not what the seal enforces.

### Validate a generated workflow

```
User: "Check this deployment workflow before we run it"

Claude calls: validate_document({
  source: "step: Build\nstep: Deploy | after: Build\n..."
})
```

### Verify a signed & certified document

```
User: "Is this signed purchase order valid and certified by UTS?"

Claude calls: verify_signatures({ source: "title: PO #4471\n..." })
  → { validCount: 2, allSignaturesValid: true, signatures: [...] }

Claude calls: verify_certification({
  source: "title: PO #4471\n...",
  issuer: "UTS",
  trustedKey: "<key from https://api.uts.qa/.well-known/uts-pubkey>"
})
  → { certifications: [{ issuer: "UTS", entity: "Acme Corp WLL", valid: true, trusted: true, at: "..." }] }
```

## ERP agent pipeline

An agent embedded in a business ERP can drive the whole lifecycle through these tools — generate, render, and prove — without leaving the chat:

1. **Generate** — `merge_template` to fill a contract/invoice template from ERP record data (`missing: "blank"` so optional fields never print).
2. **Validate** — `validate_document` to catch broken references or unresolved variables before anything is shown to a human.
3. **Render** — `render_html` for on-screen review, `render_print` to hand print-ready HTML to `@dotit/pdf` (server-side) for the final PDF.
4. **Sign** — `generate_signing_key` once per signer (store the private key in the ERP's secret store), then `sign_document` with that key to apply an Ed25519 signature in-process.
5. **Anchor** — `compute_hash` to record the document's content hash in the ERP audit log / ledger.
6. **Verify** — on receipt, `verify_signatures` (who signed, unchanged?) and `verify_certification` (authority-attested?) — both offline, no key custody required for verification.

The agent never needs the UTS authority key to sign; certification is requested from the UTS service out of band, and the resulting `certify:` line is verified here.

## Security

The MCP server is **stateless**: every tool takes document source as input and returns results — it does not read or write your filesystem, and it holds no keys.

- Integrity tools (`seal_document`, `verify_document`, `compute_hash`, `get_document_history`) use the same SHA-256 system as the rest of the toolchain.
- Verification tools (`verify_signatures`, `verify_certification`) are read-only and need no secret.
- `sign_document` requires a caller-supplied `privateKey` that is used in-process only for that single call — it is never stored, logged, or transmitted. `generate_signing_key` returns a private key exactly once; storing it securely is the caller's responsibility.
- The UTS authority's signing key is **never** present in the MCP — issuance stays with the UTS service.

All tools return clear error text (with `isError`) on bad input rather than crashing the server.

## Source

Repository: [intenttext-mcp](https://github.com/intenttext/intenttext-mcp) · npm: [`@dotit/mcp`](https://www.npmjs.com/package/@dotit/mcp) (2.0.0 — formerly `@intenttext/mcp`, now deprecated with a pointer)
