# ERP Render API Quickstart

The contract implemented by [`erp-service.mjs`](../erp-service.mjs) — use it as-is, or
port the handlers into your Express/Fastify/Nest backend. Everything below runs on
`@dotit/core` (HTML) plus optional puppeteer (PDF bytes).

Run the reference service:

```bash
node erp-service.mjs        # → http://127.0.0.1:3090
```

## 1) Render HTML

`POST /render-html`

```json
{
  "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
  "data": { "invoice_number": "INV-2401", "customer_name": "Atlas Corp" }
}
```

→ `200 { "html": "<article>…</article>" }`

```bash
curl -sS -X POST http://127.0.0.1:3090/render-html \
  -H 'content-type: application/json' \
  -d '{
    "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
    "data": {"invoice_number": "INV-2401", "customer_name": "Atlas Corp"}
  }'
```

## 2) Render PDF

`POST /render-pdf` — requires `npm i puppeteer` next to the service.

```json
{
  "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
  "data": { "invoice_number": "INV-2401", "customer_name": "Atlas Corp" },
  "theme": "corporate"
}
```

→ `200 { "html": "…", "pdfBase64": "JVBERi0xLjQ…", "metrics": { "durationMs": 230 } }`

The PDF honors the document's own `page:` size/margins (`preferCSSPageSize`).

## 3) Error contract

All endpoints return structured errors:

```json
{
  "error": "human-readable message",
  "type": "template_error | data_error | render_error | pdf_backend_error",
  "code": "MACHINE_READABLE_CODE"
}
```

| Type | Status | Typical codes |
| --- | --- | --- |
| `template_error` | 422 | `TEMPLATE_EMPTY`, `TEMPLATE_INVALID` |
| `data_error` | 422 | `DATA_INVALID`, `ARTIFACT_INVALID`, `ARTIFACT_VERSION_MISSING` |
| `render_error` | 500 | `RENDER_RUNTIME_FAILURE` |
| `pdf_backend_error` | 503 | `PDF_BACKEND_FAILURE` (Chromium/puppeteer launch or render) |

Treat `type`/`code` as the contract; implement fallback/retry for
`pdf_backend_error` (the HTML route keeps working without a browser backend).

## 4) ERP persistence pattern

1. Store the template (plain `.it` text, or an artifact JSON — see
   [REPLAY_AND_VERSIONING.md](REPLAY_AND_VERSIONING.md)) in your ERP DB.
2. At print time, load the latest business data from the ERP DB.
3. Call `/render-pdf` for official document generation (server-side, deterministic).
4. Call `/render-html` for previews, or skip the server entirely with the
   browser-print path in [`intenttext-print.mjs`](../intenttext-print.mjs).
