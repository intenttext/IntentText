// tsa.ts — RFC-3161 trusted timestamps. A timestamp authority (TSA) countersigns
// "this signature existed at time T", upgrading a PAdES-B signature to PAdES-T —
// the qualified-timestamp property that makes a signature legally durable (eIDAS).
//
// We build a TimeStampReq over the signature's hash, POST it to a TSA, and return
// the TimeStampToken (a CMS SignedData) for embedding as the signature-timestamp
// unsigned attribute (id-aa-timeStampToken). Uses Node's global fetch.

import * as pkijs from "pkijs";
import * as asn1js from "asn1js";
import { webcrypto } from "node:crypto";

const subtle = (webcrypto as unknown as Crypto).subtle;
const SHA256_OID = "2.16.840.1.101.3.4.2.1";

function ab(u8: Uint8Array): ArrayBuffer {
  return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength
    ? (u8.buffer as ArrayBuffer)
    : (u8.slice().buffer as ArrayBuffer);
}

/** A few well-known free RFC-3161 TSAs (no API key required). */
export const PUBLIC_TSA = {
  digicert: "http://timestamp.digicert.com",
  sectigo: "http://timestamp.sectigo.com",
  swisssign: "http://tsa.swisssign.net",
} as const;

/**
 * Request an RFC-3161 TimeStampToken over `data` (typically a signature value)
 * from `tsaUrl`. Returns the DER bytes of the TimeStampToken (a CMS ContentInfo).
 */
export async function requestTimestampToken(
  data: Uint8Array,
  tsaUrl: string,
): Promise<Uint8Array> {
  const imprint = await subtle.digest("SHA-256", ab(data));

  const tspReq = new pkijs.TimeStampReq({
    version: 1,
    messageImprint: new pkijs.MessageImprint({
      hashAlgorithm: new pkijs.AlgorithmIdentifier({ algorithmId: SHA256_OID }),
      hashedMessage: new asn1js.OctetString({ valueHex: imprint }),
    }),
    certReq: true, // ask the TSA to include its cert (needed to verify offline)
  });

  const reqBytes = new Uint8Array(tspReq.toSchema().toBER(false));
  const resp = await fetch(tsaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/timestamp-query" },
    body: reqBytes,
  });
  if (!resp.ok) throw new Error(`TSA ${tsaUrl} returned HTTP ${resp.status}`);

  const respBytes = new Uint8Array(await resp.arrayBuffer());
  const tspResp = new pkijs.TimeStampResp({
    schema: asn1js.fromBER(ab(respBytes)).result,
  });
  if (!tspResp.timeStampToken) {
    throw new Error(
      `TSA returned no token (PKIStatus ${tspResp.status.status})`,
    );
  }
  return new Uint8Array(tspResp.timeStampToken.toSchema().toBER(false));
}

/** Parse the genTime out of a TimeStampToken (the asserted timestamp). */
export function timestampTokenTime(tstDer: Uint8Array): string | undefined {
  try {
    const ci = new pkijs.ContentInfo({
      schema: asn1js.fromBER(ab(tstDer)).result,
    });
    const sd = new pkijs.SignedData({ schema: ci.content });
    const tstInfo = new pkijs.TSTInfo({
      schema: asn1js.fromBER(
        (sd.encapContentInfo.eContent as asn1js.OctetString).valueBlock.valueHexView,
      ).result,
    });
    return tstInfo.genTime.toISOString();
  } catch {
    return undefined;
  }
}

export interface TimestampVerification {
  /** Overall verdict: the token's CMS signature verifies, its imprint binds to `data`,
   *  and — when trusted roots were supplied — its TSA cert chains to one with the
   *  timestamping EKU. WITHOUT trusted roots this proves the token is well-formed,
   *  untampered, and timestamps THIS data, but NOT that the TSA is genuine (a
   *  self-signed token is still signature+imprint valid) — supply `trustedRoots` and
   *  read `chainTrusted` for an eIDAS-grade check. */
  valid: boolean;
  /** The token's CMS SignedData signature verifies — it was signed by the private key
   *  of its embedded certificate and has not been tampered with. */
  signatureValid: boolean;
  /** The RFC-3161 message imprint equals SHA-256(`data`) — it timestamps THIS data. */
  imprintValid: boolean;
  /** The TSA certificate chains to a supplied trusted root AND carries the timestamping
   *  EKU (id-kp-timeStamping, 1.3.6.1.5.5.7.3.8). `undefined` when no roots supplied. */
  chainTrusted?: boolean;
  /** The TSA's asserted time (ISO), if the token parsed. */
  genTime?: string;
  /** The TSA signer certificate's subject CN, best-effort. */
  tsa?: string;
}

