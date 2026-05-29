# ERP Replay Quickstart

Use replay APIs to verify deterministic rendering and version alignment for audit/debug workflows.

Endpoint:

- `POST /api/replay-html`

Base URL examples:

- Local: `http://127.0.0.1:8080/api`
- Hosted: `https://<your-host>/api`

## 1) Request Shape

```json
{
  "artifact": {
    "template": "title: Invoice {{invoice_number}}\ntext: Customer {{customer_name}}",
    "template_version": "template-v1",
    "renderer_version": "renderer-v1",
    "theme_version": "theme-v1"
  },
  "data": {
    "invoice_number": "INV-2401",
    "customer_name": "Atlas Corp"
  }
}
```

Notes:

- `artifact` object is required.
- `artifact.template` is required.
- `artifact.template_version`, `artifact.renderer_version`, and `artifact.theme_version` are required.
- `data` must be an object when provided.

## 2) Response Shape

```json
{
  "html": "<article>...</article>",
  "replay": {
    "template_version": "template-v1",
    "renderer_version": "renderer-v1",
    "theme_version": "theme-v1",
    "html_sha256": "a6f4..."
  },
  "migration": {
    "from": {
      "template_version": "template-v1",
      "renderer_version": "renderer-v1",
      "theme_version": "theme-v1"
    },
    "to": {
      "template_version": "template-v1",
      "renderer_version": "renderer-v1",
      "theme_version": "theme-v1"
    },
    "applied_hooks": []
  }
}
```

Meaning:

- `replay.html_sha256` is a normalized HTML hash used for deterministic replay checks.
- `migration` shows any version normalization/migration executed before render.

## 3) Determinism Check Pattern

For ERP audit checks:

1. Call `/api/replay-html` twice with identical payload.
2. Compare `replay.html_sha256` values.
3. If hashes differ, treat as deterministic replay failure.

## 4) `curl` Example

```bash
curl -sS -X POST http://127.0.0.1:8080/api/replay-html \
  -H 'content-type: application/json' \
  -d '{
    "artifact": {
      "template": "title: Invoice {{invoice_number}}\\ntext: Customer {{customer_name}}",
      "template_version": "template-v1",
      "renderer_version": "renderer-v1",
      "theme_version": "theme-v1"
    },
    "data": {
      "invoice_number": "INV-2401",
      "customer_name": "Atlas Corp"
    }
  }'
```

## 5) Error Handling

Structured error shape:

```json
{
  "error": "artifact object is required for replay-html.",
  "type": "data_error",
  "code": "ARTIFACT_INVALID"
}
```

Common replay error codes:

- `ARTIFACT_INVALID`
- `TEMPLATE_EMPTY`
- `ARTIFACT_VERSION_MISSING`
- `DATA_INVALID`

## 6) Recommended ERP Usage

- Store artifact version tuple with template records.
- Use replay endpoint during template promotion/validation pipelines.
- Persist `html_sha256` snapshots for regression detection between releases.
- Log `migration.applied_hooks` for migration audit visibility.
