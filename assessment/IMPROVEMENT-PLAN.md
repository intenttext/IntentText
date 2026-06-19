# IntentText Improvement Plan

## 1. How to read this

This plan converts the audit's gap register into a sequenced, executable roadmap. It is written for the maintainer/integrator embedding `@dotit/core` inside an ERP (Jadwal), and it separates **must-fix-before-trusting-the-seal** work from longer-horizon ambitions.

**Priority** — *when* to do it, driven by what it blocks:

| Priority | Meaning |
|---|---|
| **P0** | Blocker. The seal is the entire value-add; these undermine it or break the integrator's first touchpoint. Do before relying on `.it` in production. |
| **P1** | Enterprise-hardening. Needed for a credible multi-tenant / pilot deployment. Next 1–2 quarters. |
| **P2** | Differentiators & breadth. Real value, but not gating adoption. |
| **P3** | Long-horizon / optional. Do only if a customer pulls for it. |

**Effort** — rough engineering cost:

| Effort | Meaning |
|---|---|
| **S** | < 1 day |
| **M** | A few days to ~1 week |
| **L** | Multi-week |
| **XL** | Multi-month / cross-cutting / requires external parties (CAs, audits, hires) |

**Severity** — intrinsic risk if left unfixed: `critical` > `high` > `medium` > `low`.

**A note on the headline finding.** Two of the audit's investigators scored the SEAL_SPEC v3 styling-exclusion as a *strength* ("restyle without breaking a seal"). They were wrong adversarially: the same mechanism is a confirmed **content-integrity forgery vector** (a no-key attacker can set sealed clauses to `opacity:0` / `color:#ffffff` / `size:0px`, or inject one `style:` line, and make material terms render **blank** while `verifyDocument()` returns `intact:true` and the verify portal shows a green "intact" verdict beside the doctored preview). This plan resolves that conflict against the generous read. **G-01 is the single most important item here.**

---

> **Status — 2026-06-19:** The four **P0** gaps (G-01…G-04) are **IMPLEMENTED & tested**
> in `@dotit/core` (and the verify portal + ERP demo handlers). `SEAL_SPEC` bumped to **v4**;
> full core suite green at **1178 tests** (55 files, +17 new adversarial tests in
> `packages/core/tests/seal-hardening.test.ts`). Per-gap summary at the end of §3 P0. Not yet
> released to npm (needs a `@dotit/core` version bump + republish so downstream apps pick it up).

## 2. Gap register (sorted by priority)

