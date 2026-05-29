# ERP API Quickstart

Use this guide when ERP backend calls IntentText rendering APIs directly.

Base URL examples:

- Local: `http://127.0.0.1:8080/api`
- Hosted: `https://<your-host>/api`

## 1) Render HTML

Endpoint:

- `POST /api/render-html`

Request:

```json
{
  "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
  "data": {
    "invoice_number": "INV-2401",
    "customer_name": "Atlas Corp"
  }
}
```

Success response (`200`):

```json
{
  "html": "<article>...</article>"
}
```

`curl` example:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/render-html \
  -H 'content-type: application/json' \
  -d '{
    "template": "title: Invoice {{invoice_number}}\\ntext: Customer {{customer_name}}",
    "data": {"invoice_number": "INV-2401", "customer_name": "Atlas Corp"}
  }'
```

## 2) Render PDF

Endpoint:

- `POST /api/render-pdf`

Request:

```json
{
  "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
  "data": {
    "invoice_number": "INV-2401",
    "customer_name": "Atlas Corp"
  },
  "pdf": {
    "format": "A4",
    "printBackground": true
  },
  "runtimeConfig": {
    "retryAttempts": 1
  }
}
```

Success response (`200`):

```json
{
  "html": "<article>...</article>",
  "pdfBase64": "JVBERi0xLjQ...",
  "metrics": {
    "durationMs": 230,
    "queueWaitMs": 6,
    "crashCount": 0
  }
}
```

`curl` example:

```bash
curl -sS -X POST http://127.0.0.1:8080/api/render-pdf \
  -H 'content-type: application/json' \
  -d '{
    "template": "title: Invoice {{invoice_number}}\\ntext: Customer {{customer_name}}",
    "data": {"invoice_number": "INV-2401", "customer_name": "Atlas Corp"},
    "pdf": {"format": "A4", "printBackground": true}
  }'
```

## 3) PDF Error Handling

`/api/render-pdf` returns structured errors:

```json
{
  "error": "Template is required for render-pdf.",
  "type": "template_error",
  "code": "TEMPLATE_EMPTY"
}
```

Status mapping:

- `422`: template/data validation errors
- `500`: render runtime errors
- `503`: PDF backend errors (Chromium/Puppeteer)

See full contract:

- `docs/RUNTIME_ERROR_CONTRACT.md`

## 4) ERP Persistence Pattern

Recommended persistence model:

1. Save artifact JSON (or at minimum `artifact.template`) in ERP DB.
2. At print time, load latest business data from ERP DB.
3. Call `/api/render-pdf` for official document generation.
4. Optionally call `/api/render-html` for preview endpoints.

## 5) Notes

- If you only need browser printing, HTML route may be enough.
- For deterministic official invoices, prefer server-side `/api/render-pdf`.
- Keep `template_version`, `renderer_version`, `theme_version` in ERP records for replay/debug consistency.
