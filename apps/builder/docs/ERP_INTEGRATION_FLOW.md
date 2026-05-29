# ERP Integration Flow (Core + Runtime)

This guide explains the production integration model for ERP developers.

## Summary

- `IntentText core` is responsible for template parsing, data merge, and final HTML rendering.
- `PDF runtime` is responsible for converting that HTML to PDF bytes.

## Integration Modes

### Mode A: HTML Output Only

Use when browser print/save-as-PDF is acceptable.

1. Load template (`.it` or artifact `template` field) from ERP DB.
2. Load business data (invoice/order/etc.) from ERP DB.
3. Call core:
   - `parseAndMerge(template, data)`
   - `renderHTML(doc)`
4. Return HTML to frontend.

### Mode B: Official PDF Output

Use when deterministic server-side PDF is required.

1. Load template from ERP DB.
2. Load business data from ERP DB.
3. Render HTML via core.
4. Convert to PDF via runtime `createPdf({ template, data })`.
5. Return PDF bytes / file stream.

## Why Runtime Is Separate

- Browser/device differences make client-side print less deterministic.
- Runtime centralizes Chromium/font environment for repeatable output.
- Server path supports retries, metrics, and operational controls.

## Recommended ERP Storage

- Store template artifact JSON as source of truth.
- At render time, use artifact `template` + current business data.
- Keep `template_version`, `renderer_version`, `theme_version` for replay/debug/audit.

## Security Note

Treat templates as executable rendering input:

- validate template before activation,
- restrict untrusted external assets,
- keep rendering in controlled backend environment for official docs.
