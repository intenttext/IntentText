# IntentText (.it) — Pre-Freeze Format & Language Design Review

*The final design review of the `.it` format and its reserved vocabulary before a v1.0 freeze. Prepared 2026-06-23 for the format owner. Every finding below is grounded in code review and executed verification, cited by `file:line` and by stable theme id (T-xx).*

> **Scope note.** This document complements — it does not replace — the existing [`ASSESSMENT.md`](./ASSESSMENT.md) (engine/ecosystem/ERP-fit verdict, 2026-06-19) and [`IMPROVEMENT-PLAN.md`](./IMPROVEMENT-PLAN.md). Those judge the *business and engine*. This judges the **format and the language** — the grammar, the reserved-keyword boundary, the vocabulary you are about to lock forever, and how it serves the four audiences who will read and write `.it`. Where the older ASSESSMENT and this review disagree on facts (notably the SEAL_SPEC version and the styling-exclusion forgery vector), this review is current: SEAL_SPEC is now **4**, the appearance hash and CRLF/whitespace canonicalization shipped, and those v3 bugs are resolved. The ASSESSMENT's EN16931/UBL "grep finds zero support" line is likewise stale — that capability shipped in 1.24.0.

---

## 1. Executive verdict

**FREEZE AFTER BLOCKERS.** Do not freeze this week. Freeze in roughly two to three weeks, after a tight, surgical P0 gate. The grammar is genuinely excellent and the trust layer is the most defensible thing in the format — but there is one true integrity bug and a cluster of *registry-lies-to-itself* coherence gaps that a v1.0 freeze would cement forever. The spine of the work is small and almost entirely about **removing, renaming, and unifying** — not adding. If anyone proposes adding fifteen keywords to "round out" the format, that is a failure of nerve, not a feature. The only additions permitted at freeze are three keywords the core code already depends on (T-02).

**The one finding that changes the risk posture is T-01, and it is why the headline cannot be "freeze now."** It is not merely a prose-reclassification footgun — it is a verified trust hole. In `trust.ts:64` the content hasher does `if (kw === "certify" || kw === "amendment") continue;`, and `leadKeyword` resolves through `ALIAS_MAP` first (`trust.ts:48-52`). Because `change` is registered as an alias of `amendment` (`language-registry.ts:398`), an ordinary English sentence `change: we updated the logo` resolves to `amendment` and is **silently dropped from the sealed content hash**. That is content a seal claims to cover but provably does not (verified: the document hash is identical with and without the `change:` line). It must close before any public corpus is sealed. The fix is cheap — drop the alias, and never alias a trust-category keyword to a common prose word — and the window is open only because nothing public is sealed yet.

The other freeze-blockers are coherence debts that are expensive-to-impossible to walk back after launch: load-bearing keywords the core code reads but the registry denies (`certify`/`route`/`require`, T-02); the only typed-parameter primitive stamped *experimental* at the very moment you tell adopters to build on it (`input`/`output`, T-03); no on-disk way for a 2035 reader to know which grammar a file claims (T-04 — and the obvious fix is *unsafe*, because `meta:` is in fact hashed, so this needs an explicit owner decision); a published keyword count that contradicts itself inside the source-of-truth file (37 at `registry:546` vs 38 computed at `:552`, T-06); a registry that blesses a zero-adoption table keyword while the serializer ships a different one (NAME-table); and a teaching corpus that contradicts itself on money, tables, and property keys (NAME-corpus, T-11).

The strengths are real and rare, and the job at freeze is to lock them, not to enlarge the format. One line = one intent with ` | ` as the sole delimiter and the first-word-only colon rule; byte-lossless faithful-recorder round-trip; native RTL/Unicode keywords with shipped Arabic aliases; and offline-forever-verifiable seals via a per-seal versioned canonicalizer. **The work at freeze is to make the reserved boundary small, prose-safe, and *honest* about what the code actually depends on** — then market the invariants with confidence.

---

## 2. Scorecard

