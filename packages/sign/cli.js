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
  certifyDocument,
  verifyCertifications,
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

// AUTHORITY mode: issue a UTS certification (provable timestamp + account). This
// is exactly the operation the UTS server performs at api.uts.qa/certify — run
// here with the authority's key file for testing / self-hosting.
if (cmd === "certify") {
  const file = process.argv[3];
  const keyFile = arg("--key", null);
  const issuer = arg("--issuer", "UTS");
  const account = arg("--account", null);
  if (!file || !keyFile || !account) {
    console.error('Usage: dotit-sign certify <file.it> --key uts-key.json --account "acme-corp" [--issuer UTS]');
    process.exit(2);
  }
  const source = fs.readFileSync(file, "utf8");
  const key = JSON.parse(fs.readFileSync(keyFile, "utf8"));
  const res = certifyDocument(source, { issuer, account, issuerPrivateKey: key.privateKey });
  if (res.note === "already-certified") {
    console.log(`✓ ${issuer} already certified this content for ${account} — no change.`);
    process.exit(0);
  }
  fs.writeFileSync(file, res.source);
  console.log(`✓ Certified ${file}: ${issuer} attests for "${account}" at ${res.at}.`);
  console.log(`  Publish this issuer public key so anyone can verify: ${publicKeyFor(key.privateKey)}`);
  process.exit(0);
}

if (cmd === "verify") {
  const file = process.argv[3];
  if (!file) {
    console.error('Usage: dotit-sign verify <file.it> [--trust UTS=<pubkey> ...]');
    process.exit(2);
  }
  const source = fs.readFileSync(file, "utf8");
  // Trusted issuer keys: repeated --trust Name=base64pubkey
  const trusted = {};
  process.argv.forEach((a, i) => {
    if (a === "--trust" && process.argv[i + 1]) {
      const [name, pub] = process.argv[i + 1].split("=");
      if (name && pub) trusted[name] = pub;
    }
  });
  const v = verifyDocumentSignatures(source);
  const certs = verifyCertifications(source, trusted);
  const crypto = v.signatures.filter((s) => s.cryptographic);
  if (crypto.length === 0 && certs.length === 0) {
    console.log("No cryptographic signatures or certifications found (document may be integrity-sealed only).");
    process.exit(0);
  }
  console.log(`Document hash: ${v.hash}\n`);
  for (const s of v.signatures) {
    if (!s.cryptographic) {
      console.log(`  ◦ ${s.signer}${s.role ? `, ${s.role}` : ""} — text approval (not cryptographic)`);
      continue;
    }
    const mark = s.valid ? "✓ SIGNED " : "✗ INVALID";
    console.log(`  ${mark} ${s.signer}${s.role ? `, ${s.role}` : ""}  key ${s.publicKey.slice(0, 12)}…${s.valid ? "" : `  (${s.reason})`}`);
  }
  for (const c of certs) {
    const mark = c.valid ? "✓ CERTIFIED" : c.signatureValid ? "⚠ UNTRUSTED" : "✗ INVALID  ";
    console.log(`  ${mark} ${c.issuer} → ${c.account || "?"}  at ${c.at || "?"}${c.valid ? "" : `  (${c.reason})`}`);
  }
  const sigsOk = crypto.length === 0 || v.allSignaturesValid;
  const certsOk = certs.length === 0 || certs.every((c) => c.valid);
  console.log(
    `\n${sigsOk && certsOk ? "✓" : "✗"} ${v.validCount}/${crypto.length} signature(s), ${certs.filter((c) => c.valid).length}/${certs.length} certification(s) valid.`,
  );
  process.exit(sigsOk && certsOk ? 0 : 1);
}

console.error("dotit-sign — Ed25519 signatures & UTS certification for .it documents");
console.error("Commands:");
console.error("  keygen [--out file]");
console.error('  sign <file> --key k.json --signer "Name" [--role "CEO"]');
console.error('  certify <file> --key uts-key.json --account "acme-corp" [--issuer UTS]   (authority)');
console.error('  verify <file> [--trust UTS=<pubkey> ...]');
process.exit(cmd ? 2 : 0);
