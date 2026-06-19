# IntentText (.it) — Assessment & Verdict

*Prepared 2026-06-19 for the project owner. Scope: the `.it` format, the `@dotit/*` engine and ecosystem, and the specific path of embedding `.it` inside an ERP (Jadwal). Every claim below is grounded in code review and executed verification, not docs.*

---

## 1. Executive verdict — "Does it have legs?"

**Yes — but only one of them is load-bearing, and it is not the one the marketing is built around.**

IntentText is a genuinely well-built engineering artifact attached to a business that does not yet exist. The two cannot be scored as one thing, so this assessment refuses to average them. The **core engine** (`@dotit/core 1.21.2`) is real and disciplined: 1,161 green tests including a 6,000-seed property-based byte-preservation gate that is a true CI release-blocker, a from-scratch SHA-256 that is byte-identical to Node's `crypto`, a versioned-canonicalizer registry that pins every seal to its recorded ruleset forever, zero `TODO/FIXME/HACK` markers, and effectively zero real `as any` in published library source. The crypto primitives (Ed25519 via `@noble/curves`; a real pkijs/`@signpdf` PAdES stack confirmed working against a live DigiCert TSA) are sound, not theater. Doc claims survive code review far better than the typical hype repo.

But three independently-confirmed facts dominate the verdict:

1. **The SEAL_SPEC v3 decision to exclude presentation from the hash is a content-integrity forgery vector, not just a feature.** After sealing, anyone — no key required — can set a material clause to `opacity:0` / `color:#ffffff` / `size:0px`, or inject one `style:` line, and make signed terms render **blank**, while `verifyDocument()` returns `intact:true` with a byte-identical hash *and* the official verify portal shows a green "intact" verdict beside the doctored preview. This was scored as a *strength* by two of the investigating agents; on adversarial re-examination they were wrong, and this assessment resolves it against them.

2. **CRLF line endings silently break otherwise-untampered seals.** `hashedBody` splits on `\n` only while the parser splits on `/\r?\n/`, so any LF→CRLF transform (Windows `git autocrlf`, Windows file APIs, email gateways) flips `intact:false` on a document nobody touched. Fatal for an ERP that round-trips `.it` through mixed-OS/git storage.

3. **The recurring-revenue moat does not exist yet.** The UTS trust authority is undeployed (`api/verify/hub.uts.qa` return HTTP 000), the production trust-anchor key in the verifier is a placeholder, the README's "PDF/A validated in CI with veraPDF" claim is **false** (the gate has never once passed; it dies at `puppeteer: not found`), and the whole project is a single-author codebase (326/326 human commits) with a bus factor of 1.

**Net:** The **ERP-embedding path is genuinely viable (~60–75%)** and dissolves every strategic kill shot — *provided the two integrity bugs are fixed first*, since they directly undermine the seal that is the entire value-add. The **standalone-format and government plays are aspirational** and effectively zero today.

### Scorecard

| Dimension | Score | One-line justification |
|---|:---:|---|
| **Idea / format design** | **7/10** | Sound, defensible *intersection* niche (queryable + sealable + restyle-safe + RTL plain text); broad "go-to format" framing overreaches and the prose/keyword boundary is ambiguous. |
| **Implementation quality** | **8/10** | Exceptionally clean, well-tested core (1,161 tests, 0 TODO/HACK, property-based byte gate); monolithic hotspots and a confirmed CRLF byte-preservation hole keep it off a 9. |
| **Trust & security** | **5/10** | Crypto primitives are real and audited-library-based, but the *scope* of what the seal protects has a confirmed forgery vector (styling exclusion) and presence-based tier detection. |
| **Enterprise readiness** | **4/10** | Core is adoptable as a library today; bus-factor-1, unsigned binaries, doc-reality drift (Tauri→Electron), and CI that gates only ~6 of 15 units block a full-stack bet. |
| **Government readiness** | **3/10** | Effectively zero today: native seal recognized nowhere, PAdES is AdES-not-QES with no LTV, PDF/A is broken, no PDF-UA/508/VPAT, no FIPS, bus-factor-1. Architecturally plausible only if export is fixed. |
| **ERP fit** | **7/10** | Canonical flow (template+JSON → merge → render → seal → verify) is code-verified working end to end at ~475 docs/sec; the user's own path sidesteps every adoption problem. |

