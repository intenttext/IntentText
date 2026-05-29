# ERP Sample Service

Minimal standalone ERP-oriented service exposing:

- `POST /render-html`
- `POST /render-pdf`
- `POST /replay-html`
- `GET /health`

This sample combines handlers, basic config loading, and run instructions in one folder.

## Run

```bash
cd examples/erp-sample-service
cp .env.example .env
node --env-file=.env server.mjs
```

Service default:

- `http://127.0.0.1:3090`

## Notes

- Uses `@intenttext/core` for parse/merge/render HTML.
- Uses runtime package for `createPdf`.
- Includes minimal migration metadata pass-through for replay endpoint.
- Intended as copy-start template for ERP backend teams.