| ID | Title | Area | Severity | Priority | Effort | Recommendation (short) |
|---|---|---|---|---|---|---|
| **G-01** ✅ | Styling-exclusion lets sealed content be hidden while the seal stays intact (content-integrity forgery) | trust-security | critical | **P0** | M | Render **bare-by-default** on every trusted surface + add an appearance-hash warning + render-time visibility guard; fix `verify.ts:229` to pass `{bare:true}`. |
| **G-02** ✅ | CRLF / trailing-whitespace silently break otherwise-untampered seals | core-impl | high | **P0** | M | Normalize EOL→LF + strip trailing whitespace inside `hashedBody` as a **new frozen spec v4**; add CRLF/CR/trailing-WS to the property suite; fix CR-only unbounded-prefix bug. |
| **G-03** ✅ | Trust tier detection is presence-based — UI can show gold CERTIFIED for a forged `certify:` line | trust-security | high | **P0** | M | Default `detectTrustState`/`sealForDocument` to "unverified" unless a crypto-verified tier is passed; audit every surface. |
| **G-04** ✅ | Shipped Express/Fastify ERP handlers import non-existent `@dotit/pdf-runtime`, call wrong API | erp | high | **P0** | S | Rewrite against real `@dotit/pdf` (`issuePDF`/`issueDocument`/`createPdfRenderer`) or delete. |
| **G-06** ⚠️ | UTS trust authority undeployed; production trust-anchor key is a placeholder | strategy | critical | **P1** | L | Deploy the smallest earning/verifying slice **or** explicitly de-scope to ERP-first. Replace placeholder key behind a pinned `.well-known` endpoint. |
| **G-05** ⚠️ | Per-tenant signing identity unenforced; zero multi-tenant code exists | erp | high | **P1** | L | Build a host-side per-tenant key vault (HSM/KMS); session-bound `signer`/`role`; cross-tenant isolation tests. |
| **G-07** ⚠️ | README/INTEGRATION "PDF/A validated in CI with veraPDF" is **false** — gate has never passed | gov | high | **P1** | M | Fix CI (full Chrome), get a genuinely green veraPDF pass with embedded fonts + consistent XMP/Info; soften docs until green. |
| **G-11** | CI gates only ~6 of 15 units; repo-wide `pnpm -r test` exits 1 | testing | medium | **P1** | M | Add pdf/pades/math/uts-certify/hub + orphaned editor suite to CI; fix `action` no-test exit-1; workspace `tsc --noEmit`/lint gate. |
| **G-12** | Desktop file IPC handlers have no path scoping (path-traversal regression Tauri→Electron) | enterprise | high | **P1** | M | Canonicalize + assert-inside-vault on every fs path; symlink-escape guard; `open_external` extension allowlist; re-run hostile-`.it` corpus. |
| **G-08** | Bus factor of 1 — single maintainer, no governance, no second implementation | strategy | high | **P2** | L | Add a second committer/key-custodian; governance + succession + root escrow; publish conformance vectors + foreign verifier. |
| **G-09** | PAdES caps at B-B/B-T: self-signed, un-chained, no LTV/DSS; AdES not QES; no FIPS/QSCD | gov | high | **P2** | XL | Trust-list CA (AATL/eIDAS QTSP), mandatory RFC-3161 TS for legal exports, PAdES-B-LT/B-LTA, FIPS/HSM signing. |
| **G-10** ✅ | No external time anchor for native `.it` seals (timestamps self-asserted/backdatable) | trust-security | medium | **P2** | M | Optional RFC-3161/UTS countersignature into the freeze/sign line; surface "self-asserted" vs "TSA-anchored". |
| **G-13** | Desktop binaries unsigned/unnotarized | enterprise | high | **P2** | M | Apple Developer ID + notarization; Windows OV/EV (or Azure Trusted Signing); flip workflow secrets on. |
| **G-14** ✅ | Stale docs/config describe Tauri (Tauri→Electron drift) | enterprise | medium | **P2** | M | Rewrite `DEPLOYMENT.md` desktop sections for Electron; remove dead cargo dependabot job; re-issue Wave 1 hardening. |
| **G-15** ✅ | Document merge has no conditionals/arithmetic/currency formatting | erp | medium | **P2** | L | Decide "ERP computes, `.it` formats" + ship an `Intl` helper, **or** wire `field-logic.ts` compute/show-if into doc merge. |
| **G-16** ✅ | No cross-corpus query/reporting database; folder indexes shallow/in-memory | erp | medium | **P2** | M | Position `.it` as a generated/sealed artifact; index metadata into ERP tables; keep reporting in the RDBMS. |
| **G-17** | Office conversion (it↔docx) lossy/inconsistent; DOCX import yields static docs not templates | ecosystem | medium | **P3** | L | Document converters as best-effort lossy bridges, or invest in real OOXML run-property mapping + round-trip tests. |
| **G-18** | Prose/keyword ambiguity: any `word:` line becomes a typed block, lowercased on serialize | format | medium | **P3** | M | Heuristic prose guard; stop lowercasing unknown keywords; document as #1 authoring pitfall; align byte-stability claims to SPEC §5.1. |
| **G-19** | Zero e-invoicing/EDI standards support for regulated GCC market | strategy | medium | **P3** | L | Add EN16931/UBL + Factur-X/ZUGFeRD export bridges, or scope `.it` to internal docs that never cross a regulated boundary. |
| **G-20** ✅ | `@types/node` mis-declared as runtime dep; `node-html-parser` security-critical for SVG sanitize | core-impl | low | **P3** | S | Move `@types/node` to devDeps; pin `node-html-parser` exact + mXSS/SVG fuzz; add `engines >=22`. |
| **G-12** ✅ | Desktop file IPC handlers have no path scoping (path-traversal regression Tauri→Electron) | enterprise | high | **P1** | M | **Done** — `PathGuard` capability scoping + 11 hostile-path tests (lands desktop 3.0.2). |
| **G-22** ✅ | Public docs drifted: stale versions (core 1.21/editor 1.15/pdf 1.2.0) + SEAL_SPEC 3 + V3 trust model | ecosystem | medium | **P2** | S | **Done** — README/INTEGRATION/AGENTS synced to core 1.22 / SEAL_SPEC 4 (appearance, CRLF, certify-claim) / pdf 1.2.1. |
| **G-21** ✅ | Attachment `data:` URI mime not sanitized (host-dependent stored-XSS trap) | trust-security | low | **P3** | S | Allowlist/normalize mime (or force `application/octet-stream` for preview); document host sandbox requirement. |

---

## 3. Phased roadmap

### P0 — Blockers (security / correctness / adoption must-fixes)

These four directly attack the seal (the whole value-add) or break the integrator's first touchpoint. **Do not ship `.it` as a record of authority until G-01 and G-02 are closed.**

---

#### G-01 — Sealed content can be hidden while the seal stays intact *(critical, M)*

