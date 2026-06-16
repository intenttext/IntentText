# Privacy & Data Handling

IntentText is **local-first and privacy-by-design**. This document states plainly what
each part of the system does and does not do with your data. It describes the software as
published in this repository; a specific hosted deployment (e.g. `api.uts.qa`) may add an
operator-specific privacy policy on top.

## The short version

- **No telemetry, no analytics, no phone-home** anywhere in the libraries, CLI, editor, or
  desktop app. We do not collect usage data.
- Your **document content stays on your machine**. The only thing that ever leaves it — and
  only if you choose to use the UTS certification service — is the document's **SHA-256
  hash**, never the content itself.
- The **verification portal runs entirely in your browser**. Files you verify are never
  uploaded.
- Everything is **self-hostable**; you can run the certification service on your own
  infrastructure with no dependency on us.

## Component by component

### `@dotit/core`, `@dotit/sign`, `@dotit/pdf`, `@dotit/pades`, `@dotit/math`, `@dotit/editor`, the CLI, and the desktop app
Fully local. Parsing, rendering, hashing, sealing, signing, verification, **forms,
redline/compare, redaction, attachments, and math rendering** all happen on your device.
No network calls, no telemetry. The desktop app's signing identity (an Ed25519 private
key, and the ECDSA PAdES identity) is stored in your **operating system keychain**, never
transmitted. (Two network features are opt-in and explicit — `submitForm` and UTS
certification, below.)

### Forms, attachments & redaction (local; mind the document's own contents)
These operate entirely on the `.it` string in memory, but they change *what the document
contains*, so handle the resulting document accordingly:

- **Attachments** — `addAttachment(..., { data })` **embeds** a file's bytes (possibly
  personal data, e.g. a scanned ID) directly into the `.it` source, and a seal then covers
  them. Prefer `href:` (a reference) to keep personal data out of the document; embed only
  when self-containment is required. The 1 MiB embed cap discourages accidental bloat.
- **Redaction** — `applyRedactions()` **deletes** the marked text from the source (it is
  not recoverable from the output) and returns per-redaction **receipts** (a secret salt +
  commitment). Keep receipts **private** — they let you later prove what was redacted; they
  are deliberately *not* stored in the document.

### Verification portal (e.g. `verify.uts.qa`)
100% client-side. The page loads the verification code and the UTS public key (fetched once,
or baked in at build time); the document you check is parsed and verified **in your browser**
and is never sent anywhere.

### UTS certification service (e.g. `api.uts.qa`) — optional
Used only if you certify documents through a UTS authority. When you certify:

- **What is sent:** the document's content **hash** (`sha256:…`) and your account
  identifier (via your API key). **The document content is not sent.**
- **What is stored:** an audit record of the certification — `{ account, verified entity (if
  any), content hash, issuing key, timestamp }` — plus your account and the SHA-256 *hash*
  of your API key (never the key itself). This is what makes a certification independently
  verifiable later.
- **What is never stored:** document contents, and any private key material in plaintext
  (the authority signing key is envelope-encrypted at rest).
- **Retention:** certification audit records are retained for the life of the certification
  (they must persist for verification and revocation to remain meaningful). Account data is
  removed on account closure subject to the operator's contractual/legal retention terms.
- **Revocation:** an operator can revoke a certification; the revocation list is published so
  verifiers can honor it.
- **X.509 signing certificates (`POST /certify/x509`) — optional.** To issue a PAdES signing
  certificate, the customer sends a **CSR** (a certificate request containing only their
  **public** key); the private signing key is generated locally and **never sent**. UTS
  certifies the public key under the KYC-verified entity and logs only public material
  (subject, serial, fingerprint, validity) — never the key.

### Form submission — `submitForm` / Hub `POST /api/responses` (optional)
`submitForm(source, { endpoint })` **POSTs the form** — the full `.it` `source` (which
includes the answers and any *embedded* attachments), plus the derived answers and content
hash — to the **endpoint you configure**. This is an explicit network send under your
control; nothing is sent anywhere else. The Hub receiver verifies the document's seals and
stores what the operator's handler chooses to store.

### `@dotit/mcp` (AI-agent server)
Runs locally and operates on the documents you give it. It does not send your documents to
any third party; any model access is configured and controlled by you.

## Your rights

Because the libraries and tools are local, you remain in full control of your data. For a
hosted UTS deployment, contact the operator to access or delete account data, subject to the
retention terms above. For the reference deployment, reach **privacy@uts.qa**.

## Subprocessors

The reference UTS service stores data in **MongoDB** (operator-hosted or a managed provider
of the operator's choosing). Operators selling into regulated markets should publish their
specific subprocessor list and a Data Processing Addendum (DPA) for enterprise customers.

> Note: `privacy@uts.qa` is the intended contact for the reference deployment — confirm it is
> monitored before relying on this policy externally.
