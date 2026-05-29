# Core Style Compatibility (Builder -> Core)

Purpose: guarantee that builder-produced templates remain directly consumable by `IntentText core` for ERP final rendering.

## Non-Negotiable Rule

- Builder may not introduce style/layout metadata that is not representable as core-readable template semantics.
- Final rendering in ERP must be reproducible with only:
  - template text
  - data payload
  - core/runtime renderer

## Rendering Path (Current)

- Builder preview API uses `core.parseAndMerge` + `core.renderHTML`.
- Runtime PDF path uses the same core HTML generation before PDF conversion.

## Compatibility Map

Global style properties supported by core renderer (inline properties):

- `color`
- `size`
- `family`
- `weight`
- `align`
- `bg`
- `indent`
- `opacity`
- `italic`
- `border`

Layout keywords and accepted property families:

- `page`
  - `size`
  - margin aliases:
    - `marginTopMm`, `marginTop`, `margin-top`
    - `marginRightMm`, `marginRight`, `margin-right`
    - `marginBottomMm`, `marginBottom`, `margin-bottom`
    - `marginLeftMm`, `marginLeft`, `margin-left`
  - safe-area aliases:
    - `safeAreaMm`, `safeArea`, `safe-area`

- `header`, `footer`
  - `fit`
  - height aliases: `heightMm`, `height`, `zoneHeightMm`
  - image source aliases: `imageUrl`, `image`, `src`, `url`
  - `position`
  - `enabled`

- `watermark` (and `background` compatibility usage)
  - `fit`
  - `opacity`
  - image source aliases: `imageUrl`, `image`, `src`, `url`
  - `enabled`

## Builder-Only Metadata (Blocked)

The following keys are explicitly blocked in template properties by the core-style gate because they are not currently represented in core semantics:

- `focalX`
- `focalY`
- `scale`
- `cropX`
- `cropY`
- `cropWidth`
- `cropHeight`

If these are needed later, they must first be implemented in core semantics and test coverage, then removed from block list.

## Enforcement

Gate command:

```bash
npm run core-style:check
```

Current gate scans golden templates and fails CI when unsupported style metadata is detected.