**Problem.** v3 strips presentation lines (`page:`/`font:`/`style:`) and presentation props (`color`, `bg`, `opacity`, `size`, …) from the hashed body (`trust.ts:25–45`), but `renderer.ts` maps those exact props to live inline CSS (`renderer.ts:533–551`). After sealing, *anyone with no key* can set a clause to `opacity:0` / `color:#ffffff` / `size:0px`, or inject a single `style: text | color:#ffffff` line, and make material terms render **blank** — while `verifyDocument()` returns `intact:true` with a **byte-identical** `expectedHash`. The official verify portal renders the preview with `renderPrint(doc)` and **no bare flag** (`apps/verify/src/verify.ts:229`), so a counterparty sees a green "intact" verdict beside a doctored preview. Confirmed end-to-end (blank penalty/term clauses in Chrome screenshots; "Signed … · Sealed" trust band still shown).

**This is a thesis conflict, not a one-liner.** Re-including visibility props in the hash would *destroy* the documented "restyle without breaking a seal" pillar (the basis for SEAL_SPEC versioning, the trust↔content split, and the editor architecture). Resolve deliberately.

**Action (recommended path — preserves the pillar):**
1. Make the trusted render path **`bare:true` by default** on every authority surface: the verify portal preview, print, and PDF export. (`bare` already exists — `renderer.ts:23–30`, `BARE_RENDER` at `:1738` — and is confirmed to strip the smuggled styling.) Fix `apps/verify/src/verify.ts:229` to call `renderPrint(doc, {bare:true})`.
2. Add a second **appearance hash** over the presentation layer, recorded at seal time. On verify, if the appearance differs from what was sealed, emit a visible **"appearance changed since sealing"** warning (distinct from `intact:false`). This keeps restyling legal but never silent.
3. Add a **render-time visibility guard** in the trusted path: clamp near-invisible styling (`opacity < ~0.1`, foreground ≈ background, font-size below a floor) so a smuggled-blank clause cannot render blank even outside bare mode.
4. Add adversarial tests: seal → apply each smuggle vector (`opacity:0`, `color:#ffffff`, `size:0px`, injected `style:` line) → assert the trusted render still shows the clause **and** the appearance warning fires.

**Acceptance criteria.**
- Verify portal, print, and PDF export render bare by default; the smuggle corpus renders the clause text visibly on all three.
- A restyle of a sealed doc keeps `intact:true` **but** produces a visible "appearance changed since sealing" notice.
- `verify.ts` no longer calls `renderPrint(doc)` without `{bare:true}`.
- New adversarial tests are in CI and red without the fix.
- If any already-sealed docs exist in the wild (npm published 2026-06-12; desktop release exists), the appearance-hash addition is gated behind a spec bump so old seals are unaffected (see G-02 migration note).

---

#### G-02 — CRLF / trailing-whitespace silently break untampered seals *(high, M)*

**Problem.** The seal hash splits the body on `\n` only and keeps a trailing `\r` in the hashed line (`trust.ts:95,116,118`); the parser splits on `/\r?\n/`. Any LF→CRLF transform (Windows `git autocrlf`, Windows file APIs, email gateways) flips `intact:false` on an **unmodified** document — fatal for an ERP round-tripping `.it` through mixed-OS/git storage. The property suite never catches it because `genDoc` joins with `\n` only. A second defect: **CR-only** endings aren't matched by `/\r?\n/`, so the file parses as one blob and each serialize pass **prepends another `text: `** unboundedly (real content corruption, violates idempotency).

**Action.**
1. Introduce **SEAL_SPEC v4**: inside `hashedBody`, normalize EOL→LF and strip per-line trailing whitespace **before hashing** (mirroring the existing NFC philosophy). Leave v0–v3 canonicalizers **frozen and untouched** — verification dispatches on the recorded spec, so historical seals are unaffected.
2. New seals stamp `spec:4`. Document that pre-v4 seals authored on Windows remain CRLF-fragile by design (cannot retroactively change a frozen spec).
3. Fix the CR-only parser bug: split on `/\r\n|\r|\n/` so CR-only lines tokenize correctly and serialize is idempotent.
4. Extend `byte-preservation.test.ts` to generate CRLF, CR-only, and trailing-whitespace documents and assert seal survival + idempotency.

**Acceptance criteria.**
- A v4-sealed doc survives LF↔CRLF conversion and trailing-whitespace re-saves with `intact:true`.
- CR-only input is idempotent under repeated `documentToSource` (no unbounded `text:` prefixing).
- v0–v3 golden vectors are byte-unchanged (no regression to frozen specs).
- Property suite generates and passes CRLF/CR/trailing-WS cases.

---

