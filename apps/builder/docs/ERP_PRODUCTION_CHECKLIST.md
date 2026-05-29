# ERP Production Checklist

Use this checklist before enabling official document generation in production ERP environments.

## 1) Rendering Model

- [ ] Confirm architecture: core for HTML semantics, runtime wrapper for PDF bytes.
- [ ] Ensure templates stored in ERP DB are builder-exported artifacts or validated `.it` source.
- [ ] Keep template and data merge server-side for official docs.

## 2) Versioning and Replay

- [ ] Persist `template_version`, `renderer_version`, `theme_version` with templates.
- [ ] Run replay checks with `/api/replay-html` in promotion pipeline.
- [ ] Compare `replay.html_sha256` across repeated runs for deterministic verification.
- [ ] Log `migration.applied_hooks` for auditability.

## 3) Fonts and Assets

- [ ] Use approved font policy only (no uncontrolled external font dependencies).
- [ ] Host static assets on stable, trusted URLs.
- [ ] Enforce asset availability checks and timeouts.
- [ ] Avoid environment-specific font assumptions on client devices.

## 4) Runtime Reliability

- [ ] Configure retry strategy (`retryAttempts`) for transient PDF failures.
- [ ] Configure browser pool limits to protect backend resources.
- [ ] Configure task and queue timeouts for predictable latency.
- [ ] Capture runtime metrics (`durationMs`, `queueWaitMs`, `crashCount`).

## 5) API Contract Handling

- [ ] Treat `/api/render-pdf` typed errors as contract (`type`, `code`, `error`).
- [ ] Distinguish validation errors (`422`) from runtime/backend failures (`500`/`503`).
- [ ] Implement fallback/retry policy for `pdf_backend_error`.

## 6) Validation and Gates

- [ ] Run `parity:check` for preview/runtime HTML equivalence.
- [ ] Run `core-style:check` to block builder-only style metadata drift.
- [ ] Run `font-policy:check` and `pdf:smoke` in CI.
- [ ] Keep `replay:check` and `migration:check` enabled in CI.

## 7) Security and Data Handling

- [ ] Restrict untrusted template sources; validate before activation.
- [ ] Keep invoice/business data scoped per tenant/account.
- [ ] Protect render endpoints with authN/authZ at ERP boundary.
- [ ] Avoid logging sensitive payload contents.

## 8) Operations

- [ ] Define SLA for render latency and failure thresholds.
- [ ] Add alerting for sustained `pdf_backend_error` spikes.
- [ ] Add artifact retention policy for generated PDFs (if stored).
- [ ] Document rollback strategy for template/version regressions.

## 9) Developer References

- ERP model: `docs/ERP_INTEGRATION_FLOW.md`
- API quickstart: `docs/ERP_API_QUICKSTART.md`
- Replay quickstart: `docs/ERP_REPLAY_QUICKSTART.md`
- Runtime error contract: `docs/RUNTIME_ERROR_CONTRACT.md`
- Core style compatibility: `docs/CORE_STYLE_COMPATIBILITY.md`
