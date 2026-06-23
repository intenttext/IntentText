# `.it` corpus swarm — generation + conformance report

A swarm of 18 agents, each simulating an **external LLM that knows only**
[`llms.txt`](../../apps/docs/static/llms.txt), authored one kind of `.it` document. Every file
was then run through the **real `@dotit/core`** (parse · conformance lax/strict · HTML + print
render · seal/verify round-trip · alias-collision + custom-keyword scan). The goal was to test
whether `llms.txt` alone teaches the format well enough to produce correct, idiomatic documents —
and to surface every gap.

## Result: 18 / 18 lax-conformant, render, and seal

| File | blocks | lax | strict | custom keywords invented |
|---|---|---|---|---|
| agent-memory | 76 | ✅ | — | objective, belief, repo-fact, convention, preference, entity, stakeholder, lesson, assumption, openq, watch, decided |
| agent-workflow | 72 | ✅ | — | scope, sla |
| bank-report | 81 | ✅ | ✅ | revenue, cost-of-risk, risk, guidance |
| compliance-policy | 98 | ✅ | — | control, risk, obligation, sla, clause |
| feasibility-study | 71 | ✅ | ✅ | objective, scope, assumption, risk, recommendation, condition |
| fillable-form | 75 | ✅ | ✅ | obligation, sla, risk, warranty |
| invoice-template | 51 | ✅ | — | term |
| invoice | 38 | ✅ | — | purchase-order, sla, warranty, remit |
| meeting-notes | 51 | ✅ | ✅ | agenda, attendee, risk, blocker, expense, milestone, question |
| metrics-dashboard | 96 | ✅ | ✅ | alert, sla, incident, initiative, risk |
| newsletter | 62 | ✅ | — | obligation, risk, sla |
| project-plan | 84 | ✅ | ✅ | objective, dependency, risk, milestone |
| purchase-order | 56 | ✅ | ✅ | delivery-term, packing, inspection, payment, warranty, sla, retention, clause, obligation |
| quotation-ar (Arabic) | 53 | ✅ | ✅ | ضمان, sla, بند, استبعاد, افتراض |
| receipt | 29 | ✅ | ✅ | payment, loyalty |
| services-contract | 126 | ✅ | — | obligation, sla, clause, warranty |
| technical-readme | 107 | ✅ | ✅ | definition, requirement, risk, sla |
| tender-boq | 66 | ✅ | ✅ | assumption, exclusion, warranty, clause, milestone, payment-term |

Every file: parses with **zero unknown-keyword *errors*** (the open vocabulary is conformant by
design), renders to HTML and print, and (where applicable) seals + verifies intact. The agents
reached for domain keywords idiomatically (objective / risk / obligation / sla / control / incident
/ milestone …), exactly as intended — `llms.txt` taught the open vocabulary well.

## What the swarm caught (and what was fixed)

The corpus did its job — it surfaced real issues, all now fixed:

1. **Alias footgun → eliminated entirely (breaking change, core).** Earlier generations silently
   tripped reserved *aliases*: `milestone:`→deadline, `party:`→contact, `rule:`→policy,
   `status:`→signal, `note:`→text, `columns:`→headers, `requirement:`→policy, `warning:`→info … A
   user inventing a natural domain word got a different block than intended. **All 81 Latin aliases
   were removed**; the only reserved words are now the 41 canonical keywords + the namespaced
   extensions, and the 33 **Arabic** names (promoted to first-class localized keywords — they never
   collide with English domain words). Every other word resolves predictably to a `custom` block.
   *(commit `feat(core)!: eliminate all 81 Latin keyword aliases`.)*

2. **`ref:` target property — doc bug.** `llms.txt` taught `ref: … | to: …`, but the validator
   requires `file:` or `url:` (`to:` is for `link:`). Two corpus files tripped `REF_MISSING_TARGET`.
   Fixed in `llms.txt` and the files (`to:`→`file:`).

3. **`figure:` requires `src:` — doc gap.** `llms.txt` listed `figure` but showed no example, so an
   agent used `source:` (attribution) instead of `src:` (the image path). Added a `figure:` example
   with `src:`/`caption:` to `llms.txt`; fixed `newsletter.it`.

4. **`sign:` vs `approve:` (in Arabic).** `quotation-ar.it` used `توقيع:` (sign) for an
   unsigned acceptance line → `SIGN_NO_HASH`. A conformant `sign:` carries a hash (added by
   sealing); pre-seal sign-offs are `approve:` (`اعتماد:`). Fixed the file; the rule was already
   documented in `llms.txt §6`.

## Open item for the maintainer (your call)

**`UNKNOWN_KEYWORD` warning on custom keywords.** Every custom keyword (the encouraged open
vocabulary) still emits an `UNKNOWN_KEYWORD` *warning* from `parseIntentTextSafe`, which the
VSCode extension renders as a squiggle and the curated `check:examples` gate rejects. That is in
tension with "custom keywords are first-class." Options: downgrade `UNKNOWN_KEYWORD` to info
severity, or stop surfacing it as a squiggle. (This corpus lives in `examples/test/`, which is
excluded from `check:examples` precisely because it exercises the open vocabulary by design.)

A handful of files carry **strict-mode** warnings only (e.g. `METRIC_INVALID_TREND`,
`CONTACT_NO_REACH`, `PROSE_PIPE_SUSPECT`, `DATE_NOT_ISO`) — all pass **lax** (the default); strict
is the "spotless publisher" bar.

## Reproduce

```
node <scratchpad>/swarmtest.mjs examples/test     # parse · conformance · render · seal · alias scan
```

The corpus is intentionally **pre-seal** (the agents correctly never fabricated a hash); 3 files
(`agent-memory`, `meeting-notes`, `receipt`) seal + verify cleanly via `sealDocument()`.