| Dimension | Score | Note |
|---|:---:|---|
| **Grammar elegance** | **9/10** | One line = one intent, ` | ` sole delimiter, first-word-only colon rule, minimal `\|` / `\\` escaping, lossless faithful-recorder round-trip. Deductions: never-implemented continuation rule still in SPEC §2 (T-17); positional `meta:`/`agent:`/`model:` semantics undocumented (T-17); ` | ` prose mis-parse silently swallows key:value-shaped segments (T-20). |
| **Keyword vocabulary** | **6/10** | 13-core is intuitive and well-chosen; the trust quartet is the standout. But the reserved boundary is inflated by prose-colliding aliases (T-01), the registry contradicts the code (`certify`/`route`/`require` absent, T-02), alias sprawl (`info` has 11, T-07), reference-cluster confusion (`cite` vs `ref` vs `link`, T-07), and reserved-name collisions (`header`/`footer`; `figure` with 5 aliases shadowing reserved `image`, T-14). This is where freeze work concentrates. |
| **AI-agent fit** | **7/10** | Executable workflow core (`step`/`decision`/`gate`/… → `executeWorkflow`) is real and hash-chained — a genuine differentiator over SKILL.md/MCP manifests. But the only typed-parameter primitive sits in `x-exp` (T-03), agent self-description parses to three different shapes (T-09), and the `if:`/`filter:` condition grammar isn't in SPEC and the code disagrees with the doc on the `!` operator (T-15). |
| **Enterprise fit** | **6/10** | The `einvoice.ts` EN16931/UBL bridge is clean and shipped (1.24.0); `contract`/`quotation`/`invoice` lifecycle vocabulary is professional. But every business number is an opaque string (T-05), examples model money two incompatible ways, and `route`/`require` (the approval moat) are unreserved (T-02). |
| **Government / archival fit** | **5/10** | Plain UTF-8/NFC/LF zero-dependency core and a "convert your archives" on-ramp are strong longevity stories. Gaps: no self-describing format-version stamp (T-04, OAIS self-description), no reserved archival metadata vocabulary or `archive` profile (T-12), no fixity over external resource bytes (T-19), dates only warning-level (T-16). |
| **Human ergonomics** | **8/10** | `section`/`sub` implicit containment beats `#`/`##` counting; `end:` two-sided rows; RTL native. Deductions: `Note:`/`WARNING:`/`change:` silently reclassified (T-01); property-key drift across the corpus (`at`/`time`/`date`, `by`/`owner`, T-11); three table syntaxes with no "one obvious way" (T-10); inline `;` vs block ` | ` asymmetry undocumented (T-20). |
| **Interop / standards** | **7/10** | Lossless text↔JSON, UBL/PAdES bridges, markdown/docx/html converters. Frame rivals as inputs/outputs, not head-on (T-13). The reference/cross-doc graph (`ref:`/`rel:`) is half-built and free-text (T-19). |
| **Versioning / conformance** | **5/10** | Per-seal SEAL_SPEC versioning with a CANONICALIZERS registry is exemplary — a rule change can never break a historical seal. But the *grammar* is not stamped per-doc (T-04), there is no producible "conformant v1.0" verdict named in SPEC (T-16), and SPEC contradicts code in several places (T-17). |
| **Docs coherence** | **4/10** | The weakest dimension and the most fixable. SEAL_SPEC 3-vs-4 contradiction inside AGENTS.md itself (the published `/llms.txt`, T-08); 37/38/13 count drift in the source-of-truth file (T-06); AGENTS.md falsely claims seals hash "exact bytes" / "reformatting breaks it," contradicting SEAL_SPEC 4 (T-13); pre-v1 sealed example artifacts (T-18); stale ASSESSMENT EN16931 claim (T-13). Fix with `parity:check`-style CI on doc literals. |

---

## 3. What's already excellent — preserve and market

These are the invariants. Lock them at freeze; do not let any P0 work erode them.

