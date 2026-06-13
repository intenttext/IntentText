# @dotit/uts-certify — reference UTS certification service

The reference backend for **api.uts.qa**. It issues **UTS certifications** over
IntentText (`.it`) documents: a UTS-signed Ed25519 timestamp over the document's
content hash, account, and time. Anyone can verify that certification **offline**
against UTS's published public key — no server, no network.

This is the **reference implementation**, not the full product. It is deliberately
minimal and readable. It consumes the published crypto library
[`@dotit/sign`](../../packages/sign) — it does not reimplement signature math.

```
@dotit/core   → "has the content changed?"      (SHA-256 integrity seal)
@dotit/sign   → "who signed it?"                 (Ed25519 author signatures)
UTS certify   → "UTS attests: account X, at T"   (this service)
```

## What it proves (Phase 3a)

A `certify:` line proves: **UTS saw this exact content at this time, on behalf of
this account.** That is a *provable timestamp* bound to an account — the wedge for
"this existed by then, under this account."

It does **not** yet prove the account belongs to a verified real-world identity.
That is **Phase 3b (KYC / identity attestation)**.

## Run

```bash
pnpm install            # from the monorepo root
pnpm --filter @dotit/uts-certify dev      # tsx watch, no build step
# or
pnpm --filter @dotit/uts-certify build && pnpm --filter @dotit/uts-certify start
```

On first start it generates the UTS authority keypair into `.keys/uts.json`
(gitignored, chmod 0600), seeds a `demo` account, and prints the public key + the
demo API key. The service listens on `http://localhost:8787` (override `PORT`).

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/.well-known/uts-pubkey` | none | Published authority public key: `{ issuer, publicKey, algorithm }` |
| `GET` | `/pubkey` | none | Alias of the above |
| `GET` | `/health` | none | Liveness |
| `POST` | `/certify` | Bearer API key | Certify a document — body `{ source }`; returns `{ source, at, account, issuer }` |
| `POST` | `/verify` | none | Convenience: verify a document against this service's own key |

`POST /certify` flow: validate the `Authorization: Bearer <apiKey>` → look up the
account that key belongs to → `certifyDocument(source, { issuer: "UTS", account, issuerPrivateKey })`
→ return the source with a `certify:` line embedded. Unknown/missing keys → `401`.

The `certify:` line format (from `@dotit/sign`):

```
certify: UTS | account: <acct> | at: <iso> | hash: sha256:… | key: ed25519:<utsPub> | sig: <sig>
```

## Accounts & API keys

A simple file-backed store, `accounts.json` (gitignored), maps `apiKey → { account, label, createdAt }`.
This stands in for real signup + billing onboarding (**Phase 3c**). Mint a key
with the admin script:

```bash
pnpm --filter @dotit/uts-certify issue-key acme-corp "Acme Corporation"
```

It prints the API key **once**. A `demo` account is seeded automatically on first
start so the service is testable out of the box.

## Security notes

- **Key custody:** the authority **private** key lives only in this process,
  loaded from `.keys/uts.json`. It is **never** returned by any route. Only the
  public key is published. Treat `.keys/` and `accounts.json` as secrets — both
  are gitignored.
- **Rotation:** to rotate, replace `.keys/uts.json`, restart (a fresh keypair is
  generated), and **republish** the new public key (verifiers must trust it).
  Documents certified under an old key keep verifying only for clients that still
  trust that key, so production publishes a key *history*, not a single key.
- **Verification is client-side.** `verify.uts.qa` and any consumer can verify a
  `certify:` line offline using the published public key; `POST /verify` is only a
  convenience for API callers.

## Deferred (next phases)

- **Phase 3b — identity / KYC:** bind an account to a verified real-world identity,
  so a certification attests *who*, not just *when*.
- **Phase 3c — billing / dashboard:** self-serve signup, plans, quotas, key
  management (replaces `accounts.json` + `issue-key.mjs`).
