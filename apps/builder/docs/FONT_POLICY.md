# Font Policy (M1 Freeze)

Goal: deterministic preview/PDF output without CDN or host-system font dependence in render paths.

## Policy

1. No external font providers in render path output.
2. No remote `@font-face src` URLs in render output.
3. No remote CSS font imports (`@import url(http...)`) in render output.
4. Runtime/API source files must not hardcode external font provider URLs.
5. Builder/runtime parity fixtures are the enforcement baseline for this policy.

## Scope

Enforced scope in M1:

- Runtime package source: `packages/pdf-runtime/src/**`
- API/local server source: `api/**`, `server/**`
- Fixture templates: `fixtures/golden/**/*.it`
- Rendered HTML from both:
  - direct core render
  - `/api/render-html` render

## Disallowed Patterns

- `fonts.googleapis.com`
- `fonts.gstatic.com`
- `@import url(http://...)` or `@import url(https://...)`
- `@font-face ... src: ... http://...` or `https://...`

## CI Guard

`npm run font-policy:check`

The check fails the build if any disallowed pattern appears in source or fixture render outputs.