---

## 2. The idea & format design

**The concept is sound and genuinely thought-through — not a Markdown reskin.** The load-bearing primitive is *one line = one typed intent*, so a plain-text file is simultaneously human-readable prose **and** a queryable typed dataset, with an opt-in trust/seal layer on top. The most defensible piece is verified working in code: `type:task` matches both `task:` and the Arabic alias مهمة, and `priority:high` filters across languages (`it-query.js`). Cross-language semantic query over typed-per-line text is the real, novel value, and it is not cleanly served by any single existing format.

**Honest comparison.** On every individual axis, `.it` loses to a specialist:

| Need | Specialist that beats `.it` | Why |
|---|---|---|
| Free-form prose authoring | Markdown / AsciiDoc / LaTeX | Vastly larger ecosystem and tooling; no prose/keyword ambiguity. |
| Rich layout & Office interop | DOCX / OOXML | `.it`'s OOXML export is ~237 LOC of hand-rolled "minimal" XML; round-trip is lossy. |
| Fixed-fidelity distribution | PDF | Universal readers; `.it` must *export to PDF* to be recognized anywhere. |
| Query power & tooling | JSON / YAML / SQLite | Mature query engines; `.it` query is intra-document only (see §5). |
| **Regulated invoicing** | **EN16931 / UBL / Factur-X / PEPPOL / ZATCA** | **`.it` has zero support — confirmed by grep across the whole repo.** |

The honest wedge is the **intersection** (semantic + queryable + sealable + restyle-safe + RTL plain text), which is real but niche. The README's four-things-at-once "go-to format" framing risks being a jack-of-all-trades.

**The defining strength is also the defining hazard.** The keyword detector (`parser.ts:718`) matches any single Unicode word + colon-space, case-insensitively, with no multi-word guard. So a natural sentence — `Budget: we overspent this quarter` or `Note: this is important` — silently becomes a typed `custom` block and round-trips back *lowercased* (`budget:`). This is the inherent cost of one-line-one-intent colliding with how humans write. Lower priority for an ERP (machine-generated `.it`) than for hand-authoring, but it is the #1 authoring pitfall and should be loudly documented.

**Format governance is unusually mature for a young format** (a genuine plus): keywords/aliases/tiers derive from a single `LANGUAGE_REGISTRY` with CI parity gates, unknown keywords never error (confirmed: `مصروف:`/`expense:`/`foobar:` all parse to `type=custom`), and the SEAL_SPEC is versioned with frozen canonicalizers. Notably, **SPEC.md §5.1 is honest** — it limits byte-stability to *canonical form* — while the README/AGENTS marketing language ("the bytes are sacred", "a no-op edit is byte-identical") overstates it. The gap is doc discipline, not broken design.

---

## 3. Implementation quality

**This is the strongest dimension and the claims hold up under execution.**

- **Cleanliness:** ~16.5K source LOC with **0** `TODO/FIXME/HACK/XXX` markers and effectively **0** real `as any` (3 total; 1 in a comment, the other 2 in apps, none in published library src). Confirmed by independent grep, not doc claims.
- **Testing:** 1,161 tests across 54 files pass (~15–17s), independently re-run. The headline is a real moat: `byte-preservation.test.ts` runs **6,000 deterministic seeds** asserting five invariants (round-trip, idempotency, reconcile no-op, **seal-survives-no-op-save**, surgical edit), and `ci.yml` marks it a **hard release blocker**.
- **Portable crypto:** a from-scratch FIPS-180-4 SHA-256 (`sha256.ts`) verified **byte-identical to Node's `crypto.createHash('sha256')`** across ASCII/Arabic/CJK/emoji/1KB inputs, so seals behave identically in Node and browser.
- **Seal-versioning done right:** every seal stamps `spec:` and `verifyDocument` dispatches on the **recorded** spec forever via a frozen `CANONICALIZERS` registry (v0..v3). A future rule change can never silently invalidate a historical seal — exactly the right instinct for long-lived records.

### Byte-preservation reality (empirically verified)

The marketing headline "byte-preserving" is **not** a blanket guarantee, and the SPEC is refreshingly honest that it isn't. Independent verification against the built `dist/`:

