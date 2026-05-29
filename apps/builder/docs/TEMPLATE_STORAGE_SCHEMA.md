# Template Storage Schema (M1 Contract)

This document defines the storage contract for builder/runtime template persistence.

## Minimum Fields (Required)

```sql
CREATE TABLE templates (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  content           TEXT NOT NULL,
  renderer_version  TEXT NOT NULL,
  theme_version     TEXT NOT NULL,
  tenant_id         TEXT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Recommended Fields

```sql
ALTER TABLE templates ADD COLUMN updated_at TIMESTAMP;
ALTER TABLE templates ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE templates ADD COLUMN checksum TEXT;
ALTER TABLE templates ADD COLUMN metadata_json TEXT;
```

## Notes

- `content` is the exported template artifact string.
- `renderer_version` and `theme_version` are required for deterministic replay.
- `checksum` should be a stable hash (for tamper checks and caching keys).
- `status` supports lifecycle (`draft`, `active`, `archived`).
