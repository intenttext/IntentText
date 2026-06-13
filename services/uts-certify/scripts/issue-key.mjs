#!/usr/bin/env node
/**
 * issue-key.mjs — admin tool to onboard an account and mint an API key.
 *
 * Talks directly to MongoDB via the same data-access layer the server uses:
 * creates the account if it doesn't exist, then mints an API key and prints it
 * ONCE (only its sha256 hash is stored — copy the key now).
 *
 *   pnpm issue-key <account> [label]
 *   node --import tsx scripts/issue-key.mjs acme-corp "Acme Corporation"
 *
 * Requires MONGODB_URI (and optionally DB_NAME) in the environment — the same
 * MongoDB the service uses. This stands in for self-serve signup (Phase 3c).
 *
 * Note: this only mints a TIMESTAMP-only account. To embed a verified legal
 * entity, run the KYC step against the running service:
 *   POST /admin/accounts/<account>/verify { entity, cr? }
 */
import { connectDb, closeDb } from "../src/db.ts";
import { getAccount, createAccount, mintApiKey } from "../src/accounts.ts";

const account = process.argv[2];
const label = process.argv[3] ?? account;

if (!account) {
  console.error("Usage: pnpm issue-key <account> [label]");
  console.error('Example: pnpm issue-key acme-corp "Acme Corporation"');
  process.exit(2);
}

try {
  await connectDb();
  if (!(await getAccount(account))) {
    await createAccount({ account, label });
    console.log(`\n  Created account "${account}" (${label})`);
  } else {
    console.log(`\n  Account "${account}" already exists — minting an additional key.`);
  }
  const { apiKey, doc } = await mintApiKey(account, label);
  console.log(`  API key (save this — shown once):\n`);
  console.log(`    ${apiKey}\n`);
  console.log(`  Prefix (for revoke):  ${doc.prefix}`);
  console.log(`  Use it:`);
  console.log(`    curl -X POST http://localhost:8787/certify \\`);
  console.log(`      -H "Authorization: Bearer ${apiKey}" \\`);
  console.log(`      -H "Content-Type: application/json" \\`);
  console.log(`      -d '{"source":"title: Hello\\n"}'\n`);
} catch (e) {
  console.error(`\n  Failed: ${e.message}\n`);
  process.exitCode = 1;
} finally {
  await closeDb();
}
