/**
 * Storage integrity — keep a database (or any storage layer) from silently
 * altering a `.it` document's bytes.
 *
 * A `.it` is just UTF-8 text, so it can live in a DB field (MongoDB string,
 * SQLite TEXT, …) instead of a file. The only risk is a storage layer that
 * normalizes, trims, re-encodes, or "helpfully" rewrites the text — which would
 * change the bytes and break any seal or signature bound to them.
 *
 * This is the guard: wrap the source with a SHA-256 tag over the EXACT bytes on
 * write, and verify it on read. If the stored bytes ever differ from what was
 * written, `fromStorageRecord` throws — so corruption is caught at read time,
 * loudly, instead of surfacing later as a mysterious "signature invalid".
 *
 * Note this is DISTINCT from the seal hash (`computeDocumentHash`), which hashes
 * only the content body (excluding sign:/freeze:/certify:) to detect *content
 * tampering*. `bytesSha256` here hashes the WHOLE source — every byte, including
 * trust lines — to detect *storage corruption*. Different jobs, same primitive.
 */
import { sha256Hex } from "./sha256";

export interface StoredDocument {
  /** The exact `.it` source. Store as UTF-8 text with NO normalization. */
  source: string;
  /** SHA-256 (hex) of the exact source bytes, set at write time. */
  bytesSha256: string;
}

/** Pack a `.it` source for storage, tagging it with a byte-integrity hash. */
export function toStorageRecord(source: string): StoredDocument {
  return { source, bytesSha256: sha256Hex(source) };
}

/** True if the stored source still matches its byte-integrity tag. */
export function verifyStorageRecord(rec: StoredDocument): boolean {
  return sha256Hex(rec.source) === rec.bytesSha256;
}

/**
 * Read a stored `.it` back, verifying the storage layer preserved it
 * byte-for-byte. Throws if the bytes were altered — never returns silently
 * corrupted content.
 */
export function fromStorageRecord(rec: StoredDocument): string {
  const actual = sha256Hex(rec.source);
  if (actual !== rec.bytesSha256) {
    throw new Error(
      `.it storage integrity check failed — the stored bytes do not match the ` +
        `integrity tag (expected ${rec.bytesSha256.slice(0, 12)}…, got ${actual.slice(0, 12)}…). ` +
        `The storage layer must preserve the source exactly: UTF-8 text, no ` +
        `normalization, trimming, or re-encoding.`,
    );
  }
  return rec.source;
}
