# IntentText `.it` — Format Freeze Roadmap

**Date:** 2026-06-23
**Status:** Pre-v1.0 freeze — actionable plan
**Audience:** Format owner (decision-maker) and core maintainers

## Purpose

This is the sequenced, do-this-then-that plan to freeze the `.it` format **cleanly** and then make it the go-to format for four personas: human authors, AI agents, enterprise, and government/archival.

The verdict is **freeze after blockers** — roughly two to three weeks of tight, surgical work, not "freeze this week." The grammar is genuinely excellent and the trust layer is the most defensible thing in the format. But there is one true integrity bug (T-01) and a cluster of registry-lies-to-itself coherence debts that a v1.0 freeze would cement forever. The dominant lever across this entire roadmap is **removing / renaming / unifying — almost never adding**. The only reserved-surface additions allowed at freeze are three keywords the code already depends on (T-02).

### How to read this document

- It **sequences the themes** identified in `FORMAT-REVIEW.md`. Every item is referenced by a stable theme id (`T-xx`) so the two documents stay in lockstep. Read `FORMAT-REVIEW.md` first for the full per-theme evidence and verification; read this for the order of operations.
- **Relationship to `IMPROVEMENT-PLAN.md`:** that document is the **security / enterprise-readiness** track (hardening, deployment, operational maturity). **This document is the format-design track** — what the bytes, keywords, and spec must look like the moment they freeze. The two are complementary and largely independent; where they touch (e.g. conformance tooling, archival profiles) it is called out.
- Sections are ordered: the freeze gate (the centerpiece) → the full phased roadmap → the exact naming edits → per-persona enablement → guardrails → a milestone checklist.

A decision flagged **`[OWNER]`** cannot be made by a maintainer — it commits a reserved name, a parse semantic, or a hashed-byte behavior, and is the owner's call. Everything else is a maintainer task with a clear correct answer.

---

## 1. Status — where we are (updated 2026-06-23)

**Reserved keyword count is now 41** (was 38): `route`, `require`, `certify` reserved (T-02). The everyday **core stays 13**. A CI gate (`KEYWORD_COUNT === 41` in `check-keyword-consistency.cjs`) now fails the build on any drift, and `parity:check` keeps the VSCode grammar in lockstep.

> **The one number story (use this everywhere): 13 core · 41 reserved canonical · open-ended custom.**
> *13* = the everyday core tier. *41* = the full reserved/canonical set tools recognize. Every other count in any doc (37, 38, "~40", "over 40") is **stale** and is removed in the documentation sweep (Milestone D).

**Landed and verified** — full `pnpm check` green (build · 1304 tests · keywords:check 41 · parity:check 41 · pack:check):

