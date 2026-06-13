# Examples

Render any file with `node cli.js examples/<file>` (add `--print` for paged, PDF-ready HTML).

- `invoice.it` — English invoice: pipe tables, `metric:` totals, `end:` two-sided rows, `page:`/`header:`/`footer:` print chrome.
- `quotation-ar.it` — full Arabic quotation (عرض سعر) written with Arabic keywords; ISO dates, bidi-safe values, RTL rendering.
- `contract-sealed.it` — sealed service agreement: `approve:`, `sign:`, `freeze:` carrying a real SHA-256 hash — `node cli.js verify examples/contract-sealed.it` passes.
- `project-tasks.it` — launch plan: `task:`/`done:`/`deadline:`/`metric:` with owners and ISO due dates; try `--query "type=task priority=high"`.
- `expense-report-template.it` + `expense-report-data.json` — template and data pair: `each:` row loop, merged with `--data`.
- `styling-demo.it` — `style:` rules, `leading:`/`space-before:`/`space-after:`, inline `[text]{ … }` spans, print watermark.
- `templates/` — ready-to-merge document templates (invoice, contract, report, and more).
- tender-boq.it — tender submission: Bill of Quantities (multi-table), commercial summary, submittals, approval + signature
- feasibility-medad.it — full feasibility study (Medad Ink Factory for QDB): `toc:`, 7 sections, KPI `metric:` cards, 16 financial tables (5-yr P&L, cash flow, balance sheet, DCF, sensitivity, risk matrix), `info:` callouts, `def:` glossary, A4 print chrome with `break:` pagination.
