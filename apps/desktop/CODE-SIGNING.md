# Code signing & notarization — what we need

Unsigned builds are a non-starter for enterprise/government: macOS Gatekeeper
blocks them ("can't be opened because Apple cannot check it"), Windows SmartScreen
warns ("Windows protected your PC"). This doc lists **exactly** what to obtain so I
can flip signing on. The release workflow (`.github/workflows/desktop-release.yml`)
and electron-builder are already structured to consume these — once the secrets
exist in GitHub, releases sign + notarize automatically.

Status: **builds are currently UNSIGNED.** Send me word when the items below exist
and I'll wire the final switches (it's a small, well-scoped change).

---

## macOS (Gatekeeper + notarization)

**You provide:**
1. **Apple Developer Program** membership (Organization type for gov/enterprise —
   ~$99/yr). Org enrollment needs a D-U-N-S number; allow lead time.
2. A **"Developer ID Application"** certificate (this is the one for distributing a
   `.app`/`.dmg` *outside* the App Store — not "Apple Distribution").
   - Create in the Apple Developer portal → Certificates → "Developer ID Application".
   - Export from Keychain Access as a **`.p12`** with a strong password.
3. **Notarization credentials** — either (recommended) an **App Store Connect API
   key** (Issuer ID + Key ID + `.p8` file), or an **Apple ID + app-specific
   password + Team ID**.

**GitHub repo secrets to add** (Settings → Secrets and variables → Actions):
| Secret | Value |
|---|---|
| `CSC_LINK` | base64 of the `.p12` — `base64 -i cert.p12 \| pbcopy` |
| `CSC_KEY_PASSWORD` | the `.p12` export password |
| `APPLE_ID` | the Apple ID email (notarization) |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char Team ID (Apple Developer → Membership) |

**What I flip on when these exist:** `mac.hardenedRuntime: true`,
`mac.gatekeeperAssess: false`, a hardened-runtime entitlements file, and
`mac.notarize: true`. electron-builder then signs with `CSC_LINK` and staples the
notarization ticket. Result: double-click opens with no warning.

---

## Windows (SmartScreen)

⚠️ **Important current constraint:** since June 2023 the CA/Browser Forum requires
OV/EV code-signing private keys to live on **hardware (HSM/token) or a cloud signing
service** — you can no longer sign in CI from a plain `.pfx` file for newly issued
certs. So pick one:

**Option A — Cloud signing service (best for CI), e.g. Azure Trusted Signing
(cheapest, ~$10/mo), SSL.com eSigner, or DigiCert KeyLocker.**
- You provide the service account/credentials; electron-builder signs via the
  provider. Azure Trusted Signing also gives Microsoft-vouched SmartScreen
  reputation quickly.
- Secrets depend on the provider (e.g. Azure: `AZURE_TENANT_ID`,
  `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, endpoint + account/profile names).

**Option B — EV certificate on a hardware token.** Strongest SmartScreen
reputation from day one, but the token can't run in hosted CI — needs a
self-hosted runner or a manual signing step. Heavier; only worth it if a customer
mandates EV.

**Recommendation:** Azure Trusted Signing (Option A) — cheap, CI-friendly, good
reputation. Tell me which provider you choose and I'll wire that specific signer.

---

## Government-specific note

Some agencies require signing under **their own PKI / internal CA**, specific
**RFC-3161 timestamp authorities**, or FIPS-validated key storage. If a target
customer mandates that, send me their requirement doc and we adapt the signer
(electron-builder supports custom sign hooks + timestamp URLs). The macOS path
above is unaffected (Apple notarization is always required regardless).

---

## TL;DR — the shortest path to signed installers
1. Apple Developer (org) → "Developer ID Application" cert + notarization creds → 5 GitHub secrets.
2. Azure Trusted Signing account → its credentials as GitHub secrets.
3. Ping me; I flip the config + workflow switches and cut a signed `desktop-vX.Y.Z` release.
