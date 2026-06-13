# ERP Integration Flow

The production integration model for ERP developers.

## Responsibilities

- **`@dotit/core`** — template parsing, data merge (`parseAndMerge`), final HTML
  (`renderHTML` / `renderPrint`). Pure JS, zero dependencies, runs anywhere.
- **PDF layer** — converting that HTML to PDF bytes. Either the browser's print
  dialog (zero deps) or headless Chromium on the server
  ([`intenttext-pdf.server.mjs`](../intenttext-pdf.server.mjs), or the published
  [`@dotit/pdf`](../../../packages/pdf) package).

## Integration modes

### Mode A — HTML only (browser print)

Use when browser print / save-as-PDF is acceptable.

1. Load the template (`.it` text) from the ERP DB.
2. Load business data (invoice/order/…) from the ERP DB.
3. `parseAndMerge(template, data)` → `renderHTML(doc)`.
4. Return HTML to the frontend (iframe preview, or `printDocument()` for the dialog).

### Mode B — official server-side PDF

Use when deterministic, archivable PDF bytes are required.

1. Load template + data from the ERP DB.
2. Render HTML via core.
3. Convert via headless Chromium (`renderDocumentPDF`, or `@dotit/pdf`'s
   `renderPDF` / `issuePDF` which can also seal the document on issue).
4. Return / store the PDF bytes.

## Why server PDF is separate

- Browser/device differences make client-side print less deterministic.
- A server runtime centralizes the Chromium + font environment for repeatable output.
- The server path supports retries, pooling, metrics and operational controls
  (see [PDF_RUNTIME_PATTERN.md](PDF_RUNTIME_PATTERN.md)).

## Recommended ERP storage

- Store the `.it` template text (or an artifact JSON) as the source of truth —
  never an AST/JSON tree.
- At render time, combine the stored template with **current** business data.
- Keep `template_version`, `renderer_version`, `theme_version` per record for
  replay/debug/audit (see [REPLAY_AND_VERSIONING.md](REPLAY_AND_VERSIONING.md)).

## Security

Treat templates as executable rendering input:

- validate templates before activation (`parseIntentTextSafe` /
  `validateDocument` in core),
- restrict untrusted external assets (fonts, images),
- keep rendering of official documents in a controlled backend environment,
- protect render endpoints with your ERP's authN/authZ and tenant scoping.
