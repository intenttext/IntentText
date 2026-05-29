# Page Layout Contract (M1)

This contract defines how templates handle page background, header, footer, and content-safe area for predictable preview/PDF parity.

## Design Goals

- deterministic rendering across builder preview and PDF output
- no overlap between content and header/footer assets
- clear upload constraints for template authors
- minimal V1 surface area (no advanced per-page variants)

## Layer Model

Render layers (back to front):

1. `background` (optional full-page image)
2. `content` (main document flow)
3. `header` and `footer` zones (fixed overlays)

## Page Box and Safe Area

`page` contract fields (V1):

- `size`: `A4 | Letter | Legal`
- `marginTopMm`, `marginRightMm`, `marginBottomMm`, `marginLeftMm`
- `safeAreaMm` (default 10)

Effective content region:

- starts after `header.heightMm` + top margin
- ends before `footer.heightMm` + bottom margin
- always constrained by safe area

## Header/Footer Contract

Header/footer are fixed zones with explicit dimensions.

`header` and `footer` fields:

- `enabled`: boolean
- `heightMm`: number
- `imageUrl` or asset id
- `fit`: `contain | cover | stretch`
- `position`: `center | top | bottom | left | right` (default `center`)

V1 defaults:

- `header.fit = contain`
- `footer.fit = contain`
- `stretch` allowed but discouraged in UI

## Full-Page Background Contract (HL Letterhead)

`background` fields:

- `enabled`: boolean
- `imageUrl` or asset id
- `fit`: `cover | contain` (default `cover`)
- `opacity`: `0..1` (default `1`)

Rules:

- background applies to all pages in V1
- background never changes content safe-area dimensions
- no repeat/tiling in V1

## Upload and Validation Rules

Supported formats (V1):

- `PNG`, `JPG`

Validation at upload:

- minimum recommended resolution: 150 DPI at target page size (300 DPI preferred)
- max file size per asset (policy value configurable)
- aspect-ratio hint per zone shown in builder

## Crop and Preview Behavior

- no blind auto-crop
- builder exposes focal-point/crop controls for `cover`
- crop metadata stored with template
- runtime must replay crop metadata exactly

Crop metadata shape (example):

```json
{
  "fit": "cover",
  "focalX": 0.5,
  "focalY": 0.5,
  "scale": 1.0
}
```

## V1 Non-Goals

- odd/even page variants
- first-page-different header/footer
- per-section backgrounds
- print-shop bleed/crop mark workflows

## Parity Gate

All layout assets must pass parity gate:

- builder preview HTML snapshot == runtime HTML snapshot (normalized)
- PDF smoke confirms no content overlap with header/footer zones

## Implementation Notes

- use the same render contract in local server and Vercel API routes
- avoid system-font-dependent offsets that can shift text under header/footer
- keep layer z-index and spacing constants centralized
