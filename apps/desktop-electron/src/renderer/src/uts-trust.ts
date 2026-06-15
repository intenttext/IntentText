/**
 * uts-trust.ts — the UTS authority public key(s) the portal trusts.
 *
 * This is a build-time constant. In production it is UTS's PUBLISHED public key,
 * fetched once from https://api.uts.qa/.well-known/uts-pubkey (or baked at build
 * time from that source). A `certify: UTS | …` line only verifies as *trusted*
 * when its embedded `key:` matches the value here — so a forged "UTS" line signed
 * with any other key is rejected (signatureValid may be true, but trusted/valid
 * are false).
 *
 * To trust additional / rotated UTS keys, add them under the same issuer in a
 * production deployment that keys on a published key history.
 *
 * The value below is the public key produced by the reference service in
 * services/uts-certify (GET /.well-known/uts-pubkey). Replace it with the real
 * api.uts.qa key for production.
 */
export const trustedIssuers: Record<string, string> = {
  UTS: "ex-xnkoZ8A5AaQhuFiMdN0bR3JO4l-baSIOS545Vgao",
};
