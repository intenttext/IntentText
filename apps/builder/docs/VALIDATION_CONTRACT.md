# validateTemplate Contract (M1)

## Endpoint

- `POST /api/validate-template` (Vercel)
- `POST /validate-template` and `/api/validate-template` (local server)

## Request

```json
{
  "template": "title: Invoice\ntext: {{client_name}}"
}
```

## Response

```json
{
  "valid": true,
  "issues": [
    {
      "code": "PARSE_WARNING",
      "category": "parse",
      "message": "...",
      "path": "line:3",
      "severity": "warning"
    }
  ],
  "variables": {
    "all": ["client_name"],
    "required": ["client_name"],
    "optional": [],
    "repeated": [
      {
        "path": "item.description",
        "itemAlias": "item",
        "collection": "items"
      }
    ]
  }
}
```

## Issue Taxonomy

- `category`: `parse | template | data_contract | system`
- `severity`: `error | warning`
- `code`: stable machine-readable identifier

Current M1 coverage:

- parse errors/warnings from core are mapped as `category=parse`
- variable inventory extraction includes repeated-path hints

Planned expansion:

- template-logic issues (`category=template`)
- data-shape issues (`category=data_contract`)
- backend/runtime issues (`category=system`)

M1 template-layout codes now included (`category=template`), examples:

- `LAYOUT_MULTIPLE_PAGE_BLOCKS`
- `LAYOUT_PAGE_SIZE_UNSUPPORTED`
- `LAYOUT_MARGIN_NOT_NUMBER`
- `LAYOUT_MARGIN_RANGE`
- `LAYOUT_SAFE_AREA_NOT_NUMBER`
- `LAYOUT_SAFE_AREA_RANGE`
- `LAYOUT_IMAGE_MISSING`
- `LAYOUT_FIT_INVALID`
- `LAYOUT_ZONE_HEIGHT_NOT_NUMBER`
- `LAYOUT_ZONE_HEIGHT_RANGE`
- `LAYOUT_BACKGROUND_IMAGE_MISSING`
- `LAYOUT_BACKGROUND_FIT_INVALID`
- `LAYOUT_OPACITY_NOT_NUMBER`
- `LAYOUT_OPACITY_RANGE`
- `LAYOUT_PAGE_BLOCK_RECOMMENDED`