| Property | Result | Evidence |
|---|---|---|
| Idempotency (2nd pass = 1st pass) | **Holds** for all 11 examples + 9,000 fuzz seeds + adversarial inputs, **except CR-only** | `/tmp/itaudit/deep.cjs` |
| First-pass byte-identity for raw author input | **Fails** for 5/11 shipped examples (markdown tables → `headers:`/`row:`, trailing-space stripped) — but **information-lossless** (deep-equal after 2nd pass) | `/tmp/itaudit/test-examples.cjs` |
| **CRLF seal survival** | **BREAKS** — sealed doc → LF-to-CRLF transform → `intact:false` | `/tmp/itaudit/erp.cjs` |
| **CR-only line endings** | **Corrupts unboundedly** — each serialize pass prepends another `text: ` | `/tmp/itaudit/deep.cjs` (len 34→40→46→52) |
| NFC normalization | Hash-layer only (correct); serialized text stays NFD | `/tmp/itaudit/deep.cjs` |

> **Severity note:** the **CRLF-breaks-seals** issue [G-02] is **HIGH** for any ERP that stores `.it` under git or Windows — it *will* be hit. The CR-only corruption is real but extinct-platform-only (classic Mac), so it is a footnote, not a release blocker. The fix for both is to normalize line endings to LF and strip trailing whitespace *inside `hashedBody` before hashing*, shipped as a **new** frozen spec version (v4), leaving v0..v3 untouched.

### Maintainability & dependencies

- **Complexity hotspots** (medium concern): `parseIntentText` (902 lines), `renderBlock` (931), `validateDocumentSemantic` (808) concentrate most logic in single huge bodies. Clean and well-commented, but the most likely place for a regression to hide and the highest onboarding cost.
- **Dependency footprint is light** but mislabeled: `@types/node` is wrongly listed as a **runtime** dependency [G-20] (should be `devDependencies`); net prod deps are then 2 (`fflate`, `node-html-parser`), both lazily required. `node-html-parser` is security-critical (SVG sanitization) and should be pinned with mXSS fuzz cases. No `engines` floor is declared on any package despite code assuming Node ≥22.6 [G-11].

---

## 4. Trust & security

**The cryptographic core is sound; the *scope* of what it protects is the weakness.**

### What the seal really guarantees (and what it does not)

The defenses work as advertised — and this was adversarially confirmed:

- **Content / signature / seal-metadata tampering all break the seal.** Editing a number, injecting/deleting a line, changing the signer name or role, or forging the freeze status/date/hash all flip `intact:false`. v3 binds signer identity `(hash|signer|role|at)` into the signature payload so a signature cannot be lifted.
- **History-boundary desync is not exploitable** — the hashed body and rendered blocks cut at the same slice, so moving the boundary breaks the seal *and* drops the content from the render together.
- **No XSS found** — content is HTML-escaped, `javascript:` URLs are neutralized, style values strip `;{}` and escape quotes.

The documentation is **admirably honest** about the boundary: `SECURITY-MODEL.md`/`identity.md` correctly state the seal is *integrity + claimed identity*, not PKI/authenticity; the signer name is "just a string anyone can type"; and time is self-asserted/backdatable. This avoids the most common overclaim liability.

### The styling-exclusion finding — **CRITICAL** [G-01]

This is the headline security finding and it directly falsifies the core selling point.

SEAL_SPEC v3 excludes presentation lines (`page:`/`font:`/`style:`) and presentation props (`color`, `bg`, `opacity`, `size`, …) from the hash (`trust.ts:25-45`), **yet the renderer maps those exact props to live inline CSS** (`renderer.ts:533-551`). The attack, confirmed end-to-end against the compiled API with Chrome screenshots:

> Seal an NDA. With **only excluded styling** — no key — set the $500k penalty clause to `size:0px` and the 10-year term to `color:#ffffff` (the default theme background *is* `#ffffff`). `verifyDocument()` still returns `intact:true` with a **byte-identical** `expectedHash`, and the rendered/printed document shows those sections **completely blank**.

It gets worse: a **single injected line** `style: text | color:#ffffff` emits a document-wide CSS rule that blanks *every* paragraph of a settlement (release + $250,000 payment + confidentiality) at once — while the trust band still reads "Signed Carol (Counsel) · Sealed."

