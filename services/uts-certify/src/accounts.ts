/**
 * accounts.ts — Mongo-backed account & API-key operations.
 *
 * This is the data-access layer the server's admin endpoints and the issue-key
 * script share. API keys are opaque bearer secrets: the plaintext is returned to
 * the operator exactly ONCE at mint time and only its sha256 hash is persisted,
 * so a database compromise never leaks usable keys.
 */
import { randomBytes, createHash } from "node:crypto";
import { getCollections, type AccountDoc, type ApiKeyDoc } from "./db.js";

/** Generate a fresh opaque API key: `uts_` + 32 url-safe random bytes. */
export function generateApiKey(): string {
  return "uts_" + randomBytes(32).toString("base64url");
}

/** sha256 hex of an API key — the only form ever stored or compared. */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/** Display prefix (first 12 chars, i.e. `uts_` + 8) for identifying a key. */
export function keyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}

/** Validate an account slug: lowercase alphanumerics + dashes. */
export function isValidSlug(s: unknown): s is string {
  return typeof s === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s);
}

/** Create an account (entityVerified defaults false). Throws if it exists. */
export async function createAccount(input: {
  account: string;
  label: string;
  entity?: string;
  cr?: string;
  plan?: string;
}): Promise<AccountDoc> {
  const { accounts } = getCollections();
  const doc: AccountDoc = {
    account: input.account,
    label: input.label,
    entity: input.entity ?? null,
    entityVerified: false,
    cr: input.cr ?? null,
    plan: input.plan ?? "free",
    createdAt: new Date(),
  };
  await accounts.insertOne(doc);
  return doc;
}

/** Look up an account by slug, or null. */
export async function getAccount(account: string): Promise<AccountDoc | null> {
  const { accounts } = getCollections();
  return accounts.findOne({ account });
}

/**
 * KYC onboarding (Phase 3b): bind a verified legal name (+ optional CR #) to an
 * account and flip entityVerified=true. Returns the updated account, or null if
 * the account does not exist.
 */
export async function verifyAccountEntity(
  account: string,
  entity: string,
  cr?: string,
): Promise<AccountDoc | null> {
  const { accounts } = getCollections();
  return accounts.findOneAndUpdate(
    { account },
    { $set: { entity, entityVerified: true, ...(cr !== undefined ? { cr } : {}) } },
    { returnDocument: "after" },
  );
}

/**
 * Mint a new API key for an account. Persists only the hash + prefix; returns
 * the PLAINTEXT key once. Throws if the account does not exist.
 */
export async function mintApiKey(
  account: string,
  label = "",
): Promise<{ apiKey: string; doc: ApiKeyDoc }> {
  const { apiKeys } = getCollections();
  if (!(await getAccount(account))) {
    throw new Error(`account "${account}" does not exist`);
  }
  const apiKey = generateApiKey();
  const doc: ApiKeyDoc = {
    keyHash: hashApiKey(apiKey),
    prefix: keyPrefix(apiKey),
    account,
    label,
    createdAt: new Date(),
    lastUsedAt: null,
    revoked: false,
  };
  await apiKeys.insertOne(doc);
  return { apiKey, doc };
}

/** Revoke a key by its display prefix. Returns true if a key was revoked. */
export async function revokeKeyByPrefix(prefix: string): Promise<boolean> {
  const { apiKeys } = getCollections();
  const res = await apiKeys.updateOne({ prefix, revoked: false }, { $set: { revoked: true } });
  return res.modifiedCount > 0;
}

/**
 * Resolve a presented API key → its account. Looks up by hash, rejects revoked
 * keys, bumps lastUsedAt, and returns the owning account (or null).
 */
export async function resolveKeyToAccount(
  apiKey: string | undefined,
): Promise<AccountDoc | null> {
  if (!apiKey) return null;
  const { apiKeys } = getCollections();
  const keyHash = hashApiKey(apiKey);
  const keyDoc = await apiKeys.findOne({ keyHash, revoked: false });
  if (!keyDoc) return null;
  // Best-effort usage stamp; don't block the request on it.
  void apiKeys.updateOne({ keyHash }, { $set: { lastUsedAt: new Date() } });
  return getAccount(keyDoc.account);
}
