# Owner Actions — gaps that need *you* (not code)

These are the assessment gaps that engineering can't close alone — they need a **business
decision**, **external infrastructure** (a CA, an HSM, signing certs), or a **hire**. Each
has the smallest concrete next step so you can pick them up later. Everything else from the
assessment (`ASSESSMENT.md` / `IMPROVEMENT-PLAN.md`) is already shipped.

_Last updated: 2026-06-19._

---

## Decisions (yours to make)

### G-06 — UTS trust authority: deploy or de-scope? · **critical** · *decision*
The recurring-revenue moat (`docs-internal/REVENUE-MODEL.md`) is **undeployed**
(`api`/`verify`/`hub.uts.qa` are unreachable). Pick one, explicitly:
- **(a) Deploy the smallest earning slice** — a keypair + `/certify` + a public verify
  endpoint behind a pinned `.well-known/uts-pubkey`, then set **`VITE_UTS_TRUSTED_KEY`** on the
  verify (and desktop) builds so "certified" means production authority.
- **(b) De-scope to ERP-first** — the embedded-in-Jadwal wedge needs no external authority
  (the seal + Ed25519 signature self-verify offline). Mark UTS "future / on customer pull".

**Engineering already did:** the placeholder trust anchor is env-gated and flagged
(`utsTrustConfigured`), so a dev key can never read as production trust. Decision is recorded in
`docs-internal/ROADMAP.md`.
**Your next step:** choose (a) or (b) and tell us; if (a), stand up the service + key.

---

## External infrastructure (you procure, we wire)

### G-13 — Desktop code-signing & notarization · **high** · *needs certs*
Unsigned `.dmg`/`.exe` trip Gatekeeper/SmartScreen ("unidentified developer"). The release
pipeline is ready; it just needs certificates.
- **macOS:** an Apple **Developer ID Application** cert + notarization (Apple ID + app-specific
  password / API key).
- **Windows:** an OV/EV code-signing cert, or **Azure Trusted Signing** (cloud, no USB token).
**Your next step:** obtain the certs; hand us the secrets and we flip the
`apps/desktop` electron-builder config + `desktop-release.yml` switches.

### G-09 — PAdES B-LTA / QES / FIPS (legal-grade signatures) · **high** · *needs a CA/QTSP*
`@dotit/pades` produces standards-correct **PAdES-B-B/B-T** (self-signed or your own CA) and now
verifies RFC-3161 timestamps (G-10). To reach **qualified** (eIDAS QES) / long-term-archival
(B-LT/B-LTA), you need accredited parties:
- An **eIDAS QTSP** (EU) or your national PKI (e.g. a GCC accredited CA) to issue the signing
  certs; a **qualified TSA** for the timestamps; an **HSM/QSCD** (FIPS 140-2/3) to hold keys.
**Your next step:** select a QTSP / national CA + TSA + HSM; we integrate the CSR/issuance and
add the LTV/DSS (B-LT/B-LTA) embedding.

---

## Organization (you staff)

### G-08 — Bus factor of 1 · **high** · *needs a hire + governance*
326/326 commits are one author; no second maintainer, governance, or succession. This alone
fails most gov/enterprise supply-chain reviews and is a single point of failure for the (future)
UTS root key.
**Your next step:** add a **second committer / key-custodian**; write a short governance +
succession note; escrow the root key. (We can help: publish the conformance vectors + a
from-scratch foreign verifier so the format isn't single-implementation.)

---

## Partially done — your half remains

### G-05 — Multi-tenant signing identity · **high** · *needs your KMS/HSM*
**Done (engineering):** an executable reference + 5 PoC isolation tests
(`packages/sign/tests/multi-tenant-custody.test.ts`) that prove per-tenant custody with real
crypto, including the cross-tenant forgery being caught.
**Your half:** implement the `TenantKeyVault` against a real **KMS/HSM** inside Jadwal (the vault
holds a key *handle*, signs via the HSM, never materializes raw keys), derive `signer`/`role`
from the authenticated session, and add app-side cross-tenant **data-isolation** tests.

### G-07 — PDF/A: get the veraPDF gate green · **high** · *needs a CI run + a font*
**Done (engineering):** Info↔XMP metadata is now consistent (published in `@dotit/pdf` 1.2.1);
docs say "PDF/A-oriented" honestly.
**Your half:** embed an `@font-face` web font (a subset of an open font, e.g. Noto/Liberation) in
the PDF render path so the headless renderer embeds fonts, then run
`.github/workflows/pdfa-verify.yml` to a **green veraPDF pass** and republish `@dotit/pdf`. (Ask
us to do the font-embedding change; the green CI run is yours to trigger/observe.)

---

## Quick status table

| Gap | Type | Your next step |
|---|---|---|
| **G-06** | decision | Deploy UTS slice **or** de-scope to ERP-first |
| **G-13** | certs | Apple Developer ID + Windows OV/EV (or Azure Trusted Signing) |
| **G-09** | CA/QTSP/HSM | Select accredited CA + qualified TSA + FIPS HSM |
| **G-08** | hire | Second maintainer + governance + key escrow |
| **G-05** | KMS/HSM | Build the per-tenant vault on your KMS in Jadwal |
| **G-07** | CI run | Embed a webfont (ask us) → green veraPDF → republish |