And the defense is in the wrong place: core ships an opt-in `bare:true` render that strips this styling and would defeat the attack — **but it defaults to false, and the official verify portal renders the preview with `renderPrint(doc)` and no bare flag** (`apps/verify/src/verify.ts:229`). So the one surface a counterparty trusts to answer "is this authentic?" shows a green verdict beside a preview that hides the smuggled clauses.

**Why this is a design decision, not a one-liner:** "restyling never breaks a seal" is a *documented product pillar* (the entire trust↔content/presentation split, the editor architecture, and the v3 versioning were built around it). Re-including `color/size/opacity` in the hash **destroys that pillar**; keeping exclusion but rendering bare-by-default (plus a separate "appearance hash" that emits a visible "appearance changed since sealing" warning, plus a render-time visibility-guard that clamps near-invisible styling) **preserves it**. The recommended fixes are mutually exclusive with a shipped pillar — the founder must choose deliberately. Minimum immediate fix: pass `{bare:true}` at `verify.ts:229` and on print/PDF export.

### Other trust gaps

| ID | Finding | Severity |
|---|---|:---:|
| **G-03** | **Tier detection is presence-based, not crypto-verified.** `detectTrustState`/`sealForDocument` pick the tier purely from which lines are present, so a forged `certify:` line with an attacker key can render a gold "CERTIFIED" seal unless every surface passes a *verified* tier in. Unresolved across the swarm. | High |
| **G-02** | CRLF/trailing-whitespace break untampered seals (cried-wolf false positives). | High |
| **G-10** | No external time anchor for native `.it` seals — timestamps are self-asserted/backdatable. | Medium |
| **G-21** | Attachment `data:` URI mime is not sanitized (`mime:text/html` → stored-XSS trap for hosts that open it non-sandboxed). No confirmed live exploit. | Low |

**Standards alignment:** PAdES is real and correct at **B-B / B-T** (CMS SignedData, ESS signing-certificate-v2, ECDSA-P256, RFC-3161 — confirmed against a live DigiCert TSA). But it is **self-signed, un-chained, no LTV/DSS** → **AdES, not QES**. The more generous "court-recognized" framing in some docs should be suppressed; the standards-conformance read is authoritative here.

---

## 5. Enterprise readiness

A serious company could **safely adopt `@dotit/core` as an embedded library today** — well-tested, semver-disciplined, versions-pinned (npm matches the repo byte-for-byte), with a never-throw safe parser and a credible seal-stability contract. Betting the business on the **full stack** (desktop, UTS authority, hub) is premature.

**Per-package maturity:**

| Surface | Maturity | Note |
|---|---|---|
| `@dotit/core`, `sign`, `pades`, `pdf`, `math`, `mcp`, `editor` | **Published & green** | All live on npm at claimed versions; build + test clean. |
| Verify portal, MCP server | **Production-ready** | Fully client-side verify; 17-tool MCP surface with stdio + HTTP. |
| Desktop (Electron) | **Beta, unsigned** | Real Electron app; **unsigned/unnotarized** + a reintroduced path-traversal hole. |
| Hub, Python bridge | **Experimental** | Self-labeled "not part of v4"; Python shells out to Node. |

**What a CTO due-diligence flags:**

