# Migration Hooks (Skeleton)

Purpose: provide a stable extension point for artifact version migrations without changing replay/render APIs.

## Module

- Shared file: `shared/migration-hooks.js`
- API adapter: `api/migration-hooks.js`
- Export: `applyArtifactMigrations(artifact)`
- Current behavior: includes normalization/default hooks for artifact version metadata.

## Response Metadata

`/replay-html` now returns:

- `migration.from`: pre-migration version tuple
- `migration.to`: post-migration version tuple
- `migration.applied_hooks`: ordered list of hook IDs executed

This keeps replay deterministic while making migration execution observable.

## Builder Import Usage

- Builder artifact import (`src/App.tsx`) now applies the shared migration pipeline before metadata/integrity validation.
- Legacy artifacts without integrity fields are accepted and loaded; artifacts with integrity fields continue strict verification.

## Hook Contract

Hooks are registered in `HOOKS` with shape:

```js
{
  id: "template-v1-to-v2",
  applies: (artifact) => boolean,
  run: async (artifact) => ({ ...artifact, template_version: "template-v2" })
}
```

Current hooks:

- `artifact-version-camelcase-to-snakecase-v1`
  - Maps legacy `templateVersion` / `rendererVersion` / `themeVersion` to snake_case fields.
- `artifact-version-defaults-v1`
  - Fills missing version metadata with deterministic defaults:
    - `template_version: template-v1`
    - `renderer_version: renderer-v1`
    - `theme_version: theme-v1`

Rules:

- `applies` must be pure and deterministic.
- `run` must return an object artifact patch.
- Hook execution order is the array order.
- Hook IDs must be stable strings for auditability.

## Determinism Notes

- Hooks must not read time, randomness, network, or filesystem state.
- Any migration output must be fully derived from the input artifact.
- Replay gate (`scripts/replay-check.mjs`) validates migration metadata shape.
- Migration gate (`scripts/migration-check.mjs`) validates fixture outcomes and second-pass idempotence.

## Fixture Coverage

- Manifest: `fixtures/migration/manifest.json`
- Run check: `npm run migration:check`
