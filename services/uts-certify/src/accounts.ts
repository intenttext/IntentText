/**
 * accounts.ts — file-backed account / API-key store.
 *
 * `accounts.json` (gitignored) maps an API key → the account it certifies for.
 * This stands in for the real signup + billing onboarding (Phase 3c): in
 * production this is a database row with plan, quota, and identity status. Here
 * it is just enough to authenticate a /certify call and know which account to
 * stamp.
 *
 * API keys are opaque bearer secrets. Keep accounts.json out of version control
 * (it is gitignored) and treat it like a credential file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const STORE_FILE = resolve(HERE, "..", "accounts.json");

export interface AccountRecord {
  /** The account identifier stamped into the certify: line (e.g. "acme-corp"). */
  account: string;
  /** Human label for dashboards / logs. */
  label: string;
  createdAt: string;
}

/** apiKey → account record. */
export type AccountStore = Record<string, AccountRecord>;

export function loadAccounts(): AccountStore {
  if (!existsSync(STORE_FILE)) return {};
  return JSON.parse(readFileSync(STORE_FILE, "utf8")) as AccountStore;
}

function saveAccounts(store: AccountStore): void {
  mkdirSync(dirname(STORE_FILE), { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

/** Generate a fresh opaque API key. */
export function generateApiKey(): string {
  return "uts_" + randomBytes(24).toString("base64url");
}

/**
 * Add an account and return its new API key. Used by scripts/issue-key.mjs
 * (the stand-in for signup/billing onboarding).
 */
export function issueKey(account: string, label: string): { apiKey: string; record: AccountRecord } {
  const store = loadAccounts();
  const apiKey = generateApiKey();
  const record: AccountRecord = { account, label, createdAt: new Date().toISOString() };
  store[apiKey] = record;
  saveAccounts(store);
  return { apiKey, record };
}

/** Look up the account for a bearer API key, or null if unknown. */
export function lookupAccount(apiKey: string | undefined): AccountRecord | null {
  if (!apiKey) return null;
  const store = loadAccounts();
  return store[apiKey] ?? null;
}

/**
 * Seed one demo account so the service is testable out of the box. Idempotent:
 * if a demo key already exists it is reused. Returns the demo API key.
 */
export function ensureDemoAccount(): { apiKey: string; account: string } {
  const store = loadAccounts();
  const existing = Object.entries(store).find(([, r]) => r.account === "demo");
  if (existing) return { apiKey: existing[0], account: "demo" };
  const { apiKey } = issueKey("demo", "Demo account (seeded)");
  return { apiKey, account: "demo" };
}

export const STORE_FILE_PATH = STORE_FILE;
