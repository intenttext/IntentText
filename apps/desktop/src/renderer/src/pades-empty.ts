// Empty stand-in for @dotit/pades in the RENDERER bundle.
//
// @dotit/pades is a Node-only PAdES/PKI library (pkijs + `node:crypto`'s
// `webcrypto`) and cannot be bundled for the browser. The renderer imports
// @dotit/sign for Ed25519 identity + trust verification, and @dotit/sign LAZILY
// imports @dotit/pades only for OPTIONAL RFC-3161 trusted timestamps — a feature
// the renderer never invokes (PAdES/PDF signing happens in the MAIN process, which
// loads the real package at runtime; see src/main/index.ts). Aliasing pades to this
// stub keeps node:crypto/pkijs out of the browser bundle. Any accidental call
// throws a clear error instead of silently no-oping.
const unavailable = (): never => {
  throw new Error(
    "@dotit/pades is not available in the renderer (Node-only). PAdES signing and " +
      "RFC-3161 timestamps run in the main process.",
  );
};

export const requestTimestampToken = unavailable;
export const verifyTimestampToken = unavailable;
export const signPdf = unavailable;
export const verifyDetachedCms = unavailable;

export default {} as Record<string, unknown>;
