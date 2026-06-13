#!/usr/bin/env node
/**
 * dotit-sign — Ed25519 signing CLI for IntentText (.it) documents.
 *
 *   dotit-sign keygen [--out key.json]      generate a keypair
 *   dotit-sign sign <file.it> --key key.json --signer "Name" [--role "CEO"]
 *   dotit-sign verify <file.it>             verify all signatures
 *
 * Self-verifying: a signed .it embeds each signer's public key, so `verify`
 * needs nothing but the file itself.
 */
const fs = require("fs");
const {
  generateSigningKey,
  publicKeyFor,
  signDocumentCrypto,
  verifyDocumentSignatures,
} = require("./dist/index.js");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const cmd = process.argv[2];

if (cmd === "keygen") {
  const key = generateSigningKey();
  const out = arg("--out", null);
  if (out) {
    fs.writeFileSync(out, JSON.stringify(key, null, 2));
    fs.chmodSync(out, 0o600);
    console.log(`🔑 Keypair written to ${out} (keep the private key secret).`);
    console.log(`   Public key: ${key.publicKey}`);
  } else {
    console.log(JSON.stringify(key, null, 2));
    console.error("\n⚠  Save this. The private key is shown once. Use --out to write a protected file.");
  }
  process.exit(0);
}

if (cmd === "sign") {
  const file = process.argv[3];
  const keyFile = arg("--key", null);
  const signer = arg("--signer", null);
  const role = arg("--role", null);
  if (!file || !keyFile || !signer) {
    console.error('Usage: dotit-sign sign <file.it> --key key.json --signer "Name" [--role "CEO"]');
    process.exit(2);
  }
  const source = fs.readFileSync(file, "utf8");
  const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
  const res = signDocumentCrypto(source, { signer, role: role || undefined, privateKey: key.privateKey });
  if (res.note === "already-signed") {
    console.log(`✓ ${signer} (key ${res.publicKey.slice(0, 12)}…) already signed — no change.`);
    process.exit(0);
  }
  fs.writeFileSync(file, res.source);
  console.log(`✓ Signed ${file} as "${signer}"${role ? ` (${role})` : ""}.`);
  console.log(`  Public key: ${res.publicKey}`);
  process.exit(0);
}

if (cmd === "verify") {
  const file = process.argv[3];
  if (!file) {
    console.error("Usage: dotit-sign verify <file.it>");
    process.exit(2);
  }
  const source = fs.readFileSync(file, "utf8");
  const v = verifyDocumentSignatures(source);
  const crypto = v.signatures.filter((s) => s.cryptographic);
  if (crypto.length === 0) {
    console.log("No cryptographic signatures found (document may be integrity-sealed only).");
    process.exit(0);
  }
  console.log(`Document hash: ${v.hash}\n`);
  for (const s of v.signatures) {
    if (!s.cryptographic) {
      console.log(`  ◦ ${s.signer}${s.role ? `, ${s.role}` : ""} — text approval (not cryptographic)`);
      continue;
    }
    const mark = s.valid ? "✓ VALID  " : "✗ INVALID";
    console.log(`  ${mark} ${s.signer}${s.role ? `, ${s.role}` : ""}  key ${s.publicKey.slice(0, 12)}…${s.valid ? "" : `  (${s.reason})`}`);
  }
  console.log(
    `\n${v.allSignaturesValid ? "✓" : "✗"} ${v.validCount}/${crypto.length} signature(s) valid against current content.`,
  );
  process.exit(v.allSignaturesValid ? 0 : 1);
}

console.error("dotit-sign — Ed25519 signatures for .it documents");
console.error("Commands: keygen [--out file] · sign <file> --key k.json --signer N [--role R] · verify <file>");
process.exit(cmd ? 2 : 0);