/** id-kp-timeStamping — the EKU an RFC-3161 TSA certificate MUST carry. */
const ID_KP_TIMESTAMPING = "1.3.6.1.5.5.7.3.8";

/**
 * Verify that a TimeStampToken actually anchors `data` — i.e. its RFC-3161 message
 * imprint equals SHA-256(`data`). This is the trust-critical check the request side
 * can't make: it proves the token is a timestamp OF THIS content (the seal hash),
 * not some other data. Returns the asserted `genTime` and the TSA name alongside.
 *
 * This verifies three things: (1) the CMS signature over the TSTInfo (the token is
 * untampered and signed by its embedded cert), (2) the message-imprint binding to
 * `data`, and (3) — only when `trustedRoots` are supplied — that the TSA cert chains
 * to a trusted root and carries the timestamping EKU. Without roots, `valid` proves
 * (1)+(2) but cannot prove the TSA is genuine; pass `trustedRoots` for a full check.
 */
export async function verifyTimestampToken(
  tstDer: Uint8Array,
  data: Uint8Array,
  opts?: { trustedRoots?: pkijs.Certificate[] },
): Promise<TimestampVerification> {
  try {
    const ci = new pkijs.ContentInfo({
      schema: asn1js.fromBER(ab(tstDer)).result,
    });
    const sd = new pkijs.SignedData({ schema: ci.content });
    const tstInfo = new pkijs.TSTInfo({
      schema: asn1js.fromBER(
        (sd.encapContentInfo.eContent as asn1js.OctetString).valueBlock.valueHexView,
      ).result,
    });
    const genTime = tstInfo.genTime.toISOString();

    const asBool = (r: unknown) =>
      typeof r === "boolean"
        ? r
        : (r as { signatureVerified?: boolean }).signatureVerified === true;

    // (1) Manual imprint check (granular reporting): SHA-256 + imprint == SHA-256(data).
    const usesSha256 =
      tstInfo.messageImprint.hashAlgorithm.algorithmId === SHA256_OID;
    const digest = new Uint8Array(await subtle.digest("SHA-256", ab(data)));
    const imprint = new Uint8Array(
      tstInfo.messageImprint.hashedMessage.valueBlock.valueHexView,
    );
    const imprintValid =
      usesSha256 &&
      digest.length === imprint.length &&
      digest.every((b, i) => b === imprint[i]);

    // (2) CMS signature. For an id-ct-TSTInfo eContent, pkijs verifies BOTH the SignerInfo
    //     signature AND the imprint binding to `data` in one call — pass the ORIGINAL
    //     timestamped data (not the eContent). This is the authenticity check the old
    //     code skipped: a tampered/forged-signature token now fails.
    let signatureValid = false;
    try {
      signatureValid = asBool(
        await sd.verify({ signer: 0, data: ab(data), checkChain: false }),
      );
    } catch {
      signatureValid = false;
    }

    // (3) TSA cert chains to a trusted root AND carries id-kp-timeStamping — only when
    //     trust anchors are supplied (pkijs throws on an un-buildable chain → false).
    let chainTrusted: boolean | undefined;
    if (opts?.trustedRoots?.length) {
      try {
        const chainOk = asBool(
          await sd.verify({
            signer: 0,
            data: ab(data),
            checkChain: true,
            trustedCerts: opts.trustedRoots,
          }),
        );
        const cert = sd.certificates?.[0] as pkijs.Certificate | undefined;
        const ekuExt = cert?.extensions?.find((e) => e.extnID === "2.5.29.37");
        const purposes =
          (ekuExt?.parsedValue as { keyPurposes?: string[] } | undefined)
            ?.keyPurposes ?? [];
        chainTrusted = chainOk && purposes.includes(ID_KP_TIMESTAMPING);
      } catch {
        chainTrusted = false;
      }
    }

    let tsa: string | undefined;
    try {
      const cert = sd.certificates?.[0] as pkijs.Certificate | undefined;
      tsa = cert?.subject.typesAndValues.find((t) => t.type === "2.5.4.3")?.value
        .valueBlock.value;
    } catch {
      /* no/parse-less cert — leave tsa undefined */
    }

    const valid =
      signatureValid &&
      imprintValid &&
      (opts?.trustedRoots?.length ? !!chainTrusted : true);

    return { valid, signatureValid, imprintValid, chainTrusted, genTime, tsa };
  } catch {
    return { valid: false, signatureValid: false, imprintValid: false };
  }
}
