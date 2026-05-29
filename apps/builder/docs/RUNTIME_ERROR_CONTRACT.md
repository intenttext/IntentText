# Runtime Error Contract (M2)

Endpoint: `POST /api/render-pdf`

This contract defines structured runtime error responses for predictable integration behavior.

## Error Response Shape

```json
{
  "error": "human-readable message",
  "type": "template_error | data_error | render_error | pdf_backend_error",
  "code": "MACHINE_READABLE_CODE"
}
```

## Error Types

- `template_error`
  - Invalid or missing template input.
  - Typical codes: `TEMPLATE_EMPTY`, `TEMPLATE_INVALID`.

- `data_error`
  - Invalid request payload shape (for example non-object `data`, invalid `runtimeConfig`).
  - Typical codes: `DATA_INVALID`, `PDF_OPTIONS_INVALID`, `RUNTIME_CONFIG_INVALID`.

- `render_error`
  - Runtime/internal render path failures not specific to PDF backend.
  - Typical code: `RENDER_RUNTIME_FAILURE`.

- `pdf_backend_error`
  - PDF backend/browser failures (Puppeteer/Chromium launch/render issues).
  - Typical code: `PDF_BACKEND_FAILURE`.

## Status Mapping

- `template_error`: `422`
- `data_error`: `422`
- `render_error`: `500`
- `pdf_backend_error`: `503`