- **Open-keyword extensibility, done right.** Any unknown `word:` becomes a typed, queryable `custom` block that preserves the as-written keyword and bytes (`parser.ts:720-725`, `:754-758`). Domain vocabularies (`مصروف:`, `expense:`) are first-class without bloating the reserved set. This is *the* headline: **every word can be a keyword; only 13 are reserved.**
- **Offline, in-file, forever-verifiable trust** via a versioned canonicalizer (`SEAL_SPEC = 4`, `trust.ts:171`), dispatched on the *recorded* spec forever through the `CANONICALIZERS` registry. A future rule change can never silently break a historical seal. Almost no competing format has this. The single most defensible claim — do **not** "simplify" the per-seal versioning.
- **Sign content, not presentation.** The seal hash excludes styling (`page`/`font`/`style` lines + `PRESENTATION_PROPS`, `trust.ts:25-45`), so re-theming or a Windows CRLF re-save never breaks a seal, while any content tamper does. Market this precisely — *after* fixing AGENTS.md's false "reformatting breaks it" (T-13).
- **One line = one intent** with ` | ` as the sole property delimiter — simpler than YAML/TOML nesting — and the first-word-only colon rule means prose like `quote: He said: watch this` needs no escaping.
- **Native RTL/Unicode keywords** with 33 shipped Arabic aliases. One query (`type:task`) matches across languages, and sealed Arabic docs keep their hash. A genuine, verifiable differentiator no Markdown/DOCX toolchain matches. **Invariant 4: never weaken a Unicode-script alias.**
- **Lossless text↔JSON round-trip** with an idempotent serializer and an *honestly documented* scope (byte-identity after one canonicalizing pass) — the interchange guarantee agent builders care about most.
- **An executable workflow core that is real, not decorative.** `step`/`decision`/`gate`/`trigger`/`result` map 1:1 to `executeWorkflow()`; in-file approval state is hash-chained and tamper-evident offline — a strong differentiator over SKILL.md / agents.md / MCP manifests, which carry no integrity layer. Name those rivals when you market it.
- **Clean standards bridges:** `einvoice.ts buildUBLInvoice` (EN16931 / UBL 2.1, shipped 1.24.0, zero-dep) and PAdES export — "your sealed `.it` invoice exports to the format PEPPOL and ZATCA mandate."
- **Plain UTF-8/NFC/LF, zero-dependency core** with opt-in layers and markdown/docx/html converters — an unmatched supply-chain and longevity story for gov/archive, with a credible "convert your archives" on-ramp.
- **Redaction that deletes bytes** (not CSS-hide) and leaves a salted commitment receipt provable later, sealed over the redacted form — a better FOIA/discovery story than flattened-PDF redaction.

---

## 4. The four personas

### 4.1 AI agents — *7/10*

**What works.** The executable workflow core is the standout and a real differentiator: an agent can write a `decision:`/`gate:`/`step:` workflow, another can execute it, and the approval state is hash-chained and offline-verifiable. Unknown-keyword passthrough means an agent can emit any vocabulary without erroring. Lossless text↔JSON is exactly the interchange guarantee agent builders want.

**What's missing.**
- **T-03 (blocker):** `input:`/`output:` — the format's *only* typed-parameter primitive (`type:`/`required:`/`options:`/`compute:`) and the second-most-used keyword in the corpus (24 occurrences) — sit in the `exp` (experimental) namespace. Telling adopters to build tool manifests on a keyword you stamped "experimental" is a coherence inversion. The fix is metadata-only.
- **T-09 (owner decision):** `agent:`/`model:`/`tool:`/`memory:` parse to three different shapes — `tool:`/`memory:` emit typed blocks, `agent:`/`model:` emit *no* block (lifted to metadata before the first section). An ecosystem cannot standardize on that. A tool's `params:` is an opaque unparsed string, so a tool manifest does not round-trip with its schema intact; the fix is to compose the existing `input:` primitive as child lines, not to invent JSON-Schema syntax. `context:` (the marquee "agents save memory as `.it`" primitive) has no real non-template fixture pinning its shape.
- **T-15 (blocker):** the `if:`/`filter:` condition mini-language is part of the executable contract (`executeWorkflow` depends on it) but lives only in a runtime doc, not SPEC. An independent evaluator cannot reproduce branching deterministically. And the doc is *wrong*: `agent.md:80` lists a `!` operator the implementation does not have (`executor.ts:150-419`). Spec it from the **code**, not the doc.

### 4.2 Enterprise — *6/10*

**What works.** The contract/quotation/invoice lifecycle vocabulary is professional, the in-file approval routing (`route:`/`require:` + `workflowState`) with a hash-chained audit is a genuine moat, and the `einvoice.ts` EN16931/UBL bridge is clean, tested, and shipped (1.24.0).

