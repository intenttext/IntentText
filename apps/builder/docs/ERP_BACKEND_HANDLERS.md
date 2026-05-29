# ERP Backend Handlers (Express/Fastify)

Copy-paste backend handler references for ERP teams.

## Files

- `examples/erp-express-handlers.mjs`
- `examples/erp-fastify-handlers.mjs`

Both examples expose:

- `POST /render-html`
- `POST /render-pdf`
- `POST /replay-html`

and orchestrate:

- `@intenttext/core` for parse/merge/render HTML
- runtime `createPdf` for HTML-to-PDF conversion

## How To Use

1. Copy handlers into ERP backend service.
2. Replace module loading with your package wiring (`@intenttext/core`, runtime package).
3. Replace placeholder migration function with your shared migration module.
4. Add ERP authN/authZ middleware and tenant scoping.
5. Add observability and retry policies aligned with your SLA.

## Important Notes

- Examples are intentionally minimal and focus on orchestration shape.
- Error classification should be aligned with your final API contract.
- For official invoice generation, keep render path server-side.

## References

- `docs/ERP_INTEGRATION_FLOW.md`
- `docs/ERP_API_QUICKSTART.md`
- `docs/ERP_REPLAY_QUICKSTART.md`
- `docs/ERP_PRODUCTION_CHECKLIST.md`
