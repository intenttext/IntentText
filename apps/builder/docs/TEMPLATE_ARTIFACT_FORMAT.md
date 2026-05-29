# Template Artifact Format (V1)

Schema id: `intenttext.template-artifact.v1`

Purpose: portable builder artifact for export/import workflows while keeping format details opaque to business users.

## JSON Shape

```json
{
  "schema_version": "intenttext.template-artifact.v1",
  "export_mode": "template_with_sample_data",
  "name": "invoice-template",
  "created_at": "2026-03-11T12:00:00.000Z",
  "template_version": "template-v1",
  "renderer_version": "renderer-v1",
  "theme_version": "theme-v1",
  "template": "title: Invoice\\ntext: {{client_name}}",
  "data_json": "{\"client_name\":\"Atlas Corp\"}",
  "checksum_sha256": "f8de...",
  "integrity_signature": "sha256:f8de..."
}
```

## Required Fields

- `schema_version`
- `name`
- `export_mode`
- `created_at`
- `template_version`
- `renderer_version`
- `theme_version`
- `template`
- `data_json`
- `checksum_sha256`
- `integrity_signature`

## Rules

- `schema_version` must equal `intenttext.template-artifact.v1`.
- `export_mode` must be one of:
  - `template_only`
  - `template_with_sample_data`
- `template` is the authoritative template content.
- `data_json` is stored as string for transparent round-trip behavior.
- `template_only` exports should use `{}` as `data_json`.
- `template_version` is required for replay/determinism alignment.
- `renderer_version` and `theme_version` are required for deterministic replay alignment.
- `checksum_sha256` is computed over canonical artifact fields excluding integrity fields.
- `integrity_signature` currently uses `sha256:<checksum_sha256>` and must match checksum verification.

## Compatibility

- Future schema versions should remain backward-compatible when possible.
- Importers should reject unknown `schema_version` by default unless explicitly migrated.