- **Bus factor of 1 [G-08, CRITICAL].** All 326 human commits are from one author over ~4 months; "IntentText Team" is one person. No co-maintainer, no governance, no succession, and the UTS root key would depend on this one individual. Most procurement explicitly scores this as disqualifying for a third-party bet.
- **Doc-reality drift [G-14].** The desktop migrated Tauri→Electron, but `DEPLOYMENT.md`, the `cargo` dependabot job, and the entire Wave-1 hardening plan still describe deleted Rust code. An operator following `DEPLOYMENT.md` cannot ship the desktop app.
- **Security regression [G-12, HIGH].** The Tauri `fs.rs` path-scoping guards did **not** carry to Electron: `read/write/delete/rename/open_external` take raw paths (`main/index.ts:199-254`) with `sandbox:false`, so any renderer XSS over an untrusted `.it` yields full-disk read/write. This *contradicts* the plan's "Wave 1 security criticals COMPLETE" claim.
- **Unsigned binaries [G-13].** Gatekeeper/SmartScreen on every install — a hard blocker for managed fleets. (Doc-confirmed via commented `CSC_LINK`, not build-confirmed.)
- **CI gates only ~6 of 15 units [G-11].** `pdf`/`pades`/`math`/`uts-certify`/`hub`/desktop never run in CI; the 64-test `@dotit/editor` suite is orphaned (no test script); and `pnpm -r test` — the documented repo command — **exits 1** because `packages/action` declares a test script but ships zero test files.
- **Broken ERP entry points [G-04, HIGH for the user's path].** The most copy-pasted handlers (`erp-express-handlers.mjs`, `erp-fastify-handlers.mjs`) import a **non-existent** `@dotit/pdf-runtime` and call `runtime.createPdf` (not the real `issuePDF`/`issueDocument`) — they throw on startup. Use `erp-service.mjs` / `@dotit/pdf` instead.

**Recommended posture:** adopt the MIT core library now with source vendored/pinned; treat desktop, hub, and UTS as pre-1.0 pilots, not contractable products.

---

## 6. Government readiness

**Gov readiness today is effectively zero, and the current stack should not be marketed as gov-ready.** The honest distinction: *"gov-ready today = zero"* but *"gov-architecturally-viable-if-export-is-fixed = plausible, multi-year."*

**Decisive blockers (confirmed):**

| Blocker | Reality | ID |
|---|---|---|
| Native seal recognized nowhere | A bespoke Ed25519 line-format scheme; no court/eIDAS/national-PKI recognizes it. Legal weight requires the PAdES export. | — |
| PAdES is AdES, not QES | Self-signed, un-chained, **no LTV/B-LT/B-LTA, no QTSP/QSCD, no FIPS/HSM**. Adobe/gov verifiers show "signer not trusted." | G-09 |
| **"veraPDF-validated PDF/A" is FALSE** | The gate has **never passed** — it dies at `puppeteer: not found` (exit 127) before veraPDF runs. A locally-rendered sample embeds **zero fonts** and has XMP/Info metadata mismatch — both hard PDF/A failures. | G-07, **CRITICAL claim** |
| No accessibility | No PDF-UA/Section 508/EN 301 549 validation, no VPAT, no axe/Lighthouse CI. Tagging is shallow (`/Marked true` only). | — |
| UTS is not an accredited authority | Self-operated CA with no trust-list standing; undeployed (HTTP 000). | G-06 |
| Bus factor of 1, no second implementation | Fails most gov supply-chain frameworks on its own. | G-08 |
| No SBOM beyond core, non-blocking CVE scan, no e-invoicing standards | EN16931/UBL/Factur-X/PEPPOL/ZATCA: **zero** support for the regulated GCC market it targets. | G-19 |

**Is gov format-adoption possible?** Not for `.it`-as-record. A brand-new plain-text format will not be accepted as a mandated primary record (gov requires PDF/A, OOXML, ODF), it has no standardization body or installed reader base, and UTS-as-gov-authority is a multi-year, audited, capital-intensive path a single-author project cannot clear. The **only credible on-ramp is the export bridge** — never `.it`-as-record, never UTS-as-authority: an accredited TSP/CA signs and timestamps while `.it` is the internal readable/queryable/sealed editing layer that exports to a genuinely-veraPDF-green PDF/A-2B + PAdES-B-LTA chained to a trust-list CA, plus EN16931/UBL where invoicing is mandated. Lead with an on-prem/licensed tier (a ministry/bank runs its own node), not a public authority model. The versioned-canonicalizer design is the one genuinely gov-relevant asset already in place. **This is a 3–5 year path, not a near-term market.**

---

## 7. Top strengths / Top risks / Kill shots

### Top strengths

1. **The core engine is genuinely production-grade and verifiable** — 1,161 green tests incl. a 6,000-seed property-based byte-preservation gate (a real CI release-blocker), from-scratch SHA-256 byte-identical to Node, 0 TODO/HACK, ~0 real `as any` — confirmed by independent runs, not doc claims.
2. **Seal-versioning is correctly engineered for long-lived records** — every seal stamps `spec:`; `verifyDocument` dispatches on the *recorded* spec forever via a frozen registry, so a future rule change can never silently invalidate a historical seal.
3. **Crypto primitives are real, not stubs** — Ed25519 binds `(hash|signer|role|at)`; `@dotit/pades` produces standards-correct CMS/X.509 PAdES-B-B/B-T, confirmed against a live DigiCert TSA.
4. **The ERP-embedding wedge is honest and code-verified end to end** — template+JSON → merge → render → seal → verify runs at ~475 docs/sec; inside the user's own ERP this sidesteps every adoption and trust-bootstrap problem.
5. **Docs are unusually candid** — `TRUST-MOAT.md` concedes the mechanism is trivially cloneable; `identity.md`/`SECURITY-MODEL.md` correctly bound the seal to integrity + claimed-identity; `SPEC.md §5.1` honestly limits byte-stability to canonical form.

### Top risks

1. **Styling-exclusion content-integrity hole** [G-01, CRITICAL] — sealed clauses can be rendered invisible while `verifyDocument()` says `intact:true` and the official portal shows a clean preview. Conflicts with the "restyle without breaking a seal" pillar, so the fix is a design decision.
2. **CRLF/trailing-whitespace silently break untampered seals** [G-02, HIGH] — fatal for an ERP round-tripping `.it` through mixed-OS/git storage.
3. **The entire recurring-revenue moat (UTS) is undeployed** [G-06, CRITICAL] — HTTP 000, placeholder trust-anchor key, no live surface where a counterparty can certify or verify.
4. **Bus factor of 1** [G-08, HIGH] — one author, no governance/succession, no second implementation or published conformance vectors. Disqualifying for any procured/gov system; a single point of failure for the UTS root key.
5. **Standards/export bridge is broken or absent where it is sold** [G-07/G-09/G-19, HIGH] — false "veraPDF-validated PDF/A," self-signed no-LTV PAdES, no FIPS/QSCD, no PDF-UA/508, zero e-invoicing standards.

### Kill shots

1. **Sealed-content forgery via excluded styling.** Until verify/print/PDF render bare-by-default (or a second appearance-hash warns), the visual seal is **not trustworthy as proof a printed contract matches what was sealed** — confirmed with `verify.ts:229` rendering non-bare beside a green "intact" verdict.
2. **Undeployed business + broken export bridge.** No recurring-revenue path or network-effect engine (UTS HTTP 000), and no real PDF/A on-ramp to gov/archival (veraPDF has never passed). The two best-evidenced strategic facts, both independently probed.
3. **A bespoke ~26K-LOC parser/renderer/crypto maintained by one person, sold as a brand-new format against Word/PDF/Markdown network effects, with no second implementation and no foreign verifier.** For any third-party or gov adoption this is near-insurmountable — **only the embed-in-your-own-ERP path survives it.**

---

## Bottom line for the founder

**Proceed with the ERP-embedding path — it is the single most defensible use of this project and dissolves every strategic kill shot.** But treat it as *"adopt the MIT core library, vendor/pin the source, build the productization yourself,"* not *"buy the stack."*

**Gating prerequisites before you rely on the seal in production:**

1. Fix the **styling-exclusion forgery** [G-01] and **CRLF seal-break** [G-02] — these two bugs directly undermine the seal that is the entire value-add, and an ERP storing `.it` under git/Windows *will* hit CRLF.
2. Ensure every surface passes a **crypto-verified** trust tier [G-03], not the presence-based default.
3. **Do not** copy the shipped Express/Fastify handlers — they import a non-existent `@dotit/pdf-runtime` and throw [G-04]; use `erp-service.mjs` / `@dotit/pdf issuePDF`.
4. **Own per-tenant key custody from day one** (HSM/KMS, session-bound signer) — zero multi-tenant code exists [G-05].

**Architecturally:** keep all business data, calculations (totals/tax/currency), and reporting in your RDBMS [G-15, G-16] — `.it` query is intra-document only and merge has no arithmetic; treat `.it` as a generated sealed artifact, store the sealed `.it` on the record plus archive the PDF, and pool the Chrome/PDF path (the only horizontal-scaling cost). Pilot with **one** document type (invoices). **Avoid** folder-query reporting at scale, expecting templates to compute totals, and treating `it↔docx` as faithful interop.

**Do not pursue government adoption of the `.it` format itself, and do not market the current stack as gov-ready.** The only credible gov on-ramp is a fixed export bridge (genuinely-green PDF/A + PAdES-B-LTA via an accredited QTSP + EN16931/UBL), led with an on-prem/licensed tier — a 3–5 year path, not a near-term market.