#### G-03 — Trust tier is presence-based; UI can show gold CERTIFIED for a forged line *(high, M)*

**Problem.** `detectTrustState`/`sealForDocument` decide the tier purely from which trust *lines* are present (`seal.ts:75–125`), with no signature/key verification — so a document carrying a forged `certify: … ica:` line with an attacker key renders a gold "CERTIFIED" seal. The code comments concede verification is `@dotit/sign`'s job, pushing the burden onto every consumer.

**Action.**
1. Make `sealForDocument`/`detectTrustState` default to a **"claimed / unverified"** visual unless a crypto-verified tier is explicitly passed in. Optionally let core accept `trustedIssuers` and downgrade to draft/unverified when crypto fails.
2. Audit **every shipped surface** — verify portal, desktop badge, embedded editor — to confirm each passes a **VERIFIED** tier into `renderSeal`/`renderTrustBand`, not the presence-based default.

**Acceptance criteria.**
- A doc with a forged `certify:` line (wrong key) renders "unverified", never gold CERTIFIED, on all surfaces.
- A test asserts presence-only input yields the unverified visual; only a crypto-verified tier yields CERTIFIED.

---

#### G-04 — Shipped Express/Fastify handlers import a non-existent package *(high, S)*

**Problem.** `demo/erp-integration/erp-express-handlers.mjs` and `erp-fastify-handlers.mjs` load `@dotit/pdf-runtime` (no such package anywhere in the repo or any `package.json`) and call `runtime.createPdf` — the real `@dotit/pdf` API is `issuePDF`/`issueDocument`/`createPdfRenderer`. They throw on startup. This is the integrator's **first copy-paste touchpoint**.

**Action.** Rewrite both handlers against the real `@dotit/pdf` API (mirroring the working `erp-service.mjs`), or delete them and point the docs at `erp-service.mjs` / `INTEGRATION.md §3.1`.

**Acceptance criteria.**
- Both handler files start and serve a merged PDF from a clean `pnpm install` checkout, **or** are removed and no doc references them.
- A smoke test (or CI step) imports each advertised server entry point without throwing.

---

#### ✅ P0 implementation status (2026-06-19)

All four P0 gaps are implemented in `@dotit/core` and verified; full suite green (**1178 tests, 55 files**).

| Gap | What shipped | Key files |
|---|---|---|
| **G-01** ✅ | Seals now record an **`appearance:`** (full-fidelity) hash (`computeAppearanceHash`); `verifyDocument` returns **`appearanceChanged`** + a warning when content is intact but styling changed since sealing. The verify portal preview now renders **`{ bare: true }`** (signed content, no styling). A renderer **visibility guard** neutralizes fully-invisible styling (`opacity<0.1`, `color==bg`, `size:0`) on the styled path too. | `packages/core/src/trust.ts`, `renderer.ts`, `apps/verify/src/verify.ts` |
| **G-02** ✅ | **`SEAL_SPEC = 4`**: `hashedBody` normalizes EOL (CRLF/lone-CR→LF) + strips per-line trailing whitespace **before** hashing (v0–v3 left frozen; dispatch unchanged). Parser now splits on `/\r\n\|\r\|\n/` (CR-only no longer corrupts via unbounded `text:` prefixing). `CANONICALIZERS[4]` + `AUDIT_NORMALIZE[4]` added. | `packages/core/src/trust.ts`, `parser.ts`, `audit-chain.ts` |
| **G-03** ✅ | `detectTrustState`/`sealForDocument` no longer grant **certified/root-certified** from presence of a `certify:` line — the caller must pass a crypto-verified result (`{ certificationVerified: true \| "root" }`). New `TrustState.certificationVerified`. `renderTrustBand` (core, used on print/PDF/editor) now shows the locally-verifiable **sealed** tier for an unverified certify line, never gold. | `packages/core/src/seal.ts` |
| **G-04** ✅ | Both `demo/erp-integration/erp-{express,fastify}-handlers.mjs` rewritten against the real working `erp-service.mjs` pattern; `@dotit/pdf-runtime`/`createPdf` removed; `node --check` passes. | `demo/erp-integration/*` |

**Tests:** 17 new adversarial tests in `packages/core/tests/seal-hardening.test.ts` (the four smuggle vectors, CRLF/CR/trailing-ws seal survival, frozen-v3-vs-v4 dispatch proof, CR-only idempotency, forged-`certify:` band, content-tamper still BROKEN) + updated `seal.test.ts` / `seal-versioning.test.ts` pins (spec 3→4). Verify portal and editor typecheck clean against the rebuilt core.