| id | What shipped | Status |
|----|--------------|--------|
| **T-01** | `change`→`amendment` seal hole **closed**; guard test forbids any hash-excluded trust keyword (`amendment`/`certify`) from aliasing a common prose word; grammar + trust docs synced | ✅ integrity fix done |
| **T-02** | `route`/`require`/`certify` reserved (registry + `BlockType` + tiers); `route`/`require` render as a live **approval-route panel**; `certify` joins the trust band; round-trip + hash + render tests | ✅ done |
| **T-03** | `input`/`output` promoted out of experimental `x-exp` → stable **`x-form`** namespace (metadata-only, byte/hash-identical) | ✅ done |
| **T-04** | Optional **`// it-format: 1.0`** version stamp (hash-excluded comment) → `document.version`; sniffed level → `document.detectedFeatureLevel` | ✅ done |
| **T-06** | Count reconciled to **41** + `KEYWORD_COUNT` CI assertion so it can never silently drift again | ✅ code + gate done · lead-with-13-core doc restructure → Milestone D |
| **T-10** | `headers` promoted to **canonical**, `columns` demoted to compat-only alias (matches the serializer; round-trip byte-stable) | ✅ done |
| **T-14** | `info`-as-callout documented in SPEC (decision: **document, don't rename**); `done:` demotion rejected | ✅ decision done · dead `divider` tier-override + `figure` alias prune fold into T-07 |

**Remaining freeze-gate (P0):**

| id | What's left | Kind |
|----|-------------|------|
| **T-05** | Part A: one money convention across examples · Part B: reserve a typed-value shape | corpus · **`[OWNER]`** (Part B) |
| **T-11** | One temporal + one actor property key; fix the unsealed teaching corpus | corpus |
| **T-15** | Lift the `if:`/`filter:` condition grammar into SPEC from the code | doc |
| **T-17** | Fix SPEC↔code contradictions; drop the dead continuation rule; document positional `meta:` | doc (+ tiny code) |
| **T-20** | Part 2: document `;` vs ` \| ` + lints · Part 1: prose-pipe recovery softening | doc · **`[OWNER]`** (Part 1) |

**Two `[OWNER]` decisions still open:** T-05B (typed-value shape) and T-20-1 (prose-pipe parse softening). Everything else remaining is documentation/corpus.

> **The big remaining piece is the documentation-accuracy sweep — Milestone D.** Every publicly accessible file (`README.md`, `AGENTS.md`, the published `llms.txt`, `SPEC.md`, the keyword reference, the docs site, `CHANGELOG`) reconciled to one accurate story — **13 core / 41 reserved, SEAL_SPEC 4, no stale claims** (e.g. AGENTS.md's false "seal hashes exact bytes" line, the stale EN16931 note). Deferred by owner until the format work lands; it is the **last gate before freeze**.

The detailed gate analysis in §2–§3 below is the **original pre-work assessment** (kept for evidence/traceability); where it still says "38" or describes a done item as pending, §1 above is authoritative.

---

## 2. The freeze gate (P0) — must decide before v1.0

This is the centerpiece. Each item below is either **impossible to walk back cleanly after launch** (a rename, registry membership, parse semantics, or a hashed-byte change) or it is the **one true integrity bug**. Nothing here adds reserved surface except the three keywords the code already reads.

The window is open **only because no public corpus is sealed yet**. Once a corpus is sealed, both narrowing and widening the reserved boundary mutate hashed bytes — the door closes.

### 2a. Freeze-blockers

| # | id | Blocker | Concrete action | Owner flag |
|---|----|---------|-----------------|------------|
| 1 | **T-01** | **The one true integrity bug.** `change:` is an alias of `amendment` (`language-registry.ts:398`); `leadKeyword` resolves through `ALIAS_MAP` (`trust.ts:48-52`) and the content hasher drops amendment/certify lines (`trust.ts:64`). So a plain English `change: we updated the logo` resolves to `amendment` and is **silently dropped from the sealed content hash** — content a seal claims to cover but does not. | Drop English prose-colliding aliases to passthrough (`info`: alert/caution/critical/destructive/hint/advice; `text`: note/body/content/paragraph; `cite`: source; `amendment`: **change**; `EXTENSION_LEGACY_ALIASES`: by/status/see/term…). **Keep every Arabic/Unicode alias.** Add SPEC §5 clause: the frozen contract is the set of rule-5 lead-words; words may only move **toward** passthrough in a major version, never away. Add a warning-only diagnostic for short-content custom blocks whose keyword is a common English word. **Never alias a trust-category keyword to a common prose word.** | Maintainer (rule is fixed); the *boundary clause* in SPEC is `[OWNER]` |
| 2 | **T-02** | **Registry denies keywords the code depends on.** `certify` is special-cased in `trust.ts:64`; `route`/`require` are read by `workflow-state.ts` `extractRoute`. None are in `LANGUAGE_REGISTRY` or the `BlockType` union — they parse as `custom`. Half-in/half-out is the one unacceptable freeze state. | Add `certify` (category:trust), `route`, `require` (category:agent/contract) to `LANGUAGE_REGISTRY` and the `BlockType` union. Update `workflow-state.ts:78` from `(type==='custom' && keyword==='route')` to typed. **Leave** `requirement` (policy alias) and `verify` (assert alias) untouched. Tests: `route:`/`require:` change still changes `computeDocumentHash`; round-trip byte-identical before/after promotion; no canonical/alias collision. Seal matches **raw source line prefixes**, so promotion provably does not move the hash. | Maintainer |
| 3 | **T-03** | **The only typed-parameter primitive is stamped "experimental"** at the moment you tell adopters to build on it. `input`/`output` (the `type:`/`required:`/`options:`/`compute:` primitive, 2nd-most-used keyword in the corpus) sit in the `x-exp` namespace. | Move `input`/`output` to a stable namespace (recommend `form`) in `EXTENSION_REGISTRY`. Keep `assert`/`secret` in `exp`. Do **not** change the bare keyword strings or add to `EXTENSION_KEYWORDS`. Add a round-trip + seal-stability regression test pinning byte+hash identity (verified metadata-only — namespace never reaches block output or the hash). State in SPEC that the reserved typed-value model (T-05) is the reserved counterpart of `input`'s `type:`/`compute:` — one type system. | Maintainer |
| 4 | **T-04** | **No on-disk format-version stamp.** A 2035 reader cannot know which grammar a file claims; version is feature-sniffed (`parser.ts:1969-1989`). **The obvious fix is unsafe:** `meta:` **IS** hashed (verified — only page/font/style + presentation props + comments + trust lines are excluded), so writing `meta: \| format: 1.0` into a sealed doc invalidates its seal. | **`[OWNER]` DECISION** between **(A)** reserve a `meta` sub-key, add it to the hash-excluded set via a **SEAL_SPEC v5 bump** with a new frozen `CANONICALIZERS[5]` + pinned vector (do **not** touch v4); or **(B)** a hash-excluded magic comment `// it-format: 1.0` (comments already excluded every spec, zero spec bump). Either way: parse the stamp into `IntentDocument.version`, rename the sniffed level to `detectedFeatureLevel`, keep it **optional**, never add a top-level keyword. | **`[OWNER]`** |
| 5 | **T-05** | **Every business number is an opaque string** and the flagship examples model money two incompatible ways (`16,500 QAR` vs `250000 \| unit: USD`). Part A is cheap; Part B reserves enterprise vocabulary shape that is hard to retrofit. | **Part A (do now):** pick ONE money convention — bare number (no separators) + ISO-4217 in `unit:` (`value: 16500 \| unit: QAR`), the form `einvoice.ts` already wants — and apply across all examples. **Part B `[OWNER]`:** reserve a **read-side** typed-value shape (`number` + currency in `unit:`; column hints on the hashed `columns/headers` line; cells stay verbatim strings). **Never mint a `money` type** — `FORM_FIELD_TYPES` has none. Source string stays the byte-of-record; typing is never re-serialized. | Part A: maintainer. Part B: **`[OWNER]`** |
| 6 | **T-06** | **The published keyword count contradicts itself in the source-of-truth file** — "exactly 37" (`language-registry.ts:546`) vs `KEYWORD_COUNT` computes 38 (`:552`). Reads unserious to spec-scrutinizing buyers; painful to walk back after a marketing freeze. | Code is correct at **38** — fix the stale 37s (`registry:2,7,67,455,595`). Add `KEYWORD_COUNT===38` assertion to `scripts/check-keyword-consistency.cjs` (~2 lines). Open `AGENTS.md` and `keywords/index.md` with the curated **13-core** table + one sentence; demote the 38-row table to a reference appendix. Keep the curated 13-core (not a mechanical tier dump — `divider` is a compat-only core override invoked as `---`). | Maintainer |
| 7 | **T-10 / NAME-table** | **The format ships an alias as its de-facto canonical output.** The registry blesses `columns` (canonical/stable, **zero adoption**) while the serializer actually persists `headers:`/`row:` (`source.ts:385-386`, verified by `markdown.test.ts:77`). Renaming a canonical is pre-freeze-only. | **Promote `headers`→canonical/stable, demote `columns`→compat-only alias** (Option A — no serializer change, zero byte-drift). Update `SPEC.md:125` `columns`→`headers`. Keep `headers:`/`columns:`/markdown-pipes/Arabic `أعمدة`·`صف` all accepted as input. Bless markdown `\| … \|` as the canonical **authoring** form; state it normalizes to the keyword form on first save. | **`[OWNER]`** (naming) |
| 8 | **T-11 / NAME-corpus** | **The teaching corpus contradicts itself** on money, tables, and property keys (`time` vs `at`, `owner` vs `by`). `time:` is not even on `SPEC.md:73`'s ISO list yet ships in a flagship example. Authors and agents learn by copying these. | Document ONE temporal key per role and ONE actor key in SPEC §2; add `time` to `SPEC.md:73`'s ISO list **or** drop it from examples. Hand-edit only **unsealed** files — do **not** touch `contract-sealed.it`'s hashed body. Re-seal example artifacts to `spec:4` (see T-18). Runtime property-key aliasing is additive-later; the **editorial** track is the freeze-blocking part. | Maintainer (editorial); key choice `[OWNER]` |

### 2b. Freeze-blocking decisions that are owner calls (collision / parse-semantics)

These do not add the three reserved keywords; they decide naming and parse boundaries that can only be set once.

| id | Decision | Recommendation | Owner flag |
|----|----------|----------------|------------|
| **T-14** | Reserved-name collisions and core/extension blur. | **Do now (safe):** remove the dead `divider: 'core'` `TIER_OVERRIDES` entry (skipped anyway); document `info`-as-callout in SPEC once (do **not** rename `info`→`callout`); prune `figure`'s 5 aliases to `fig`. **Reject:** `done:`→`task: \| status: done` (re-serializes hashed body, breaks seals). Optional `[OWNER]`: `header`/`footer` → `page-header`/`page-footer` *aliases* (not renames). | **`[OWNER]`** for the rename-vs-document calls |
| **T-17** | Spec/code self-contradictions in the canonical grammar. | Drop the never-implemented continuation rule from SPEC §2 (no parser honors it). Fix the category count (7-member enum vs "eight categories" docs). Footnote `revision`/`history` in the contract table as machine-managed, not tier members. For positional `meta:`/`agent:`/`model:` (lift before first section, render after): **document the rule** — do **not** switch to always-lift (that changes hashed bytes for mid-document `meta:`). | **`[OWNER]`** for the positional-meta call |
| **T-15** | The executable condition mini-language is unspecified. | Lift the `if:`/`filter:` grammar into SPEC **from the code, not the doc**: operators `== != < > <= >= && ||` with `( )` grouping; **no `!` operator** (the doc is wrong); loose `==`, numeric coercion for comparisons; `{{dotted.path}}` refs with pollution guards. Mark additive-only post-freeze. Defer `call:`/`import:`/`handoff:` as reserved-unspecified (inert stubs today — no path-traversal surface exists yet). | Maintainer (spec from code) |
| **T-20** | `;` (inline span) vs ` \| ` (block) separator asymmetry. | **Part 2 (do now, safe):** document the asymmetry prominently; lint a `\|` typed inside `{…}`; document the content-less `keyword: \| key: value` form; lint bare prose pipes suggesting `\\\|`. **Part 1 `[OWNER]`:** softening prose-pipe recovery is a **parser-semantics change** that shifts the content/property boundary — a cross-version hash hazard. Prefer to solve the pain with the Part-2 lint and defer Part 1 unless explicitly accepted. | **`[OWNER]`** for Part 1 |

---

## 3. Phased roadmap

### P0 — Freeze gate

**Goal:** Lock the reserved boundary small, prose-safe, and **honest**; close the one true seal hole; make every breaking decision (renames, registry membership, parse semantics, hashed-byte changes) **now** because they are impossible to make cleanly after launch. Nothing in P0 adds reserved surface except the three keywords the code already depends on.

| id | Title | Effort | Personas |
|----|-------|--------|----------|
| T-01 | Trim prose-colliding aliases + close change→amendment seal hole | L | human, ai, enterprise, gov |
| T-02 | Reserve `certify`, `route`, `require` | M | enterprise, gov, ai |
| T-03 | Promote `input:`/`output:` out of x-exp (metadata-only) | S | ai, enterprise |
| T-04 | Decide format-version stamp: SEAL_SPEC v5 exclusion OR magic comment | M | gov, enterprise, ai, all |
| T-05 | Money convention now (Part A) + owner call on typed-value shape (Part B) | L | enterprise, gov, ai |
| T-06 | Reconcile count to 38 + CI assertion; lead with 13-core | M | all, human, enterprise |
| T-10 | Promote `headers`→canonical, demote `columns`→compat-only | M | all, human, enterprise |
| T-11 | Document canonical property-key vocabulary; fix unsealed corpus | M | human, enterprise, all |
| T-14 | Remove dead divider override; doc info-as-callout; prune figure aliases; reject done demotion | M | all, human, enterprise |
| T-15 | Lift condition mini-grammar into SPEC from the code | M | ai |
| T-17 | Fix spec/code contradictions; document positional `meta:`/`agent:`/`model:` | M | all, ai, enterprise, gov |
| T-20 | Document `;` vs `\|` asymmetry (do); owner-gate prose-pipe recovery softening | S | human, ai |

### P1 — Pre-launch polish

**Goal:** Make the docs and teaching corpus as disciplined as the registry. **Every P1 item is a doc / wording / example / lint change with zero grammar or hash impact** — but they protect the most defensible competitive claim (offline-verifiable trust) from looking unmaintained. Extend `parity:check`-style CI to assert doc literals.

| id | Title | Effort | Personas |
|----|-------|--------|----------|
| T-08 | Sync all docs to SEAL_SPEC=4 + CI doc-lint | S | ai, enterprise, all |
| T-13 | Lock intersection positioning; fix `AGENTS.md` false "exact bytes" seal claim; headline UBL | S | all, enterprise, gov, ai |
| T-07 | Prune alias sprawl (reclassify-not-delete for semantic aliases) | M | human, enterprise, gov, ai |
| T-18 | Re-seal examples to spec:4 + CI verify guard | S | enterprise, ai, human |
| T-16 | Name conformance in SPEC §8; expose strict mode | S | enterprise, gov, ai |

### P2 — Persona breadth

**Goal:** Deepen the AI-agent and gov/archival stories where the freeze must **reserve names now** but implementation is additive. These are owner decisions because they touch observable contract surfaces or naming that should only be chosen once.

| id | Title | Effort | Personas |
|----|-------|--------|----------|
| T-09 | Unify agent self-description parse shape; `input:`-composed tool manifests; pin `context:`; rename task category | M | ai |
| T-12 | Reserve archival metadata key set + `archive` profile name (read-time, naming-only) | L | gov, enterprise |

### P3 — Long-horizon

**Goal:** Reserve conventions whose absence is a latent gap but whose implementation can wait. Name now to prevent property-name drift; implement when a real need lands.

| id | Title | Effort | Personas |
|----|-------|--------|----------|
| T-19 | Reserve `sha256:`/`fixity:` + recommended `rel:` vocabulary + provenance keys | M | gov, enterprise |

---

## 4. Keyword & naming decisions

The exact edits to `packages/core/src/language-registry.ts` and `packages/core/SPEC.md`. **Freeze-blocking = true** means it cannot wait until after v1.0.

| Topic | Current | Recommendation | Rationale | Freeze-blocking |
|-------|---------|----------------|-----------|:---:|
| Trust-category aliases to prose words | `amendment` has alias `change` | **Drop `change`**; rule that no trust keyword (sign/approve/freeze/track/amendment/certify) may ever alias a common English word | Verified seal hole: `change:`→amendment is silently excluded from the content hash (`trust.ts:48-52`, `:64`) | **yes** |
| `certify` / `route` / `require` membership | Absent from registry & `BlockType`; parse as custom; read by core via raw-line match | **Reserve all three** (`certify`→trust; `route`/`require`→agent/contract). Leave `requirement`/`verify` aliases untouched | Registry must not deny keywords the seal/workflow code depends on. Raw-line match → promotion can't move the hash | **yes** |
| `input` / `output` stability tier | Namespace `exp` | Move to stable namespace (`form`); keep `assert`/`secret` in `exp` | The only typed-parameter primitive cannot be "experimental" at v1.0. Verified metadata-only | **yes** |
| Published keyword count | `:546` "exactly 37" vs `:552` computes 38 | Standardize on **38**; fix stale 37s; add `KEYWORD_COUNT===38` CI assertion; lead all on-ramps with 13-core | A marketing number that contradicts the source-of-truth file is painful to walk back and reads unserious | **yes** |
| Canonical table keyword | Registry blesses `columns` (zero adoption); serializer persists `headers:`/`row:` (`source.ts:385`) | **Promote `headers`→canonical, demote `columns`→compat-only** (Option A: no serializer change). Keep all input forms | The format ships an alias as its de-facto canonical output; `headers:` also reads correctly (header *cells*, singular `row:` partner). Renaming a canonical is pre-freeze-only | **yes** |
| Money / currency convention | `16,500 QAR` (invoice.it) vs `250000 \| unit: USD` (routed-approval.it) | `value: 16500 \| unit: <ISO-4217>` everywhere | The only arithmetic-friendly form; `einvoice.ts` `parseAmount` exists solely to undo the embedded form | **yes** |
| Typed-value / column-type shape (Part B) | Every number is an opaque string | Reserve a read-side shape using `number` + ISO-4217 in `unit:`; column hints on the hashed `columns`/`headers` line. **Do not mint a `money` type** | One type system reusing `input`'s `number`/`date` vocabulary; reserving the shape is hard to retrofit post-freeze | **yes** `[OWNER]` |
| Temporal + actor property keys | `time`/`at`/`date`/`due` and `owner`/`by`; `time` not in `SPEC.md:73` | Pick ONE temporal key per role and ONE actor key; reconcile the ISO-date list | Exact-key query lookup silently misses rows on the wrong key; a v1.0 corpus must not teach contradictions | **yes** (editorial) |
| Format-version stamp mechanism | None; sniffed from feature blocks (`parser.ts:1969`) | **`[OWNER]`:** (A) reserved `meta` sub-key + SEAL_SPEC v5 hash-exclusion, or (B) hash-excluded magic comment. **Not** a plain `meta:` line (`meta` IS hashed) | Self-description is the #1 OAIS criterion, impossible to retrofit; the naïve fix breaks seals | **yes** `[OWNER]` |
| `divider` tier override | Dead `divider: 'core'` `TIER_OVERRIDES` entry | Remove it; keep `---` as the sole authored syntax; keep `divider`/`hr`/`separator` recognized for compat | Pure dead-code cleanup, zero observable effect | no |
| `info` as the callout canonical | `info` is canonical but SPEC never states it | **Document** info-as-callout once; present `note`/`tip`/`warning` as primary authoring forms. Do **not** rename `info`→`callout` | Rename forces every existing `info:` line to alias-emit for zero seal benefit | no |
| `figure` extension aliases | `figure` carries 5 aliases (fig/diagram/chart/illustration/visual) — more than reserved `image` | Prune to `fig`; do not promote unless numbered figures are a marketed need | A heavily-aliased extension shadowing a reserved keyword inverts the "reserved = important" signal | **yes** |
| `done` demotion | Proposal to serialize as `task: \| status: done` | **Reject** — keep `done`; document as task's terminal form | `done:` content is hashed body; re-serializing breaks seals. (`[x]` already maps to task+status:done at `parser.ts:1015`) | no |

---

## 5. Per-persona enablement tracks

Short tracks naming the format capabilities that unlock each persona. The four personas all benefit from P0 honesty; these are the persona-specific levers beyond it.

### AI-agent adoption

The genuine differentiator is the **executable, hash-chained workflow core** (`step`/`decision`/`gate`/`trigger`/`result` → `executeWorkflow`) with in-file approval state that is tamper-evident **offline** — something `SKILL.md`, `agents.md`, and MCP manifests carry no integrity layer for.

- **P0:** Promote `input`/`output` out of experimental (T-03) — agents must build on a stable typed-parameter primitive. Lift the condition mini-grammar into the frozen SPEC from the code (T-15) so an independent evaluator can reproduce branching deterministically. Reserve `route`/`require` (T-02).
- **P2:** Unify the agent self-description parse shape (T-09) — today `agent:`/`model:`/`tool:`/`memory:` parse to three different shapes; express typed tool parameters by composing the existing `input:` keyword as child lines (no new schema syntax); pin or demote `context:`.
- **Headline:** "every word can be a keyword; only 13 are reserved" + a tamper-evident workflow no agent-manifest format has.

### Enterprise adoption

The shipped `einvoice.ts` EN16931/UBL bridge (1.24.0) and the contract/quotation/invoice lifecycle vocabulary are professional and real; the moat is `route:`/`require:` in-file approval routing.

- **P0:** Reserve `route`/`require` (T-02) — the approval moat must be in the registry, not an unreserved extension. One money convention (T-05 Part A) and the reserved typed-value shape (Part B) so totals become verifiable. Settle the canonical table form (T-10).
- **P1:** Lock positioning on the intersection moat and headline UBL (T-13); fix `AGENTS.md`'s false "exact bytes" seal claim.
- **Headline:** "your sealed `.it` invoice exports to EN16931/UBL — the format PEPPOL and ZATCA mandate," plus restyling never breaks a seal.

### Government / archival adoption

The plain UTF-8/NFC/LF zero-dependency core, the convert-your-archives on-ramp, and per-seal `CANONICALIZERS` versioning are strong longevity stories. The gaps are self-description and an archival profile.

- **P0:** Decide the self-describing format-version stamp (T-04) — the #1 OAIS criterion, impossible to retrofit onto an archived corpus.
- **P2:** Reserve a thin Dublin-Core-aligned archival metadata key set (creator/created/rights/language/identifier/retention/classification/series) + the `archive` profile name (read-time, naming-only); converter provenance keys (T-12). **Note:** `meta` IS hashed, so `author`→`creator` mapping must be read-time-only and the profile declared **before** sealing.
- **P3:** Reserve `sha256:`/`fixity:` over external resource bytes (T-19) — a real tamper gap (a swapped signature image behind `image:` does not break the seal today). **Fixity is content, never presentation.**
- **Headline:** offline-forever-verifiable, self-describing, zero-dependency plain text with a validatable `archive` conformance level.

---

## 6. What NOT to do — guardrails to protect elegance

These protect the small-reserved-set and offline-trust strengths that are the entire point of the freeze.

- **Do NOT add ~20 keywords to "round out" the format.** The dominant freeze lever is removing/renaming/unifying. The only additions allowed at freeze are `certify`/`route`/`require` — keywords the code already depends on. Adding reserved surface is a failure of nerve, not a feature.
- **Do NOT write the format-version stamp as a plain `meta: \| format: 1.0` line.** `meta:` IS in the content hash (verified) — it would invalidate every existing seal. Use a SEAL_SPEC v5 exclusion or a hash-excluded magic comment.
- **Do NOT make `done:` serialize as `task: \| status: done`.** `done:` is hashed body content; re-serializing breaks seals over any doc containing `done:` lines.
- **Do NOT rename any canonical keyword that forces existing docs into alias-emit churn for zero seal benefit** (e.g. `info`→`callout`). Document the canonical instead.
- **Do NOT delete parser-driven semantic aliases** (`info`'s alert/caution, `cite`'s source). That silently demotes existing typed blocks to `custom`. Reclassify them to compat-only. Delete **only** prose-collision aliases (`by`, `status`).
- **Do NOT touch SEAL_SPEC=4's styling exclusion** (`PRESENTATION_PROPS` / `PRESENTATION_LINE_KEYWORDS`) when fixing keyword classification — they are orthogonal.
- **Do NOT remove or weaken any Arabic/Unicode-script alias** — RTL/Unicode keywords are load-bearing and a marketed differentiator.
- **Do NOT "simplify" the per-seal SEAL_SPEC versioning / `CANONICALIZERS` registry.** It is what guarantees a historical seal can never silently break. Lock it as an invariant.
- **Do NOT adopt the prose-pipe recovery softening (T-20 Part 1) silently** — it shifts the content/property boundary in the AST, a cross-version hash hazard. Owner-gate it or solve the pain with a lint.
- **Do NOT classify fixity properties (`sha256:`/`fixity:`) as presentation** — they MUST stay inside the content hash or they are forgeable.
- **Do NOT re-seal `fixtures/trust.it` blindly** — it is a parser fixture with a paired golden `trust.json` snapshot; re-sealing without regenerating the snapshot breaks the test.
- **Do NOT remove the README EN16931/UBL claim** — it shipped in 1.24.0 (`einvoice.ts`, tested). It is the **assessment** that is stale; fix the assessment and headline the moat.
- **Do NOT promote `contact:`/`deadline:`/`party`/`figure` to the reserved core to look "complete"** — that bloats the small-reserved-set strength. Business party/date semantics ship via the stable `x-doc` profile.

---

## 7. Sequenced next steps

Milestone-ordered checklist to reach freeze and the first marketed release.

### Milestone A — Owner decisions (gate everything else; ~days 1–2)

- [ ] **`[OWNER]` T-04:** Choose the format-version stamp mechanism — **(A)** SEAL_SPEC v5 meta-key exclusion or **(B)** hash-excluded magic comment.
- [ ] **`[OWNER]` T-05 Part B:** Approve reserving the read-side typed-value shape (`number` + currency in `unit:`), or defer with a SPEC direction note.
- [ ] **`[OWNER]` T-10:** Confirm `headers`→canonical / `columns`→compat-only (Option A).
- [ ] **`[OWNER]` T-11:** Pick the canonical temporal key per role and the single actor key.
- [ ] **`[OWNER]` T-14:** Decide rename-vs-document for `header`/`footer` and `info`; confirm reject of `done` demotion.
- [ ] **`[OWNER]` T-17:** Confirm "document positional `meta:`" (not always-lift).
- [ ] **`[OWNER]` T-20:** Decide whether prose-pipe recovery softening (Part 1) is in or deferred.

### Milestone B — Close the integrity hole + reserve the honest minimum (P0 core; ~days 2–6)

- [ ] **T-01:** Drop English prose-colliding aliases (keep all Arabic). Add the SPEC §5 boundary clause + the short-content warning diagnostic. *This unblocks sealing a public corpus.*
- [ ] **T-02:** Reserve `certify`/`route`/`require`; update `workflow-state.ts:78`; add hash/round-trip/collision tests.
- [ ] **T-03:** Move `input`/`output` to the `form` namespace; add the byte+hash regression test.
- [ ] **T-04:** Implement the chosen stamp mechanism; wire `IntentDocument.version`; rename sniffed level to `detectedFeatureLevel`.

### Milestone C — Honest registry + spec + corpus (P0 remainder; ~days 6–10)

- [ ] **T-06:** Fix the 37s → 38; add the `KEYWORD_COUNT===38` CI assertion; lead docs with the 13-core.
- [ ] **T-10:** Promote `headers`; update `SPEC.md:125`.
- [ ] **T-05 Part A:** Apply the single money convention across all examples.
- [ ] **T-11:** Document the canonical property-key vocabulary; reconcile the ISO-date list; hand-edit unsealed examples.
- [ ] **T-14:** Remove the dead divider override; document `info`-as-callout; prune `figure` aliases.
- [ ] **T-15:** Lift the condition grammar into SPEC from the code.
- [ ] **T-17:** Drop the continuation rule; fix the category count; footnote `revision`/`history`; document positional `meta:`.
- [ ] **T-20 Part 2:** Document the `;` vs `\|` asymmetry; add the `\|`-in-`{}` lint.
- [ ] **Gate:** run the property-based round-trip + seal-stability gate; all green.

### Milestone D — Documentation-accuracy sweep (the last gate before freeze; ~days 10–14)

**Owner mandate:** every publicly accessible file states **one accurate story — 13 core · 41 reserved canonical · open-ended custom, SEAL_SPEC 4 — with ZERO stale or contradictory claims.** Simplify the prose freely, but nothing inaccurate ships. Audit each file; *remove or correct* stale info rather than leaving it:

- [ ] `README.md` — keyword counts, feature claims, version refs, install/usage.
- [ ] `AGENTS.md` / published `llms.txt` — keyword set (41, incl. route/require/certify); **fix the false "seal hashes exact bytes / reformatting breaks it" claim** (SEAL_SPEC 4 excludes styling and normalizes line endings); approval-policy section; trust model.
- [ ] `packages/core/SPEC.md` — now 41 + version-stamp §5.2 + callout/routing notes; finish T-15 (condition grammar), T-17 (contradictions, dead continuation rule, positional `meta:`), T-20-2 (separator asymmetry).
- [ ] `apps/docs/**` — keyword reference, trust-spec, blog, guides: counts, SEAL_SPEC, route/require/certify, input/output→`x-form`, headers-canonical.
- [ ] `CHANGELOG.md` — record the 4.4 freeze work.
- [ ] `assessment/ASSESSMENT.md` + `IMPROVEMENT-PLAN.md` — refresh the stale SEAL_SPEC v3 and "EN16931 grep finds zero" lines.
- [ ] Root `ARCHITECTURE.md`, `INTEGRATION.md`, `PRIVACY.md`, `SECURITY.md` — version/feature accuracy.
- [ ] Lead every on-ramp with the curated **13-core**; demote the full 41 to a reference appendix (T-06 doc half).
- [ ] **T-08 (the durable guarantee):** add doc-lint CI that asserts the count + SEAL_SPEC literals across docs, so "no stale info" can never silently regress.
- [ ] **T-13:** lock intersection positioning; headline UBL/PAdES.
- [ ] **T-07:** reclassify semantic aliases to compat-only; delete only prose-collision aliases (+ the deferred dead `divider` tier-override and `figure` alias prune from T-14).
- [ ] **T-18:** re-seal example artifacts to `spec:4` (treat `fixtures/trust.it` + its golden separately); CI verify guard.
- [ ] **T-16:** name conformance in SPEC §8; expose strict mode (read-only over `validateDocumentSemantic`).

### Milestone E — Freeze + first marketed release

- [ ] Tag the SPEC as **IntentText 1.0**; stamp `SEAL_SPEC` (v4, or v5 if T-04 path A).
- [ ] Verify all example seals verify intact under the released core; CI guard active.
- [ ] Publish the marketed strengths: 13-keyword core + open extensibility; offline-forever-verifiable trust; sign-content-not-presentation; native RTL/Unicode; lossless text↔JSON; executable hash-chained workflow; UBL/PAdES bridges.

### Milestone F — Post-freeze persona breadth (P2/P3; additive)

- [ ] **T-09**, **T-12** (reserve names at freeze if not already), **T-19** — implement against the reserved names; all additive, no hashed-byte impact.