**What's missing.**
- **T-02 (blocker):** `route:`/`require:` — the approval moat — are read by `workflow-state.ts extractRoute` but are **absent from the registry** and parse as `type:custom`. The marketed feature set and the single source of truth disagree. Half-in/half-out is the one unacceptable freeze state.
- **T-05 (high / owner decision):** every business number — line totals, VAT, quantities — is an opaque string. `metric value:` is typed `string`; table cells are trimmed text. A typo or a tamper that leaves a valid seal but breaks arithmetic is invisible. Examples model money two incompatible ways (`16,500 QAR` vs `250000 | unit: USD`), and `einvoice.ts:197` has a `parseAmount` regex that exists *solely* to undo the embedded-currency form — proof the convention fights the standards bridge.
- **T-12 (high / owner decision):** no `archive` profile, no reserved descriptive-metadata vocabulary — a gap for any records-of-truth deployment.

### 4.3 Government / archival — *5/10*

**What works.** Plain UTF-8/NFC/LF, a zero-dependency core, byte-lossless round-trip, and a credible "convert your archives" on-ramp are strong longevity stories. Per-seal SEAL_SPEC versioning means a 2035 verifier can still validate a 2026 seal.

**What's missing.**
- **T-04 (blocker / owner decision):** a `.it` file has **no way to declare which grammar version it conforms to**. `document.version` is reverse-engineered by feature-sniffing (`parser.ts:1969-1989`), which shifts meaning across releases — so a plain note and a v4.1 document are indistinguishable on disk. Self-description is the #1 OAIS/ISO criterion and is near-impossible to retrofit onto an archived corpus. **The obvious fix is unsafe:** `meta:` is *not* hash-excluded (verified — only `page`/`font`/`style` + `PRESENTATION_PROPS` + comments + trust lines are excluded), so writing `meta: | format: 1.0` into a sealed doc invalidates its seal. This needs an owner decision (see §9).
- **T-12 (high / owner decision):** no reserved archival metadata key set (Dublin Core / PREMIS — `creator`, `retention`, `classification`, `series`), no `archive` conformance profile an ingest tool can gate on. PDF/A's whole value is a *validatable* level; `.it` has none.
- **T-19 (low):** the seal does not cover the bytes behind `image:`/`embed:`/`link:` — a swapped signature image behind `image:` would not break the seal. Reserve a `sha256:`/`fixity:` property name now (it must be **content, never presentation**); implement later.
- **T-16 (medium):** dates are warning-level only; there is no normative conformance verdict.

### 4.4 Humans — *8/10*

**What works.** `section`/`sub` implicit containment is more forgiving than counting `#`/`##`; `end:` gives clean two-sided rows; RTL is native; the first-word-only colon rule lets natural prose through.

**What's missing.**
- **T-01 (blocker):** ordinary sentences opening with a colon-word — `Note:`, `WARNING: do not deploy`, `change: we updated the logo` — are silently reclassified as typed blocks (and, for `change:`, silently dropped from the seal hash). The biggest first-try footgun, especially for the gov use case of converting prose archives.
- **T-11 (high):** property-key drift across the *official* examples — `time:` in one file, `at:` in another; `owner:` for tasks, `by:` for approvals. A human who writes `done: X | at: …` and queries `time<…` gets nothing, silently (`query.ts` does exact-key lookup). A v1.0 that "teaches by example" must not ship self-contradicting flagship files.
- **T-10 (high):** three table syntaxes (markdown pipes, `columns:`/`row:`, legacy `headers:`/`row:`) with no "one obvious way," and a silent first-pass normalization that means what a human wrote is not what they get back.
- **T-20 (low):** the inline `;` vs block ` | ` separator asymmetry is real and undocumented — a likely first-try error.

---

## 5. Grammar & syntax review

The grammar is the strongest part of the format (9/10) and most of it should be locked verbatim. The elegance findings:

