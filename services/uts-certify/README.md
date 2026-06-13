# @dotit/uts-certify — reference UTS certification service

The reference backend for **api.uts.qa**. It issues **UTS certifications** over
IntentText (`.it`) documents: a UTS-signed Ed25519 timestamp over the document's
content hash, account, and (when the account is KYC-verified) its verified legal
**entity**. Anyone can verify that certification **offline** against UTS's
published public key — no server, no network.

It consumes the published crypto library
[`@dotit/sign`](../../packages/sign) — it never reimplements signature math.

```
@dotit/core   → "has the content changed?"      (SHA-256 integrity seal)
@dotit/sign   → "who signed it?"                 (Ed25519 author signatures)
UTS certify   → "UTS attests: entity X, at T"    (this service)
```

## What it proves

- **Timestamp-only** (account not yet verified): *UTS saw this exact content at
  this time, on behalf of this account.* A provable timestamp bound to an account.
- **Identity-bound** (Phase 3b — account KYC-verified): additionally, *the account
  belongs to this verified legal entity.* The verified `entity` is folded into the
  signed payload, so tampering with it breaks the signature.

## Architecture

- **Storage:** MongoDB. The operator runs their own MongoDB and sets `MONGODB_URI`;
  the service creates its own collections + indexes inside `DB_NAME` (default `uts`)
  on connect.
- **Key custody:** the authority **private** key comes from a `KeyProvider`
  (`src/keys.ts`), sourced from an env secret (`UTS_PRIVATE_KEY`) or, in production,
  a KMS. It is **never** stored in the database, **never** committed, and **never**
  returned by any route — only the public key is published.
- **API keys:** opaque bearer secrets stored **hashed** (sha256); the plaintext is
  shown once at mint time.

## Setup

```bash
pnpm install                                  # from the monorepo root
cp services/uts-certify/.env.example services/uts-certify/.env
```

Fill in `.env`:

1. **`MONGODB_URI`** — your MongoDB (e.g. `mongodb://localhost:27017`), and
   optionally `DB_NAME` (default `uts`).
2. **`UTS_PRIVATE_KEY`** — generate the authority keypair and set the private key:
   ```bash
   pnpm --filter @dotit/uts-certify gen-key
   ```
   It prints a fresh keypair. Store the **private** key in your secret manager and
   set it as `UTS_PRIVATE_KEY`; publish the **public** key to verifiers (bake it
   into `apps/verify/src/uts-trust.ts`). In **dev**, if `UTS_PRIVATE_KEY` is unset,
   an ephemeral key is generated into `.keys/uts.json` (gitignored) with a loud
   warning. In **production** (`NODE_ENV=production`) a missing key is fatal.
3. **`UTS_ADMIN_TOKEN`** — a long random secret guarding the `/admin/*` endpoints.
4. Optionally **`ISSUER`** (default `UTS`) and **`PORT`** (default `8787`).

Run:

```bash
pnpm --filter @dotit/uts-certify dev          # tsx watch, no build step
# or
pnpm --filter @dotit/uts-certify build && pnpm --filter @dotit/uts-certify start
```

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/.well-known/uts-pubkey` | none | Published authority public key: `{ issuer, publicKey, algorithm }` |
| `GET` | `/pubkey` | none | Alias of the above |
| `GET` | `/health` | none | `{ ok, issuer, db }` (db = connected?) |
| `POST` | `/certify` | Bearer **API key** | Certify `{ source }` → `{ source, at, account, entity, issuer }` |
| `POST` | `/verify` | none | Convenience: verify a document against this service's own key |
| `POST` | `/admin/accounts` | Bearer **admin token** | Create an account `{ account, label, entity?, cr?, plan? }` |
| `POST` | `/admin/accounts/:account/verify` | Bearer **admin token** | KYC: set `{ entity, cr? }`, flip `entityVerified=true` |
| `POST` | `/admin/keys` | Bearer **admin token** | Mint an API key `{ account, label? }` → plaintext **once** |
| `POST` | `/admin/keys/:prefix/revoke` | Bearer **admin token** | Revoke a key by its display prefix |

`POST /certify` flow: `Authorization: Bearer <apiKey>` → sha256 → look up
`uts_api_keys` (not revoked) → resolve the account → if the account is
`entityVerified`, embed + sign its `entity` → `certifyDocument(...)` → append an
audit row → return the source with the `certify:` line. Unknown/missing/revoked
keys → `401`.

The `certify:` line format (from `@dotit/sign`):

```
certify: UTS | account: <acct> | entity: <legal name> | at: <iso> | hash: sha256:… | key: ed25519:<utsPub> | sig: <sig>
```

(`entity` is omitted for timestamp-only accounts.)

## Admin / KYC onboarding (Phase 3b)

All `/admin/*` calls use `Authorization: Bearer <UTS_ADMIN_TOKEN>`.

```bash
# 1. Create an account (timestamp-only until verified)
curl -X POST $API/admin/accounts -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"account":"acme-corp","label":"Acme Corporation"}'

# 2. KYC: bind the verified legal entity (+ commercial-reg #)
curl -X POST $API/admin/accounts/acme-corp/verify -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"entity":"Acme Corp WLL","cr":"CR-12345"}'

# 3. Mint an API key (printed ONCE)
curl -X POST $API/admin/keys -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"account":"acme-corp","label":"prod"}'
```

Or use the admin script (creates the account if missing + mints a key; talks to
the same MongoDB):

```bash
pnpm --filter @dotit/uts-certify issue-key acme-corp "Acme Corporation"
```

(The script mints a timestamp-only key; run the `/admin/.../verify` step to make it
identity-bound.)

## Data model (MongoDB)

| Collection | Shape | Indexes |
|---|---|---|
| `uts_accounts` | `{ account, label, entity\|null, entityVerified, cr\|null, plan, createdAt }` | unique `account` |
| `uts_api_keys` | `{ keyHash (sha256), prefix, account, label, createdAt, lastUsedAt, revoked }` | unique `keyHash`, `prefix` |
| `uts_certifications` | audit log `{ account, entity\|null, hash, issuer, at, createdAt }` | `{ account, createdAt }` |

The authority private key is **not** in any collection.

## Security notes

- **Key custody:** the authority **private** key is supplied via `UTS_PRIVATE_KEY`
  (a secret-manager value) or a KMS — never a committed file, never the database.
  In dev a clearly-marked ephemeral key is generated into `.keys/uts.json`
  (gitignored). Only the public key is ever published. A `KmsKeyProvider` seam is
  documented in `src/keys.ts` for production signing where the raw key never enters
  the process.
- **API keys are stored hashed** (sha256). The plaintext is shown once at mint
  time and is otherwise unrecoverable; a DB compromise leaks no usable keys.
- **Admin token** is separate from API keys and gates all `/admin/*` routes.
- **Verification is client-side.** `verify.uts.qa` and any consumer verify a
  `certify:` line offline using the published public key; `POST /verify` is only a
  convenience.
- Errors don't leak internals; JSON bodies are capped (2 MB).

## Testing

```bash
pnpm --filter @dotit/uts-certify test
```

The round-trip integration test uses `mongodb-memory-server` (in-memory MongoDB)
when available, falls back to a reachable `MONGODB_URI`, and otherwise skips the
DB-backed cases while still proving key custody + API-key hashing.

## Deferred (next phases)

- **Phase 3c — billing / dashboard:** self-serve signup, plans, quotas, Stripe,
  and a key-management UI (replacing the admin token + `issue-key` script).
- **Public deploy** to `api.uts.qa` with the production authority key in a secret
  manager / KMS and the published public key baked into verifiers.
