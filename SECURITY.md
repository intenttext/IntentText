# Security Policy

IntentText (`.it`) is a trust-oriented document format and toolchain — signing,
sealing, and certification are core features. We take security reports seriously and
appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report privately to **security@uts.qa**. If you use encrypted email, mention it and we
will share a key.

Include where you can:

- the affected package/app and version (e.g. `@dotit/core 1.9.0`, desktop 2.10.0),
- a description of the issue and its impact,
- steps to reproduce or a proof-of-concept (a minimal `.it` file is ideal),
- any suggested remediation.

### Our commitment

- **Acknowledgement** within **3 business days**.
- **Triage + severity assessment** within **10 business days**.
- **Fix or mitigation** target: **90 days** for high/critical issues, sooner where
  feasible. We will keep you updated on progress.
- **Credit**: with your permission, we will credit you in the release notes / this file
  once a fix ships. We do not currently run a paid bounty program.

Please give us reasonable time to remediate before any public disclosure.

## Supported versions

Security fixes land on the latest released version of each package/app. We recommend
always running the latest:

| Component | Supported |
| --- | --- |
| `@dotit/core` | latest minor |
| `@dotit/sign` | latest minor |
| `@dotit/pdf`, `@dotit/mcp`, `@dotit/editor` | latest minor |
| Dotit desktop app | latest release |
| UTS certificate service | running deployment only |

## Scope

In scope:

- Cryptographic correctness of signing / sealing / certification (`@dotit/sign`,
  `@dotit/core` trust layer).
- HTML/SVG injection (XSS) when **rendering untrusted `.it` documents** in any surface
  (verify portal, editor, desktop).
- Parser denial-of-service (resource exhaustion, catastrophic backtracking).
- Desktop app sandbox escapes (path traversal, arbitrary file read/write, command
  execution) and the UTS service (authn/authz, key handling).

Out of scope:

- Attacks requiring a already-compromised host or OS.
- Social-engineering of document signers.
- Findings in dependencies already covered by an upstream advisory (please still tell
  us so we can pin/patch).

## What the trust layer does and does not prove

By design, IntentText is explicit about the guarantees of each trust tier — overclaiming
is itself a risk. In short:

- **Sealed (local hash / `freeze:`)** proves **integrity** — the content has not changed
  since sealing. It does **not** prove *who* sealed it.
- **Signed (Ed25519, `@dotit/sign`)** additionally proves **identity** — the holder of a
  specific key signed this content hash.
- **Certified (UTS)** adds a **third-party authority** vouching for the account/entity and
  the time.

A plaintext `approve:`/`sign:` line **without** a `key:`+`sig:` is an integrity-only
record, not cryptographic proof. Verification must always be done cryptographically
(`verifyCryptoSignatures` / `verifyCertifications` / the verify portal), never by visual
inspection of the document text.

> Note: `security@uts.qa` is the intended disclosure address — confirm it is monitored
> before publishing this policy externally.
