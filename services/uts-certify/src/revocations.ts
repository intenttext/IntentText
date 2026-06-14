/**
 * revocations.ts — certificate/key revocation.
 *
 * A UTS certification is a signed timestamp; once issued it verifies forever
 * against the trust anchor. Revocation is the out-of-band signal that a specific
 * certified hash (or an entire compromised signing key) should no longer be
 * trusted. /verify consults this, and the list is published at /revocations so
 * verifiers can pin it.
 */
import { getCollections, type RevocationDoc } from "./db.js";

export async function revoke(input: {
  kind: "hash" | "key";
  value: string;
  issuer: string;
  reason: string;
  revokedBy: string;
}): Promise<RevocationDoc> {
  const { revocations } = getCollections();
  const doc: RevocationDoc = {
    kind: input.kind,
    value: input.value,
    issuer: input.issuer,
    reason: input.reason,
    revokedAt: new Date().toISOString(),
    revokedBy: input.revokedBy,
    createdAt: new Date(),
  };
  // Idempotent: re-revoking the same target keeps the first record.
  await revocations.updateOne(
    { kind: input.kind, value: input.value },
    { $setOnInsert: doc },
    { upsert: true },
  );
  return (await revocations.findOne({ kind: input.kind, value: input.value }))!;
}

/** True if this content hash has been revoked. */
export async function isHashRevoked(hash: string): Promise<boolean> {
  if (!hash) return false;
  const { revocations } = getCollections();
  return !!(await revocations.findOne({ kind: "hash", value: hash }));
}

/** True if this signing (issuer) public key has been revoked. */
export async function isKeyRevoked(key: string): Promise<boolean> {
  if (!key) return false;
  const { revocations } = getCollections();
  return !!(await revocations.findOne({ kind: "key", value: key }));
}

/** The full revocation list (no Mongo _id), newest first. */
export async function listRevocations(): Promise<RevocationDoc[]> {
  const { revocations } = getCollections();
  return revocations
    .find({}, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
}
