#!/usr/bin/env node
/**
 * root-ca.mjs — the OFFLINE root certificate authority for UTS.
 *
 * The ROOT Ed25519 private key is the single most valuable secret in the whole
 * system: whoever holds it can vouch for any intermediate and therefore mint
 * unlimited trust. It is generated and used ONLY here, on an air-gapped machine,
 * and is stored encrypted at rest (AES-256-GCM, key derived from a passphrase via
 * scrypt). It never touches the online service — only the PUBLIC key (the trust
 * anchor) and the short-lived ICA tokens it issues travel out.
 *
 * Commands:
 *   init    — generate the root keypair; encrypt + write it; print the PUBLIC key.
 *   issue   — vouch for an intermediate's public key → print an ICA token.
 *   pubkey  — print the root public key.
 *
 * The passphrase ALWAYS comes from the env var `UTS_ROOT_PASSPHRASE` (we never
 * prompt — this must run unattended on an air-gapped box without blocking on a
 * TTY). It is required for `init` and `issue`. Keep it OUT of the online service's
 * environment and back it up alongside the encrypted root file.
 *
 *   UTS_ROOT_PASSPHRASE=…  node scripts/root-ca.mjs init   [--issuer UTS] [--out .root/root.json]
 *   UTS_ROOT_PASSPHRASE=…  node scripts/root-ca.mjs issue  --root .root/root.json --intermediate-pub <b64url> [--issuer UTS] [--days 365] [--not-before ISO] [--not-after ISO]
 *                          node scripts/root-ca.mjs pubkey --root .root/root.json
 */
import {
  generateSigningKey,
  publicKeyFor,
  issueIntermediate,
} from "@dotit/sign";
import {
  scryptSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

// ── tiny argv parser: --flag value / --flag=value / bare command ──────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        out[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          out[a.slice(2)] = next;
          i++;
        } else {
          out[a.slice(2)] = true;
        }
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

function requirePassphrase() {
  const pass = process.env.UTS_ROOT_PASSPHRASE;
  if (!pass || pass.trim() === "") {
    die(
      [
        "UTS_ROOT_PASSPHRASE is not set.",
        "The root private key is encrypted at rest with a passphrase-derived key;",
        "supply it via the environment (we never prompt — this runs air-gapped/unattended):",
        "",
        "  UTS_ROOT_PASSPHRASE='…' node scripts/root-ca.mjs <command>",
      ].join("\n  "),
    );
  }
  return pass;
}

// ── passphrase-derived envelope (scrypt → AES-256-GCM), salt stored alongside ──
// N=2^15,r=8 needs ~128*N*r ≈ 32 MiB; raise maxmem above Node's 32 MiB default
// so the derivation isn't rejected. Params are stored in the file so a future
// change here can't break decryption of an existing root.
const SCRYPT_PARAMS = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(passphrase, salt, params = SCRYPT_PARAMS) {
  return scryptSync(passphrase, salt, 32, params);
}