- **The core invariants are right.** One line = one intent; ` | ` as the sole delimiter; the first-word-only colon rule; minimal `\|` / `\\` escaping; byte-lossless faithful-recorder round-trip. These are the marketable elegance and must not be touched.
- **A dead rule still lives in the spec (T-17).** SPEC §2 rule 3 lists indented continuation as a parse step, but the parser never honors leading indentation — indented lines become separate blocks — and `AGENTS.md:29` says the opposite ("indentation is cosmetic"). Delete rule 3 and renumber. No real document relies on it; pure spec correction.
- **Positional metadata semantics are undocumented (T-17).** `meta:`, `agent:`, `model:` are lifted to document metadata when they appear *before* the first `section:`, but render as visible blocks *after* it (`parser.ts:1710-1745`). An agent reordering a doc can flip the meaning — and which lines the content hash sees. *Document* this positional rule explicitly (the byte-safe choice that preserves every existing hash); do **not** switch to "always-lift," which changes hashed bytes for mid-document `meta:`/`agent:`/`model:`. (The theme's claim that `track:`/`context:` are also positional is wrong — `track:` is always lifted, `context:` always renders.)
- **The ` | ` prose mis-parse silently swallows segments (T-20).** `text: A | owner: Ada | not a prop here` round-trips to `text: A \| not a prop here | owner: Ada` — `owner: Ada` is silently absorbed into properties and the line is reordered, no warning. Document the `;` vs ` | ` asymmetry and add a lint (safe, do now); the parser recovery *softening* is a content/property-boundary change and a cross-version hash hazard — owner-gate it (see §9).
- **The inline `;` vs block ` | ` asymmetry (T-20)** has a sound rationale (a literal `|` can't appear in a line) but is non-obvious. Surface it prominently in SPEC and flag a `|` typed inside `{…}` spans with a lint.

---

## 6. The reserved-keyword vocabulary

This is the central section. The freeze locks the reserved boundary forever, and right now that boundary is **inflated, dishonest in three places, and contradicted by its own teaching corpus.** The corrective lever is overwhelmingly *removing, renaming, and unifying*. See [`namingDecisions`](#naming-decisions) in §8/§9 for the specific calls.

**Registry-vs-reality coherence is broken in three ways, and all three are freeze-blockers because half-in/half-out is the one unacceptable state:**

1. **The registry denies keywords the code depends on (T-02).** `certify` is special-cased in the seal hash (`trust.ts:64`, dropped from content), read by `seal.ts`/`audit-chain.ts`/`storage.ts`, and drives the gold CERTIFIED tier — yet it is absent from `LANGUAGE_REGISTRY` and the `BlockType` union. `route`/`require` drive the approval moat (`workflow-state.ts extractRoute`) and appear in shipped examples, but survive only as `custom`. Reserve all three. Because seal/audit/storage match **raw source line prefixes**, not parsed types, promotion provably does not move the content hash. Leave the existing `requirement` (policy alias) and `verify` (assert alias) untouched — bare `require`/`certify` are distinct tokens.
2. **The registry blesses an unused keyword as canonical (NAME-table).** It declares `columns` canonical/stable (zero adoption) while the serializer actually persists `headers:`/`row:` (`source.ts:385-386`, confirmed by `markdown.test.ts:77`). The format ships an alias as its de-facto canonical output. Promote `headers` → canonical/stable, demote `columns` → compat-only alias (Option A — no serializer change, zero byte-drift), update `SPEC.md:125`, keep all input forms accepted.
3. **The only typed-parameter primitive is stamped experimental (T-03).** `input`/`output` live in `exp`. Move them to a stable namespace (recommend `form`). Verified metadata-only — the namespace never reaches block output or the hash.

**Naming.** The canonical names are largely sound and most should be *documented*, not renamed. `info:` is the callout canonical but the SPEC never says so, and humans reach for `warning`/`tip`/`note` — state it once in SPEC and present `note`/`tip`/`warning` as the primary authoring forms; do **not** rename `info` → `callout` (forces every existing `info:` line into alias-emit churn for zero seal benefit). `header:`/`footer:` mean *page* header/footer but collide with the Markdown/HTML meaning of "heading"; keep the bare canonicals (they are presentation lines, seal-safe) and optionally add `page-header`/`page-footer` as aliases.

**Redundancy and alias sprawl (T-07).** `info` carries 11 aliases (`alert`/`caution`/`critical`/`destructive`/`hint`/`advice` are pure synonyms; `destructive` is UI-framework jargon). The reference cluster is the most confusing corner: `cite` aliases `citation`/`source`/`reference`, while `ref` is a *separate* extension aliasing `references`/`see`/`related`/`xref` — so `reference` ≠ `ref` despite being the same word singular/plural, and `link` is yet a third. `EXTENSION_LEGACY_ALIASES` is an unbounded ~30-entry synonym dump with dangerous prose collisions (`by` → `deadline`, `status` → `signal`). The discipline: **reclassify** semantic aliases to compat-only (so they parse but don't surface in docs/completion — deletion is semantically lossy, silently demoting existing typed blocks to `custom`), and **delete only** the prose-collision aliases (`by`, `status`). Document the three-way reference split crisply: `cite` = bibliography entry, `ref` = typed cross-doc link, `link` = inline URL.

**Reserved-name collisions and core/extension blur (T-14).** `figure` is a *non-reserved extension* carrying five aliases (`fig`/`diagram`/`chart`/`illustration`/`visual`) — more than the reserved `image` — which inverts the "reserved = important" signal. Prune to `fig`. Remove the dead `divider: "core"` tier override (`language-registry.ts:629`; it never fires because `divider` is compat-only — pure dead-code, zero observable effect). Keep `---` as the sole authored divider syntax.

**The namespace story.** Namespace is currently an overloaded `ExtensionEntry` doc field with no real stability tier surfaced in SPEC, which is what creates the perception that the typed primitive is unstable. If an explicit stability field is introduced, it must be *optional metadata only* and must never gate parser recognition (invariant 3). Document the `form`/`exp` namespaces in SPEC.

**The smallest clean canonical set.** Code computes **38** stable canonicals; the curated on-ramp is **13**. Both numbers are legitimate — 38 is the full reference set, 13 is the learning unit (`title summary meta section sub text info quote code image link task done`). Lead with the 13-core *everywhere* and demote the 38-row table to a reference appendix (T-06). Reconcile the source-of-truth file (it says "exactly 37" at `registry:546` but computes 38 at `:552`); the code is correct at 38 — fix the stale 37s and add a `KEYWORD_COUNT === 38` CI assertion. **Do not add reserved surface to "look complete."** The only additions at freeze are `certify`/`route`/`require` (already depended-on). `contact:`/`deadline:`/`party:`/`figure:` ship via the stable `x-doc` profile and must stay there — that is the small-reserved-set strength, and it should be marketed as a feature.

---

## 7. Gap register

All confirmed themes. Severity: `blocker` > `high` > `medium` > `low`. *Freeze* = must be resolved before locking v1.0.

| Id | Title | Category | Severity | Freeze | Personas | Recommendation |
|---|---|---|:---:|:---:|---|---|
| **T-01** | Trim prose-colliding aliases + close `change`→`amendment` seal hole | grammar | blocker | ✅ | human, ai, ent, gov | adopt-before-freeze |
| **T-02** | Reserve `certify`, `route`, `require` | keywords | blocker | ✅ | ent, gov, ai | adopt-before-freeze |
| **T-03** | Promote `input:`/`output:` out of `x-exp` | keywords | blocker | ✅ | ai, ent | adopt-before-freeze |
| **T-04** | Self-describing format-version stamp | versioning | blocker | ✅ | gov, ent, ai, all | **owner decision** |
| **T-05** | Reserve a typed-value SHAPE for money/quantity | data | high | ✅ | ent, gov, ai | **owner decision** (Part B) |
| **T-06** | Reconcile keyword count to 38; lead with 13-core | docs | high | ✅ | all, human, ent | adopt-before-freeze |
| **T-10** | Settle the canonical table form (`headers` vs `columns`) | grammar | high | ✅ | all, human, ent | adopt-before-freeze |
| **T-11** | Canonicalize the property-key vocabulary | ergonomics | high | ✅ | human, ent, all | adopt-before-freeze (editorial) |
| **T-14** | Resolve reserved-name collisions + core/extension blur | keywords | medium | ✅ | all, human, ent | **owner decision** |
| **T-15** | Lift the condition mini-language into the SPEC | agent | medium | ✅ | ai | adopt-before-freeze |
| **T-17** | Fix spec/code self-contradictions in the grammar | grammar | medium | ✅ | all, ai, ent, gov | adopt-before-freeze |
| **T-20** | Document `;` vs ` | ` asymmetry; soften prose-pipe recovery | grammar | low | ✅ | human, ai | **owner decision** (Part 1) |
| **T-08** | Sync all docs to SEAL_SPEC=4 + CI doc-lint | docs | high | ✅ (P1) | ai, ent, all | adopt-before-freeze |
| **T-13** | Lock intersection positioning; fix AGENTS.md false "exact bytes" claim | docs | high | ✅ (P1) | all, ent, gov, ai | adopt-before-freeze |
| **T-07** | Prune alias sprawl; resolve reference/synonym clusters | keywords | high | ✅ (P1) | human, ent, gov, ai | adopt-before-freeze |
| **T-18** | Re-seal example/fixture artifacts to spec:4; clean corpus | docs | medium | ✅ (P1) | ent, ai, human | adopt-before-freeze |
| **T-16** | Define an opt-in conformance / strict mode (SPEC §8) | tooling | medium | ✅ (P1) | ent, gov, ai | adopt-before-freeze |
| **T-09** | Make the agent self-description surface coherent | agent | high | — (P2) | ai | **owner decision** |
| **T-12** | Reserve archival metadata key set + `archive` profile | gov | high | — (P2) | gov, ent | **owner decision** |
| **T-19** | Reserve fixity + cross-doc reference conventions | data | low | — (P3) | gov, ent | reserve-name-now |

> P1/P2/P3 mark the post-gate phases. P1 items are doc/wording/lint only (zero grammar or hash impact) but protect the most defensible competitive claim. P2/P3 reserve *names* now while implementation stays additive. <a name="naming-decisions"></a>The full per-topic naming calls (`change`→`amendment`, `certify`/`route`/`require` membership, `input`/`output` tier, the published count, the canonical table keyword, money convention, the typed-value shape, temporal/actor keys, the format-version mechanism, the `divider` override, `info`-as-callout, `figure` aliases, `done` demotion, the namespace story) are enumerated in the decision spine's `namingDecisions` and summarized below in §9.

---

## 8. Freeze-blocking decisions — the gate

Nothing here adds reserved surface except the three keywords the code already depends on. Every breaking decision (renames, registry membership, parse-semantics, hashed-byte changes) **must** be made now because it is impossible to make cleanly after launch.

| Id | Decision | Effort | Why it blocks freeze |
|---|---|:---:|---|
| T-01 | Trim prose-colliding aliases + close the `change`→`amendment` seal hole | L | Verified trust hole; post-freeze, both narrowing and widening the rule-5 boundary mutate hashed bytes. |
| T-02 | Reserve `certify`, `route`, `require` | M | Registry denies keywords the seal/workflow code reads — the one unacceptable freeze state. |
| T-03 | Promote `input:`/`output:` out of `x-exp` | S | The only typed-parameter primitive cannot be "experimental" at the moment you ask adopters to build on it. |
| T-04 | Decide the format-version stamp mechanism | M | No on-disk grammar self-description; the obvious `meta:` fix is unsafe. **Owner decision.** |
| T-05 | Money convention (A, do) + reserve typed-value shape (B, owner) | L | Reserving a value SHAPE is hard to retrofit additively post-freeze. |
| T-06 | Reconcile count to 38 + CI assertion; lead with 13-core | M | A self-contradicting marketing number reads unserious and is painful to walk back. |
| T-10 / NAME-table | Promote `headers` → canonical, demote `columns` → compat-only | M | Renaming a canonical is pre-freeze-only. |
| T-11 / NAME-corpus | Document one temporal + one actor key; fix the unsealed corpus; pick one money convention | M | A v1.0 that teaches by example must not ship self-contradicting flagship files. |
| T-14 | Remove dead `divider` override; doc `info`-as-callout; prune `figure` aliases; reject `done` demotion | M | Renames are pre-freeze-only; the dead override and `figure` prune are unambiguous. **Owner decision** on the rest. |
| T-15 | Lift the condition mini-grammar into SPEC *from the code* | M | The executable subset's only unspecified surface; freezing locks the operator set. |
| T-17 | Fix spec/code contradictions; document positional `meta:`/`agent:`/`model:` | M | Drop the dead continuation rule (safe); document the positional rule (byte-safe) rather than always-lift (hash-affecting). |
| T-20 | Document `;` vs ` | ` (do); owner-gate prose-pipe recovery softening | S | Part 1 shifts the content/property AST boundary — a cross-version hash hazard. **Owner decision.** |

**The owner decisions that cannot be auto-adopted:**

- **T-04 — format-version stamp.** Choose **(A)** a reserved `meta` sub-key (`meta: | format: 1.0`) added to the hash-excluded set via a **SEAL_SPEC v5** bump with a new frozen `CANONICALIZERS[5]` + pinned vector (do not touch v4); or **(B)** a hash-excluded magic comment `// it-format: 1.0` (comments are already excluded every spec, zero spec bump). Either way, parse the stamp into `IntentDocument.version`, rename the sniffed level to `detectedFeatureLevel`, keep it OPTIONAL, and never add a top-level keyword.
- **T-05 Part B — typed-value shape.** Reserve a read-side typed-value shape using `number` + ISO-4217 currency in `unit:`; column hints live on the (hashed) `columns`/`headers` line. **Do not mint a `money` type** (`FORM_FIELD_TYPES` has none). Part A — one money convention (`value: 16500 | unit: <ISO-4217>`) across all examples — is cheap and should be done regardless.
- **T-14 — `info`/`callout`, `header`/`page-header`, `figure` promotion.** Document-don't-rename is the low-churn default; the rename calls are product/branding decisions. **Reject `done` → `task: | status: done`** outright: `done:` content is hashed body and re-serializing breaks seals.
- **T-20 Part 1 — recovery softening.** A parser-semantics change. Prefer solving the pain with a lint instead, or owner-gate it explicitly.

---

## 9. Competitive positioning

**The thesis: `.it` wins on the *intersection*, loses on every single axis.** On prose it loses to Markdown; on layout to DOCX; on fixed fidelity to PDF; on query to SQLite; on agent-writability to SKILL.md. `README.md:61`'s "one `.it` file is simultaneously four things" invites the axis-by-axis comparison `.it` loses. Demote it to a supporting bullet and lead with the intersection: **queryable across a folder and across languages with no database; in-file trust verifiable offline forever; lossless text↔JSON for humans and agents alike; Arabic/RTL-native sealable documents.**

**Defensible claims (keep, headline):**
- *Offline-verifiable, in-file, restyle-safe trust via a per-seal versioned canonicalizer.* Nothing in the rival set has this. The single most defensible claim.
- *Cross-language typed query over plain text* (`type:task` matches Arabic مهمة). No Markdown/DOCX toolchain matches it.
- *Sealed `.it` → EN16931 / UBL 2.1* (shipped 1.24.0). "Your sealed invoice exports to the format PEPPOL and ZATCA mandate." Headline this; **fix the stale ASSESSMENT line that says it doesn't exist** (T-13).
- *Byte-deleting redaction with a provable salted receipt* — a better FOIA story than flattened-PDF redaction.

**Frame rivals as inputs/outputs, not head-on replacements.** Convert *from* Markdown/DOCX/HTML; export *to* PDF/PAdES/UBL. And name the greenfield agent rivals explicitly: SKILL.md / agents.md / MCP manifests have the same writability but **no typed-queryable body and no tamper-evident seal**. That is the most winnable persona, and the comparison is currently unstated.

**Overstated claim to fix immediately (T-13).** `AGENTS.md:102` and `:211` say the seal hashes "the exact bytes" and "reformatting breaks it even when nothing visible changed." That is **factually false** for the shipped spec — SEAL_SPEC 4 deliberately excludes presentation and normalizes CRLF, so restyling and LF↔CRLF re-saves do *not* break a seal. An adversarial agent or a crypto-scrutinizing buyer who reads AGENTS.md (the published `/llms.txt`) and then runs the verifier will catch the contradiction. Replace the wording with the accurate canonical-content model. While there, resolve the SEAL_SPEC 3-vs-4 self-contradiction *inside* AGENTS.md (`:111` says 3, `:135` says 4) so an agent following it does not stamp weaker spec:3 seals at launch (T-08), and add a `parity:check`-style CI doc-lint so the literals can never drift again.

---

## 10. Bottom line

The format is good enough to freeze and good enough to market — *after* a small, surgical P0 gate. The grammar is excellent and should be locked almost verbatim. The trust layer is the most defensible thing you have, and the per-seal versioned canonicalizer is genuinely rare — protect it as an invariant. The work is not to make the format bigger. It is to **close the one real seal hole (T-01), make the registry honest about the three keywords the code already reads (T-02), un-stamp the typed-parameter primitive (T-03), decide the format-version mechanism without breaking seals (T-04), settle the money/table/property-key canon (T-05/T-10/T-11), and reconcile the published count (T-06)** — then sync the docs and the teaching corpus to that canon.

Freeze in two to three weeks, not this week. Resist every proposal to "round it out" with new keywords; the only honest additions are the three the code already depends on. Lock the invariants, make the reserved boundary small and prose-safe, and ship a format that is *honest about what it protects*.
