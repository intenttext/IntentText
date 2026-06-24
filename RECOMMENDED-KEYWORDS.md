# Recommended Keywords — Best Practice (SPEC Appendix)

> **This is convention, not vocabulary and not a requirement.** IntentText has an *open*
> keyword set: any word you write before a `:` is a valid, typed, queryable `custom`
> block. Nothing here is reserved, nothing here is mandatory, and **ignoring this list
> never makes a document non-conformant.** It exists for one reason: when teams reach for
> the *same* word for the *same* concept, a folder of `.it` files stays queryable across
> authors — a search for `obligation:` finds obligations everywhere, instead of missing the
> ones someone wrote as `duty:` or `covenant:`.
>
> Appendix to [SPEC.md](SPEC.md). The 41 **reserved** keywords are defined there; this file
> is about the *un*reserved words people use most.

---

## The rule of thumb

1. **Is there a reserved keyword for it? Use that.** Don't reinvent the 41 — see the table
   below. A to-do is `task:`, not `todo:`; a choice already made is `decision:`, not
   `decided:`; a KPI/total is `metric:`, not `kpi:`; a callout is `info:`, not `note:`.
2. **No reserved keyword, but a common concept? Use the conventional word below.** Reach for
   `clause:`, `risk:`, `milestone:` before inventing a synonym.
3. **Genuinely domain-specific? Invent freely.** `cost-of-risk:`, `packing:`, `retention:` —
   that is the open vocabulary working as intended. Just be consistent within your corpus.

## Don't reinvent these — reach for the reserved keyword

| You might be tempted to write | Use the reserved keyword |
| --- | --- |
| `todo:` `action:` `actionitem:` | `task:` |
| `decided:` `choice:` | `decision:` |
| `kpi:` `total:` `figure:` (a number) | `metric:` |
| `note:` `tip:` `warning:` `callout:` | `info:` |
| `heading:` `header:` (a section) | `section:` / `sub:` |
| `paragraph:` `body:` `p:` | *bare prose* (no keyword) or `text:` |
| `table:` `columns:` | `headers:` + `row:` (or markdown `\| … \|`) |
| `signature:` | `sign:` |
| `attachment:` | `attach:` |
| `reference:` `source:` | `cite:` |

## Conventional custom keywords (by domain)

The words below recur across real `.it` documents and the cross-model corpus. Prefer them
over invented synonyms.

**Contracts & legal**
`clause:` · `obligation:` · `warranty:` · `liability:` · `indemnity:` · `term:` ·
`party:` · `jurisdiction:` · `governing-law:` · `penalty:` · `exclusion:` · `definition:`

**Projects & delivery**
`milestone:` · `deliverable:` · `dependency:` · `blocker:` · `scope:` · `objective:` ·
`initiative:` · `assumption:` · `constraint:` · `requirement:` · `risk:`

**Risk, controls & compliance**
`risk:` · `control:` · `finding:` · `mitigation:` · `incident:` · `caution:`

**Service & operations**
`sla:` · `stakeholder:` · `escalation:` · `owner:` *(also a property)*

**Finance & commerce**
`payment:` · `expense:` · `fee:` · `discount:` · `delivery-term:` *(line totals → `metric:`;
itemized lines → `headers:`/`row:`)*

**Agent memory & knowledge**
`fact:` · `entity:` · `preference:` · `belief:` · `question:` · `lesson:` · `guidance:` ·
`skill:` *(a choice already made → reserved `decision:`)*

**Meetings & notes**
`attendee:` · `agenda:` *(action items → reserved `task:`; decisions → reserved `decision:`)*

## Naming conventions

When you do invent a keyword, these keep it queryable and consistent:

- **lowercase**, words joined by **hyphens**: `governing-law:`, `delivery-term:`. (Avoid
  `under_score:` — an underscore stops the keyword from being recognized, so the line
  silently becomes prose; avoid `CamelCase:` for consistency.)
- **singular**, one item per line: `clause:` per clause, not one `clauses:` block.
- name the **concept**, not its appearance: `risk:`, not `red-box:`.
- the word before the `:` must be a **single token** (no spaces) — `delivery-term:`, not
  `delivery term:` (which is read as prose).

## Common property keys (for query interop)

Reusing the same property keys matters as much as the keyword. Conventional keys:

- **who:** `owner:` (responsible party) · `by:` (who performed a recorded action) ·
  `role:` · `assignee:`
- **when:** `at:` (event/approval timestamp) · `due:` (deadline) · `date:` / `issued:` /
  `expires:` — all **ISO 8601** (`2026-07-01`).
- **state:** `status:` · `priority:` · `key:` (a stable id for `input:`/query) ·
  `ref:` (cross-reference)

---

*Non-normative. The conformance bar is in [SPEC.md §8](SPEC.md); this appendix never adds to
it. Found a concept the community keeps re-inventing under different names? That's a
candidate for this list — propose it.*
