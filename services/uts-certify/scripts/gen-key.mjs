#!/usr/bin/env node
/**
 * gen-key.mjs — print a fresh UTS authority keypair.
 *
 * Run this once to bootstrap the authority key, then store the PRIVATE key in
 * your secret manager and inject it as UTS_PRIVATE_KEY. The PUBLIC key is what
 * verifiers (verify.uts.qa, any consumer) must trust.
 *
 *   pnpm --filter @dotit/uts-certify gen-key
 *
 * The private key is printed to stdout and NOT written anywhere — copy it into
 * your secret manager and clear your terminal scrollback.
 */
import { generateSigningKey } from "@dotit/sign";

const { privateKey, publicKey } = generateSigningKey();

console.log("\n  Fresh UTS authority keypair (Ed25519, base64url)\n");
console.log("  PUBLIC KEY (publish to verifiers / bake into uts-trust.ts):");
console.log(`    ${publicKey}\n`);
console.log("  PRIVATE KEY (store in your secret manager; set as UTS_PRIVATE_KEY):");
console.log(`    ${privateKey}\n`);
console.log("  Then run the service with:");
console.log(`    UTS_PRIVATE_KEY="${privateKey}" pnpm --filter @dotit/uts-certify start\n`);
console.log("  Never commit the private key. Never store it in the database.\n");
