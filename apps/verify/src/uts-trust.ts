/**
 * uts-trust.ts — the UTS authority public key(s) the portal trusts.
 *
 * The trust anchor is configuration, not a constant baked into the source. In
 * production, set **`VITE_UTS_TRUSTED_KEY`** (and optionally `VITE_UTS_TRUSTED_ISSUER`)
 * at build time to UTS's PUBLISHED public key — fetched once from
 * https://api.uts.qa/.well-known/uts-pubkey. A `certify: UTS | …` line only verifies
 * as *trusted* when its embedded `key:` matches the configured value, so a forged
 * "UTS" line signed with any other key is rejected (`signatureValid` may be true, but
 * `trusted`/`valid` are false).
 *
 * When `VITE_UTS_TRUSTED_KEY` is **not** set, the portal falls back to the
 * `services/uts-certify` REFERENCE key below (GET /.well-known/uts-pubkey). That key is
 * a DEVELOPMENT anchor — it lets the demo show a "certified" verdict, but it is NOT a
 * production authority (the reference service's private half is not a guarded secret).
 * `utsTrustConfigured` is `false` in that case, so any surface can label the result as
 * "reference / not a production trust anchor" rather than presenting it as real
 * authority. This closes the G-06 trap where a placeholder key silently read as
 * production trust.
 *
 * NOTE (G-06, strategy): the UTS trust authority is not yet deployed (api/verify/hub
 * .uts.qa are unreachable). Until it is, treat `.it` certification as an INTERNAL /
 * reference capability and lean on the integrity layer (seal + Ed25519 signature),
 * which is fully self-verifiable offline and needs no authority. See
 * `docs-internal/ROADMAP.md` (UTS deploy-vs-de-scope decision).
 */

// Vite injects import.meta.env at build time; guard for non-Vite (test) contexts.
const env: Record<string, string | undefined> =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env) ||
  {};

/** The reference (DEV) anchor from services/uts-certify. NOT a production authority. */
const DEV_REFERENCE_KEY = "ex-xnkoZ8A5AaQhuFiMdN0bR3JO4l-baSIOS545Vgao";

const configuredKey = (env.VITE_UTS_TRUSTED_KEY || "").trim();
const issuer = (env.VITE_UTS_TRUSTED_ISSUER || "UTS").trim();

/**
 * True only when a real production trust anchor was supplied via
 * `VITE_UTS_TRUSTED_KEY`. False means the portal is running on the DEV reference key —
 * a "certified" result should then be shown as reference-only, never as production
 * authority.
 */
export const utsTrustConfigured = configuredKey.length > 0;

/** Issuer → trusted public key. Override per deployment via the env vars above. */
export const trustedIssuers: Record<string, string> = {
  [issuer]: configuredKey || DEV_REFERENCE_KEY,
};
