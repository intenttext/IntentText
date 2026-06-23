# Prompts to hand GPT · Sonnet · Kimi · DeepSeek · Gemini

Goal: get each model to generate a `.it` corpus **from `llms.txt` alone**, so we can run the
results through the same `@dotit/core` harness and compare how teachable the format is across
models. Run the **same set** with every model.

---

## Step 1 — give the model the reference (once per chat)

> You are going to author documents in **IntentText (`.it`)**, an open plain-text document format.
> Your ONLY source of truth for the format is this reference — read it fully and follow it exactly:
> **https://dotit.uts.qa/llms.txt**
>
> (If the model can't fetch URLs, paste the contents of `apps/docs/static/llms.txt` instead.)
>
> Rules for everything that follows:
> - One intent per line; follow the line grammar and the §11 generation rules.
> - Use the **open vocabulary** — invent your own domain keywords (clause, risk, obligation, sla,
>   milestone, objective, control, …) wherever no canonical keyword fits. It is first-class.
> - Money: `value: <bare number> | unit: <ISO-4217>`. Dates: ISO 8601.
> - Do **not** invent trust hashes/signatures — use `approve:` for sign-offs; leave docs pre-seal.
> - Output **raw `.it` text only** — no markdown fences, no commentary.

## Step 2 — request each document (one per message)

Use this template, substituting each TYPE + BRIEF from the table:

> Author a complete, substantial, production-quality `.it` document: **{TYPE}**. {BRIEF}
> Output raw `.it` only.

| # | TYPE | BRIEF |
|---|---|---|
| 1 | Corporate invoice | A4 page; running header/footer with `{{page}}/{{pages}}`; a bill-to contact; a line-items table; metric totals (money convention); a payment deadline; theme corporate. Pre-seal. |
| 2 | Software services agreement | Definitions, the two parties, scope, clauses, obligations, warranties, an SLA, IP, confidentiality, governing law, and execution with `route:`/`require:`/`approve:`. |
| 3 | Construction tender + Bill of Quantities | Multi-section costed tables; each section a table + a metric subtotal; a commercial summary + grand total; authorization. |
| 4 | Feasibility study | Executive summary; KPI metrics using `target:`/`trend:`/`period:`; assumptions; a financial-model table; a recommendation callout. |
| 5 | Quarterly bank financial report | Multi-page; page setup; running header/footer with counters; a `toc:`; KPI metrics; balance-sheet tables; page breaks. |
| 6 | POS receipt (80mm roll) | `page: size: 80mm auto`; 2–3 narrow columns; items; totals; payment method; footer note. |
| 7 | Arabic-native price quotation | Written in Arabic keywords (عنوان، قسم، أعمدة، صف، مؤشر، مهلة، اعتماد …), RTL, QAR amounts, ISO dates. |
| 8 | Executable agent workflow | `trigger:` → `step:` (with `tool:`/`id:`) → `decision:` with `then:`/`else:` to real ids → `gate:` → `result:`; plus `policy:`/`audit:`. |
| 9 | AI agent project memory | `meta: type: memory` + open-vocabulary blocks (your own keywords) with `scope:`/`confidence:`. |
| 10 | Vendor onboarding form | `meta: type: form` + `input:` fields (text/select/number/date/attachment) with `key:`/`required:`; one `show-if:`; one computed `compute:`. |
| 11 | Reusable invoice template | `{{placeholders}}` (dot paths); a repeating line-items table via `each:`; header/footer counters. Leave placeholders unresolved. |
| 12 | Meeting notes | Core-tier only: title/section/sub/text/task/done/decision/quote/lists. No trust, no print setup. |
| 13 | Editorial newsletter | x-writer keywords: `byline`, `figure` (with `src:`!), `caption`, `footnote`, `epigraph`, `dedication`; sections, images, quotes. |
| 14 | Technical README / spec | Sections + sub; fenced code; bullet + numbered lists; links; info callouts (`info: … | type: warning`); a config table. |
| 15 | Information-security compliance policy | Aim for **strict** conformance: `policy:`, `audit:`, `cite:`; definitions; ISO dates throughout; a custom `control:` keyword. |
| 16 | Purchase order | Vendor + buyer contacts; line-items table; metric totals; delivery deadline; approval routing where approver `role:` MATCHES the `require:` token. |
| 17 | Project plan | Sections; tasks (owner/due/priority); done items; decisions; schedule table; dated milestones. |
| 18 | Operations KPI dashboard | Many `metric:` cards (`target:`/`trend:`/`period:`) grouped by section; mix currency, %, count units. |

## Step 3 — bring the results back

Save each model's output as `examples/test/<model>/<type>.it` and tell me — I'll run the **same
harness** (`swarmtest.mjs`) over them and produce a per-model conformance scorecard, so we can see
which models the format teaches best and surface any remaining `llms.txt` gaps.

## What "good" looks like (the bar this repo's own swarm hit: 18/18)

- **0** unknown-keyword *errors*; every line parses.
- **lax-conformant** (the default). Bonus: strict-conformant (all dates ISO, no lint warnings).
- Renders to HTML + print without throwing.
- Uses the **open vocabulary** (invented domain keywords) rather than forcing everything into
  `text:`/`info:`.
- Money as `value: <bare> | unit: <ISO>`; sign-offs as `approve:` (no fabricated hashes);
  `ref:` targets in `file:`/`url:`; `figure:` carries `src:`.
