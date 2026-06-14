---
sidebar_position: 17
title: Threat Model
---

# Threat Model

What IntentText defends against, what it deliberately does not, and where the trust
boundaries are. This is a public summary for security reviewers and procurement; it pairs
with the [Trust & Integrity Specification](./trust-spec.md) (the normative crypto rules)
and [SECURITY.md](https://github.com/intenttext/IntentText/blob/main/SECURITY.md)
(reporting).

## Assets we protect

1. **Document integrity** — proof that a sealed `.it` document has not changed.
2. **Signer identity** — proof that a specific key holder signed specific content.
3. **Authority certification** — a third party (UTS) vouching for an account/entity + time.
4. **Signing keys** — the Ed25519 private keys (a user's desktop identity; the UTS
   intermediate; the offline UTS root).

## Trust boundaries

| Boundary | Crosses it | Notes |
| --- | --- | --- |
| The user's machine | nothing, for local tools | core/CLI/desktop are fully offline |
| Browser ↔ page (verify portal) | the dropped file stays in the page | 100% client-side |
| Client ↔ UTS service | only the content **hash** + account (API key) | never the document body |
| UTS online (intermediate) ↔ offline root | only ICA tokens (root signs intermediates) | root private key never online |

## Adversaries & what stops them

### A document tamperer (edits a sealed/signed/certified doc)
- **Mitigation:** the content hash is recomputed on verification; any change to the body
  breaks the seal (`modified`), the signature (`invalid`), and any certification (`invalid`).
  Hashing is NFC-normalized so only *visual* changes count, not encoding noise.
- **Residual:** none for integrity — tampering is always detectable by verification.

### A signature/certification forger
- **Mitigation:** signatures are Ed25519 over the content hash; a forged `sign:`/`certify:`
  line with a bogus signature fails verification. A real certification **copied onto
  different content** fails (the signature binds to that content's hash). A `certify: UTS`
  line signed by any key other than the trusted UTS key verifies as **untrusted**.
- **Residual:** a plaintext `sign:`/`approve:` line with no `key:`+`sig:` is an on-record
  claim only — it is **not** proof and the UI labels it as such.

### A malicious `.it` document (XSS / DoS against a viewer)
- **Mitigation:** rendering escapes content; embedded SVG is sanitized (script /
  foreignObject / SMIL / `on*` / `javascript:` refs stripped) and Mermaid is escaped;
  merge-data is escaped in the issued PDF/HTML. The parser caps input size (10 MB),
  line count, per-line length, block count, and embed depth; the desktop caps file reads
  (64 MB). The verify portal sandboxes the preview in an isolated `<iframe>`. The desktop
  webview runs under a Content-Security-Policy.
- **Residual:** `type: iframe` embeds may load external URLs (clickjacking/exfil surface);
  treat untrusted iframes with care.

### A network attacker (UTS service)
- **Mitigation:** the service refuses plaintext in production (HTTPS-only behind a trusted
  proxy); rate limiting per key/IP; admin auth; conservative security headers. Only the
  content hash + account ID transit — never the document.
- **Residual:** depends on correct operator deployment (TLS termination, secret manager).

### A database thief (UTS service)
- **Mitigation:** the signing key is stored only as an AES-256-GCM envelope whose KEK lives
  in a secret manager (not the DB); API keys are stored only as SHA-256 hashes. A DB dump
  alone cannot forge certifications or recover usable keys.

### A compromised UTS signing key
- **Mitigation:** revocation — an operator can revoke a content hash or an entire signing
  key; `/verify` and the published `/revocations` list reflect it. The offline root can
  mint a fresh intermediate; the root private key is never online. (See
  [INCIDENT-RESPONSE](https://github.com/intenttext/IntentText) runbook.)
- **Residual / in progress:** offline verifiers (verify portal, desktop) do not yet
  auto-pin the revocation list, and the list is not yet signed for offline tamper-evidence
  — both are tracked follow-ups. Until then, revocation is enforced at the service `/verify`.

### A thief of a user's desktop signing key
- **Mitigation:** the desktop private key is stored in the OS keychain (macOS Keychain /
  Windows Credential Manager), never in a file or the document.
- **Residual:** an attacker with full control of an unlocked machine can use the key — as
  with any local credential. Code-signing + a keychain-access entitlement (planned) tighten
  this further.

## Non-goals (explicitly out of scope)

- **Confidentiality of document contents at rest** — `.it` is plaintext; encrypt the
  storage/transport layer if needed.
- **Defending an already-compromised OS** or a malicious local user with the keychain
  unlocked.
- **Proving a plaintext approval** — only cryptographic signatures/certifications prove
  identity; plaintext `sign:`/`approve:` are records of intent.
- **Anti-coercion** — we prove *what* was signed and *by which key*, not that the signer
  acted freely.

## Privacy posture

No telemetry anywhere. The verify portal and all local tools make no network calls with
document content. The only data leaving the machine is the SHA-256 hash sent to the UTS
service when a user chooses to certify. See
[PRIVACY.md](https://github.com/intenttext/IntentText/blob/main/PRIVACY.md).