**Not yet done (release step):** bump `@dotit/core` (breaking: `SEAL_SPEC` change) and republish so the desktop/editor/verify apps consume the fix; add a CRLF/appearance case to the property-based byte-preservation gate; surface `appearanceChanged` visibly in the editor banner and verify portal UI (core returns it; the UIs don't render it yet).

---

#### ⚠️ P1 progress (2026-06-19) — partial, by design

Three P1 gaps were advanced as far as is correct in-repo (the rest needs infra you own or a
business decision):

| Gap | Done now | Still needs you |
|---|---|---|
| **G-05** ⚠️ | `packages/sign/tests/multi-tenant-custody.test.ts` — a `TenantKeyVault` reference + **5 passing PoC tests** that prove the isolation contract with real Ed25519 (distinct per-tenant identity, verify-under-own-key, session-derived signer, unknown-tenant rejected, **cross-tenant forgery demonstrated**). ERP-FIT §4 points integrators at it. | Implement the vault against a real **KMS/HSM** in Jadwal (swap the in-memory map for a key *handle*); add app-side cross-tenant data-isolation tests. |
| **G-06** ⚠️ | Trust anchor is **env-gated** (`VITE_UTS_TRUSTED_KEY` / `…_ISSUER`); the dev key is an explicit, flagged fallback (`utsTrustConfigured`) so a placeholder can never read as production trust. Deploy-vs-de-scope decision written up in `docs-internal/ROADMAP.md`. | **The business decision**: deploy the UTS earning/verifying slice, or formally de-scope to ERP-first. (Engineering can't make this call.) |
| **G-07** ⚠️ | `@dotit/pdf` now emits **consistent Info↔XMP** metadata (Producer/CreatorTool/dates), with a test; README/INTEGRATION **softened** from "validated in CI" to "PDF/A-oriented; veraPDF gate run on demand; font embedding pending". | **Font embedding** (serve an `@font-face` web-font subset) + a **green veraPDF CI run** to confirm — neither is verifiable locally. Then republish `@dotit/pdf`. |

The G-05/G-06/G-07 source changes are committed but **not yet released to npm** (`@dotit/pdf`) /
redeployed (verify portal) beyond this branch — see the deploy note below.

### P1 — Enterprise-hardening (next 1–2 quarters)

Needed for a credible pilot. Tie-back: **G-05, G-06, G-07, G-11, G-12**.

| Gap | Problem | Action | Acceptance |
|---|---|---|---|
| **G-06** *(critical, L)* | The entire recurring-revenue moat (UTS authority) is undeployed: `api/verify/hub.uts.qa` return HTTP 000; the verifier's production trust-anchor key is a placeholder. | **Decide explicitly:** either (a) deploy the smallest earning/verifying slice — keypair + `/certify` + public verify portal — and replace the placeholder `trustedIssuers` key with the real published key behind a pinned `.well-known` endpoint (with rotation/history), **or** (b) formally **de-scope** the standalone authority and commit to ERP-first until a design partner pulls. | A counterparty can verify a `.it` at a public URL against a real (non-placeholder) key; **or** docs/roadmap explicitly mark UTS de-scoped and no surface depends on a live authority. |
| **G-05** *(high, L)* | Per-tenant signing identity is unenforced; **zero** multi-tenant code exists; `signDocumentCrypto` takes a single `privateKey`. Getting custody wrong lets one tenant forge another's signatures. | In the **host** (ERP): per-tenant key vault (HSM/KMS); authenticate → look up tenant key → fill `signer`/`role` **from the session, never a text box**. Add tests that one tenant cannot load another's key. Document that data isolation + key custody are 100% the integrator's responsibility. **Validate the asserted cross-tenant forgery with a PoC** before relying on the XL framing. | `signer`/`role` are session-derived; an isolation test proves tenant A cannot load tenant B's key; the cross-tenant forgery PoC is demonstrated (or refuted) and documented. |
| **G-07** *(high, M)* | README/INTEGRATION claim "PDF/A validated in CI with veraPDF" — **the gate has never passed** (dies at `puppeteer: not found`, exit 127, before veraPDF runs); the local sample embeds **zero fonts** and has XMP/Info metadata mismatch. | Install full puppeteer/Chrome in CI so the sample renders; get a genuinely green veraPDF PDF/A-2B/3B pass with **embedded fonts** + consistent XMP/Info; archive the report as a release artifact. Emit `xmp:CreateDate/ModifyDate/CreatorTool/pdf:Producer` to match the Info dict. **Until green, soften every doc claim to "PDF/A-oriented, validation pending."** | A green veraPDF run exists on CI with an archived report; rendered sample embeds all fonts; XMP/Info consistent; doc claims match reality. |
| **G-11** ✅ *(medium, M)* | CI gates ~6 of 15 units; pdf/pades/math/uts-certify/hub + the 64-test editor suite never run; `pnpm -r test` exits 1 because `packages/action` has a test script but zero test files. | Add pdf/pades/math/uts-certify/hub test+build jobs; wire the orphaned editor suite (add a `test` script) into CI; fix `action` with `vitest run --passWithNoTests`; add a workspace `tsc --noEmit`/lint gate; isolate the slow puppeteer pdf suite to a parallel job. | `pnpm -r test` exits 0; CI runs pdf/pades/math/uts-certify/hub + editor suites; a workspace typecheck gate is green. |
| **G-12** *(high, M)* | The Tauri `fs.rs` allowed-root guards did **not** carry to Electron: `read/write/delete/rename/open_external` take raw paths (`main/index.ts:199–254`) with `sandbox:false`, so any renderer XSS over untrusted `.it` yields full-disk read/write. | Canonicalize every path; assert it is inside the registered vault/doc dir; reject symlink escapes; constrain `open_external` to an extension allowlist; re-run the hostile-`.it` corpus against the Electron build. | Path-traversal and symlink-escape attempts are rejected by tests; `open_external` only opens allowlisted extensions; hostile-`.it` corpus passes on Electron. |

---

### P2 — Differentiators / breadth

Real value, not gating adoption. Tie-back: **G-08, G-09, G-10, G-13, G-14, G-15, G-16**.

| Gap | Action summary | Notes |
|---|---|---|
| **G-08** *(high, L)* | Add a second committer/key-custodian; document governance, succession, and **UTS-root escrow (M-of-N)**; publish a **frozen byte-level conformance vector corpus** + a **from-scratch/foreign verifier** so courts/auditors can verify without trusting `@dotit/core`. | Irrelevant for the embed-in-own-ERP path (maintainer *is* the consumer); **gating** for any third-party/gov ambition. |
| **G-09** *(high, XL)* | Integrate certs from a trust-list CA (Adobe AATL or eIDAS QTSP); make a trusted RFC-3161 timestamp **mandatory** for legal exports; implement PAdES-B-LT/B-LTA (`/DSS` + embedded OCSP/CRL + document timestamp); verify the TSA token's own signature/chain on read; route signing through a FIPS-validated module/HSM via the stubbed KMS seam. | See Standards track (§4). Stop describing the default self-signed flow as court/gov-grade. |
| **G-10** *(medium, M)* | Offer an optional RFC-3161/UTS countersignature for native `.it` seals (reuse `pades/tsa.ts` to stamp a `TimeStampToken` into the freeze/sign line); surface "time self-asserted" vs "time TSA-anchored" distinctly in the trust band and verify portal. | The PAdES TSA path already works against a live DigiCert TSA — reuse it. |
| **G-13** *(high, M)* | Acquire Apple Developer ID + notarization and a Windows OV/EV (or Azure Trusted Signing) cert; flip the workflow secrets on. | Hard blocker for managed enterprise/gov fleets. Current "unsigned" status is **doc-confirmed** (commented `CSC_LINK`, "currently UNSIGNED" strings), not build-confirmed — verify with an actual signed build. |
| **G-14** *(medium, M)* | Rewrite `DEPLOYMENT.md` desktop sections for Electron; remove the dead cargo dependabot job pointing at `src-tauri`; re-issue PRODUCTION-HARDENING-PLAN Wave 1 against the real Electron attack surface; stop hard-coding stale test counts in prose. | Wave 1 "security criticals COMPLETE" is **contradicted** — the fs guards regressed (G-12). |
| **G-15** *(medium, L)* | Decide explicitly: either document **"ERP computes, `.it` formats"** as the permanent contract + ship a small `Intl` currency/number helper, **or** add computed-fields + conditional-block support to merge (the `field-logic.ts` compute/show-if logic exists but is wired **only** to the Forms pipeline, not document merge). | Today an invoice template cannot compute line totals/tax/grand totals — all must be precomputed by the ERP. |
| **G-16** *(medium, M)* | Position `.it` as a generated/sealed **artifact**, not a system of record. Keep business data + reporting in the RDBMS; index `.it` metadata (number/status/amount/hash) into ERP tables at issue time. | `queryDocument` filters **within a single document** only; folder indexes are shallow/non-recursive/in-memory — do not attempt folder-query reporting at invoice scale. |

---

### P3 — Long-horizon / optional

Do only if a customer pulls. Tie-back: **G-17, G-18, G-19, G-20, G-21**.

| Gap | Action summary |
|---|---|
| **G-17** *(medium, L)* | Document `it↔docx`/`xlsx` converters as **best-effort lossy data-bridges** (it→docx drops emphasis/links, demotes `info:`/`metric:` to plain text; xlsx loses the title; docx import reconstructs no merge fields), **or** invest in real OOXML run-property mapping + round-trip-loss tests. Do **not** market Word parity/interop. |
| **G-18** *(medium, M)* | Add a heuristic guard (treat `word:` as prose when the word is an unknown keyword **and** the content is sentence-like); at minimum stop lowercasing unknown keywords on serialize; document this as the **#1 authoring pitfall**. Lower priority for ERP (machine-generated `.it`). Reword AGENTS.md/README byte-stability claims to match SPEC §5.1 (canonical-form only). |
| **G-19** *(medium, L)* | If regulated invoicing is a target, add explicit export bridges to **EN16931/UBL** and **Factur-X/ZUGFeRD** (PDF+embedded XML, reusing the PAdES bridge pattern) so `.it` sits **beside** the mandated format. Otherwise scope `.it` to internal documents that never cross a regulated exchange boundary. |
| **G-20** *(low, S)* | Move `@types/node` to devDependencies (net 2 prod deps, both lazily required); pin `node-html-parser` to an exact version; add mXSS/SVG-namespace fuzz cases (the SVG sanitizer delegates to its tag model); add an `engines` floor (`>=22`) to all published packages. |
| **G-21** *(low, S)* | Allowlist/normalize attachment mime (or force `application/octet-stream` for preview/download) so a `mime:text/html` attachment can't execute in a non-sandboxed host; document that hosts must sandbox attachment rendering. No confirmed live exploit — keep low. |

---

## 4. Standards & certification track (sequenced workstream)

Gov/enterprise archival and legal-signature requirements depend on this track, which cuts across **G-07, G-09, G-10, G-19** plus the conformance-vector half of **G-08**. **Today gov-readiness is effectively zero; this is a multi-quarter-to-multi-year path.** Sequence the cheap, falsifiable wins first.

**Stage 0 — Make the existing claims true (P1, weeks).**
- **G-07:** Fix the veraPDF CI gate (full Chrome so the sample renders) → genuinely green PDF/A-2B/3B with **embedded fonts** and consistent XMP/Info → archive the report per release. Until green, every doc says "PDF/A-oriented, validation pending." This is the cheapest credibility win and is currently a **false claim**.

**Stage 1 — Native-seal time integrity (P2, weeks).**
- **G-10:** Wire the working `pades/tsa.ts` RFC-3161 path into the native `.it` seal as an optional countersignature; surface "self-asserted" vs "TSA-anchored" in the trust band. Removes the backdate-at-creation gap for anyone who opts in.

**Stage 2 — Conformance + foreign verifiability (P2, multi-week).**
- **G-08 (conformance half):** Publish a **frozen, per-spec byte-level conformance vector corpus** (v0–v4) and a **from-scratch/foreign verifier** that recomputes a seal hash without `@dotit/core`. This is what lets a court/auditor (or a second ERP) verify a `.it` without trusting the single-author engine — and it de-risks the bus-factor concern for the seal specifically.

**Stage 3 — PAdES to legal grade (P2/P3, XL, external dependencies).**
- **G-09:** In order — (a) verify the TSA token's own signature/chain on read; (b) integrate a **trust-list CA** (AATL or an eIDAS QTSP) so signatures chain to a recognized root; (c) make a trusted RFC-3161 timestamp **mandatory** for legal exports; (d) implement **PAdES-B-LT/B-LTA** (`/DSS` + embedded OCSP/CRL + document timestamp) for long-term validation; (e) route signing through a **FIPS-validated module/HSM** via the stubbed KMS seam. Each requires procurement/legal relationships, not just code.

**Stage 4 — e-invoicing bridges (P3, L, only if regulated invoicing is a target).**
- **G-19:** Export bridges to **EN16931/UBL** and **Factur-X/ZUGFeRD** (PDF + embedded XML, reusing the PAdES bridge pattern). `.it` becomes the human/queryable layer *beside* the mandated structured payload, never the record of authority on a regulated exchange.

**Not on this track (deliberately):** PDF/UA / Section 508 / VPAT, SBOM-for-all-apps, independent pen-test, signed binaries (G-13). These are real gov prerequisites but belong to the broader enterprise-hardening effort, not the cryptographic-standards spine. **The only credible gov on-ramp is the export bridge** (`.it` is the internal editing layer that exports to a genuinely-green PDF/A + chained PAdES), never `.it`-as-record and never UTS-as-gov-authority.

---

## 5. What NOT to do

- **Do not re-include visibility props in the hash to "fix" G-01.** That destroys the documented "restyle without breaking a seal" pillar and the whole SEAL_SPEC/trust-content-split design. Fix it with **bare-by-default rendering + appearance-hash warning + visibility guard** instead.
- **Do not mutate frozen canonicalizers (v0–v3).** Every line-ending / normalization fix is a **new** spec version (v4+). Changing a shipped canonicalizer silently invalidates historical seals — the exact failure mode the registry was built to prevent.
- **Do not copy the shipped Express/Fastify handlers** (`@dotit/pdf-runtime` is fictional). Use `erp-service.mjs` / `@dotit/pdf` `issuePDF`.
- **Do not pursue `.it` as a standalone, world-adopted file format.** Network effects vs Word/PDF/Markdown + bus-factor-1 + no second implementation make this ~2–5% odds. The defensible path is **embedding the MIT core inside your own ERP**, where the ERP is the renderer/verifier and there are no adoption network effects to overcome.
- **Do not pitch the current stack as gov-ready or "court/gov-grade."** The native seal is recognized nowhere; PAdES is self-signed/no-LTV (AdES not QES); PDF/A is broken; no FIPS/QSCD/PDF-UA/VPAT/SBOM-for-apps. Gov is a 3–5 year path gated on the Standards track + a second maintainer + escrow.
- **Do not build folder-query reporting at invoice scale**, expect templates to compute totals (G-15), or treat `it↔docx` as faithful interop (G-17). Keep business data, calculations, and reporting in the RDBMS; treat `.it` as a generated sealed artifact.
- **Do not market the UTS "qualified timestamp" / authority tiers until deployed** (G-06). Today they return HTTP 000 and the trust-anchor key is a placeholder — selling them is a legal-claims risk.
- **Do not add new product surfaces** (more forms/redline/math/co-authoring breadth) until G-01/G-02/G-03/G-04 are closed and one document type (invoices) is piloted end-to-end. Breadth-over-depth dilutes a single-maintainer team with no proven external wedge.
- **Do not rely on the desktop app for managed fleets** until signed/notarized (G-13) **and** the fs path-scoping regression (G-12) is fixed.

---

## 6. Next 30 / 60 / 90 days

**Days 0–30 — Close the seal-integrity blockers (P0).**
- **G-01:** Switch verify portal / print / PDF export to **bare-by-default**; fix `verify.ts:229` to pass `{bare:true}`; add the smuggle-corpus adversarial tests (red → green). Spec out the appearance-hash + visibility-guard design.
- **G-02:** Ship **SEAL_SPEC v4** (EOL→LF + trailing-WS strip in `hashedBody`, v0–v3 frozen); fix the CR-only parser bug; extend the property suite to CRLF/CR/trailing-WS.
- **G-04:** Rewrite or delete the broken Express/Fastify handlers; point docs at `erp-service.mjs`.
- **G-11 (quick win):** Fix `pnpm -r test` exit-1 (`action` → `--passWithNoTests`) and wire the orphaned editor suite into CI.

**Days 30–60 — Trust correctness + CI/security hardening (finish P0, start P1).**
- **G-03:** Default trust tier to "unverified"; audit verify portal / desktop badge / embedded editor to pass a crypto-VERIFIED tier; add the forged-`certify:` regression test.
- **G-01 (finish):** Implement the appearance-hash warning + render-time visibility guard; gate behind the spec bump so existing seals are unaffected.
- **G-11 (finish):** Add pdf/pades/math/uts-certify/hub jobs to CI + a workspace `tsc --noEmit`/lint gate; isolate the slow pdf suite.
- **G-12:** Add path canonicalization + vault-scoping + symlink-escape guards to the Electron fs IPC handlers; re-run the hostile-`.it` corpus.

**Days 60–90 — Make the claims honest + decide the moat (P1).**
- **G-07 / Standards Stage 0:** Get a genuinely green veraPDF PDF/A run in CI (full Chrome, embedded fonts, XMP/Info consistency); archive the report; soften all "validated PDF/A" docs until then.
- **G-06:** **Decide** — deploy the smallest UTS earning/verifying slice with a real published key behind a pinned `.well-known`, **or** formally de-scope to ERP-first and remove any dependency on a live authority.
- **G-05 (begin):** Stand up the host-side per-tenant key vault design (HSM/KMS, session-bound signer); write the cross-tenant isolation test and the forgery PoC.
- **Pilot:** Take **one** document type (invoices) through the full template+JSON → merge → render → **v4-seal** → verify flow end to end, with business data/calculations/reporting kept in the RDBMS and the sealed `.it` + archived PDF stored on the record.

---

*Scope note: this plan treats the ERP-embedding path as the primary, defensible use (the maintainer is the consumer; no format network effects; intra-tenant trust suffices). The standalone-format, UTS-authority, and government ambitions are explicitly downstream of — and gated on — the P0 seal fixes and the Standards track above.*