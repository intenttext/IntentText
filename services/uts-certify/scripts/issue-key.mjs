#!/usr/bin/env node
/**
 * issue-key.mjs — admin tool to onboard an account and mint an API key.
 *
 * This stands in for the real signup + billing flow (Phase 3c). It appends an
 * account to accounts.json and prints a fresh API key ONCE (it is not stored
 * anywhere else — copy it now).
 *
 *   pnpm issue-key <account> [label]
 *   node --import tsx scripts/issue-key.mjs acme-corp "Acme Corporation"
 *
 * The key is the bearer secret a caller passes as `Authorization: Bearer <key>`
 * to POST /certify; the service stamps the certify: line for <account>.
 *
 * Run via tsx so it shares the TypeScript source with the server (no build step
 * required): the `issue-key` package script wires that up.
 */
import { issueKey } from "../src/accounts.ts";

const account = process.argv[2];
const label = process.argv[3] ?? account;

if (!account) {
  console.error("Usage: pnpm issue-key <account> [label]");
  console.error('Example: pnpm issue-key acme-corp "Acme Corporation"');
  process.exit(2);
}

const { apiKey, record } = issueKey(account, label);
console.log(`\n  Issued API key for account "${record.account}" (${record.label})`);
console.log(`  API key (save this — shown once):\n`);
console.log(`    ${apiKey}\n`);
console.log(`  Use it:`);
console.log(`    curl -X POST http://localhost:8787/certify \\`);
console.log(`      -H "Authorization: Bearer ${apiKey}" \\`);
console.log(`      -H "Content-Type: application/json" \\`);
console.log(`      -d '{"source":"title: Hello\\n"}'\n`);