function sealRootKey(privateKey, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  return {
    v: 1,
    alg: "aes-256-gcm",
    kdf: "scrypt",
    kdfParams: { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ct: ct.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function openRootKey(enc, passphrase) {
  // Use the file's own kdf params (with maxmem headroom) so we can decrypt files
  // written under different scrypt settings; fall back to current params.
  const params = enc.kdfParams
    ? { ...enc.kdfParams, maxmem: 256 * 1024 * 1024 }
    : SCRYPT_PARAMS;
  const key = deriveKey(passphrase, Buffer.from(enc.salt, "base64"), params);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(enc.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "base64"));
  try {
    return (
      decipher.update(Buffer.from(enc.ct, "base64")).toString("utf8") +
      decipher.final("utf8")
    );
  } catch {
    die(
      "Failed to decrypt the root key — wrong UTS_ROOT_PASSPHRASE or a corrupted root file.",
    );
  }
}

function loadRootFile(path) {
  if (!existsSync(path)) {
    die(`Root file not found: ${path}  (run \`root-ca init --out ${path}\` first)`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw.publicKey || !raw.enc) {
    die(`Root file ${path} is malformed (missing publicKey/enc).`);
  }
  return raw;
}

// ── commands ──────────────────────────────────────────────────────────────────
function cmdInit(args) {
  const passphrase = requirePassphrase();
  const issuer = typeof args.issuer === "string" ? args.issuer : "UTS";
  const out = typeof args.out === "string" ? args.out : ".root/root.json";
  const outPath = resolve(process.cwd(), out);

  if (existsSync(outPath)) {
    die(`Refusing to overwrite an existing root file: ${outPath}`);
  }

  const { privateKey, publicKey } = generateSigningKey();
  const doc = {
    v: 1,
    role: "root",
    issuer,
    publicKey,
    alg: "ed25519",
    enc: sealRootKey(privateKey, passphrase),
    createdAt: new Date().toISOString(),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 2));
  try {
    chmodSync(outPath, 0o600);
  } catch {
    /* best-effort on non-POSIX */
  }

  console.log(
    [
      "",
      "  ========================================================================",
      "  UTS ROOT CA INITIALIZED",
      "  ========================================================================",
      "",
      `  Issuer:        ${issuer}`,
      `  Root file:     ${outPath}   (chmod 0600, encrypted at rest)`,
      "",
      "  ROOT PUBLIC KEY (this is the trust anchor — publish it everywhere):",
      "",
      `      ${publicKey}`,
      "",
      "  NEXT STEPS:",
      `    • Set this as UTS_ROOT_PUBLIC_KEY on the service and in every verifier`,
      `      trust store (apps/verify/src/uts-trust.ts, MCP verify tool, badges).`,
      `    • Bake it in at build time so a UTS cert verifies offline, everywhere.`,
      "",
      "  ************************************************************************",
      "  *  KEEP THIS MACHINE OFFLINE. The root private key can mint unlimited   *",
      "  *  trust — guard it like a Stellar issuer secret. BACK UP both the      *",
      "  *  encrypted root file AND the UTS_ROOT_PASSPHRASE (separately) — lose  *",
      "  *  either and you can never issue/rotate again; lose the passphrase     *",
      "  *  control and the root is compromised. NEVER set UTS_ROOT_PASSPHRASE   *",
      "  *  on the online service.                                               *",
      "  ************************************************************************",
      "",
    ].join("\n"),
  );
}

function cmdIssue(args) {
  const passphrase = requirePassphrase();
  const rootPath = resolve(
    process.cwd(),
    typeof args.root === "string" ? args.root : ".root/root.json",
  );
  const intermediatePub = args["intermediate-pub"];
  if (typeof intermediatePub !== "string" || intermediatePub.trim() === "") {
    die(
      "Missing --intermediate-pub <b64url>. Read it from the online service:\n" +
        "    GET /admin/intermediate-pubkey  →  { intermediate: <this> }",
    );
  }
  if (!/^[A-Za-z0-9_-]+$/.test(intermediatePub.trim())) {
    die("--intermediate-pub must be a base64url Ed25519 public key.");
  }

  const root = loadRootFile(rootPath);
  const issuer = typeof args.issuer === "string" ? args.issuer : root.issuer ?? "UTS";
  const days = args.days !== undefined ? Number(args.days) : 365;
  if (!Number.isFinite(days) || days <= 0) {
    die("--days must be a positive number.");
  }
  const notBefore = typeof args["not-before"] === "string" ? args["not-before"] : undefined;
  const notAfter = typeof args["not-after"] === "string" ? args["not-after"] : undefined;

  const rootPrivateKey = openRootKey(root.enc, passphrase);
  // Guard against a corrupted/tampered root file (pub must match priv).
  if (publicKeyFor(rootPrivateKey) !== root.publicKey) {
    die("Root file integrity check failed: stored public key does not match the decrypted private key.");
  }

  const token = issueIntermediate({
    rootPrivateKey,
    intermediatePublicKey: intermediatePub.trim(),
    issuer,
    ...(notBefore ? { notBefore } : {}),
    ...(notAfter ? { notAfter } : { days }),
  });

  // Print ONLY the token on stdout so it can be piped/copied verbatim.
  process.stdout.write(token + "\n");
}

function cmdPubkey(args) {
  const rootPath = resolve(
    process.cwd(),
    typeof args.root === "string" ? args.root : ".root/root.json",
  );
  const root = loadRootFile(rootPath);
  process.stdout.write(root.publicKey + "\n");
}

function usage() {
  console.log(
    [
      "",
      "  UTS offline root CA",
      "",
      "  Usage:",
      "    UTS_ROOT_PASSPHRASE=… node scripts/root-ca.mjs init   [--issuer UTS] [--out .root/root.json]",
      "    UTS_ROOT_PASSPHRASE=… node scripts/root-ca.mjs issue  --root .root/root.json --intermediate-pub <b64url> [--issuer UTS] [--days 365] [--not-before ISO] [--not-after ISO]",
      "                          node scripts/root-ca.mjs pubkey --root .root/root.json",
      "",
      "  Run on an AIR-GAPPED machine. The passphrase comes from UTS_ROOT_PASSPHRASE",
      "  (never prompted). Back up the encrypted root file AND the passphrase.",
      "",
    ].join("\n"),
  );
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
switch (cmd) {
  case "init":
    cmdInit(args);
    break;
  case "issue":
    cmdIssue(args);
    break;
  case "pubkey":
    cmdPubkey(args);
    break;
  case undefined:
  case "help":
  case "--help":
    usage();
    break;
  default:
    console.error(`\n  Unknown command: ${cmd}`);
    usage();
    process.exit(2);
}
