# Runtime Package Skeleton (M1 #6/#7)

Path: `packages/pdf-runtime`

Purpose:

- expose thin runtime wrappers around `@intenttext/core`
- define browser-pool controls for deterministic PDF generation
- surface baseline observability fields

## API Surface

- `validateTemplate({ template })`
- `renderHtml({ template, data })`
- `createPdf({ template, data, pdf? }, runtimeConfig?)`

`createPdf` returns:

- `html`
- `pdf`
- `metrics`:
  - `durationMs`
  - `queueWaitMs`
  - `crashCount`

## Runtime Config

```ts
{
  browserPool: {
    maxBrowsers: number,
    maxPagesPerBrowser: number,
    queueTimeoutMs: number,
    launchTimeoutMs: number,
    taskTimeoutMs: number
  },
  retryAttempts: number,
  shutdownGraceMs: number
}
```

## Notes

- `puppeteer` is dynamically imported by `createPdf` and intentionally not hard-pinned in this skeleton.
- M1 goal is contract and control surface. Later milestones will add retries, health probes, and deeper process hardening.
- Font policy is frozen by `docs/FONT_POLICY.md` and enforced via `npm run font-policy:check` in CI.
