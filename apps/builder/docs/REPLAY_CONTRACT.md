# Replay Contract (M2)

Endpoint: `POST /api/replay-html`

Purpose: verify deterministic replay for a versioned artifact payload.

## Request Shape

```json
{
  "artifact": {
    "template": "title: Invoice\\ntext: {{client_name}}",
    "template_version": "template-v1",
    "renderer_version": "renderer-v1",
    "theme_version": "theme-v1"
  },
  "data": {
    "client_name": "Atlas Corp"
  }
}
```

## Response Shape

```json
{
  "html": "<article>...</article>",
  "replay": {
    "template_version": "template-v1",
    "renderer_version": "renderer-v1",
    "theme_version": "theme-v1",
    "html_sha256": "..."
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

## Rules

- `artifact.template` is required.
- `artifact.template_version`, `artifact.renderer_version`, and `artifact.theme_version` are required.
- `data` must be an object when provided.
- `html_sha256` is computed from normalized HTML output and used for replay stability checks.
- `migration` metadata is always present, even when no hooks are applied.
