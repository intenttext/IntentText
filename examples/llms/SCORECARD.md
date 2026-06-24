# External-LLM Scorecard

Can a frontier model author valid IntentText (`.it`) from **`llms.txt` alone** — no
examples, no fine-tuning, just the reference? We handed `llms.txt` to four models and
ran every file they produced through `@dotit/core` (v2.0.2): parse → conformance
(lax + strict) → render (HTML + print).

## Result

**38 / 39 lax-conformant · 39 / 39 parse · 39 / 39 render · 27 distinct custom keywords invented.**

| Model  | Files | Parse | Lax-conformant | Strict | Renders | Notable open-vocab |
|--------|------:|------:|---------------:|-------:|--------:|--------------------|
| GPT    |     1 |   1/1 |        **1/1** |    1/1 |     1/1 | obligation, deliverable, payment, milestone, jurisdiction |
| Sonnet |     7 |   7/7 |        **7/7** |    6/7 |     7/7 | obligation, sla, warranty, clause, ip-assignment, ip-retained, governing-law |
| Kimi   |    18 | 18/18 |      **18/18** |  14/18 |   18/18 | control, milestone, clause, Capex, Tariff, Degradation, Debt, Equity |
| GLM    |    13 | 13/13 |        12/13   |   6/13 |   13/13 | clause, obligation, warranty, sla, constraint, risk |

Every model parsed and rendered 100% of its output. Three of four were **fully
lax-conformant**. The single failure is a real authoring mistake, not a format gap.

## What this proves

1. **`llms.txt` is sufficient.** Models that had never seen a `.it` file produced
   parseable, renderable, conformant invoices, contracts, dashboards, forms, agent
   workflows and meeting notes — from the reference alone.
2. **The open vocabulary lands.** 27 distinct custom keywords were invented across the
   set — `obligation`, `warranty`, `sla`, `milestone`, `jurisdiction`, `ip-assignment`,
   `governing-law`, `clause`, `Capex`, `Tariff`, `Debt`, `Equity` — exactly the
   "reach for the word your domain uses" behaviour the format is designed to invite,
   with zero alias collisions (aliases were eliminated in 2.0.0).

## The one real failure — GLM `glm8.it`

GLM put the step id in the **content** position instead of as a property:

```
step: id: s-01 | tool: payments.lookup        ← wrong: "id: s-01" is the content
step: Retrieve transaction | id: s-01 | tool: payments.lookup   ← right: id is a property
```

So the ids never registered, and the decision's `then: g-01 / else: g-02` pointed at
ids the parser never saw → `STEP_REF_MISSING`. The fix is the author's, not ours.

## What the harness taught *us* (fixed in core 2.0.2)

The first pass flagged `RESULT_NOT_TERMINAL` on **8 results across 3 models** — every
branched workflow. That was *our* bug: the validator demanded a single trailing
`result:`, but a branched workflow correctly has one terminal `result:` per branch.
The models were right; the validator was naive. Now it only enforces the
"result-must-be-last" rule for **linear** workflows (no `decision:` blocks).
That fix alone moved Kimi 17→18/18 and Sonnet 6→7/7.

## Strict-mode notes (non-blocking — lax is the conformance bar)

The remaining strict warnings are stylistic, not errors:

- **`POLICY_NO_CONDITION` (4×)** — models write `policy:` as a declarative principle
  ("all records must be human-confirmed"). Strict mode prefers an explicit
  `if:`/`always:`/`never:`. Both are reasonable; lax accepts the declarative form.
- **`DEADLINE_PAST` (2×)** — sample dates in the past.
- **`FIGURE_MISSING_CAPTION` (1×)**, **`GATE_NO_APPROVER` (1×)** — minor.

The agent tier (workflows) is where every model works hardest and where almost all
warnings cluster — the natural place to invest the next round of `llms.txt` examples.

---

*Corpus is raw model output, committed warts-and-all as teachability evidence. Re-run
the scorecard with the harness in the repo against `@dotit/core`.*
