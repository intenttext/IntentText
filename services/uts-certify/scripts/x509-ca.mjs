#!/usr/bin/env node
/**
 * x509-ca.mjs — provision the UTS X.509 Certificate Authority (the PAdES chain).
 *
 * This CA (ECDSA P-256) signs the leaf certificates customers use to PAdES-sign
 * exported PDFs. Adobe/courts validate against X.509 — not the native Ed25519
 * authority — so this is a SEPARATE trust root from scripts/root-ca.mjs.
 *
 * Commands:
 *   init   — generate a CA keypair + self-signed CA cert; print the CA CERT (public)
 *            and the CA KEY (secret). With --dev, also write .keys/uts-x509-ca.json
 *            so a local server picks it up automatically.
 *
 *   node scripts/x509-ca.mjs init [--cn "UTS Certificate Authority"] [--org UTS] [--days 3650] [--dev]
 *
 * PRODUCTION: store the printed CA KEY in your secret manager as UTS_X509_CA_KEY
 * (keep the root key OFFLINE / in an HSM ideally; issue an online intermediate to
 * sign day-to-day). Set UTS_X509_CA_CERT to the CA cert. Publish the cert at
 * GET /.well-known/uts-ca.pem so verifiers (and eventually Adobe AATL) trust it.
 */
import { createCertificateAuthority } from "@dotit/pades";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_DIR = resolve(HERE, "..", ".keys");
const CA_FILE = resolve(KEY_DIR, "uts-x509-ca.json");

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

async function cmdInit(args) {
  const commonName =
    typeof args.cn === "string" ? args.cn : "UTS Certificate Authority";
  const organization = typeof args.org === "string" ? args.org : "UTS";
  const days = args.days !== undefined ? Number(args.days) : 3650;
  if (!Number.isFinite(days) || days <= 0) {
    console.error("\n  --days must be a positive number.\n");
    process.exit(1);
  }

  const ca = await createCertificateAuthority({ commonName, organization, days });

  if (args.dev) {
    if (existsSync(CA_FILE)) {
      console.error(`\n  Refusing to overwrite an existing dev CA: ${CA_FILE}\n`);
      process.exit(1);
    }
    mkdirSync(KEY_DIR, { recursive: true });
    writeFileSync(
      CA_FILE,
      JSON.stringify({ certPem: ca.certPem, privateKeyPem: ca.privateKeyPem }, null, 2),
    );
    try {
      chmodSync(CA_FILE, 0o600);
    } catch {
      /* best-effort */
    }
    console.log(`\n  Dev CA written to ${CA_FILE} (chmod 0600, gitignored).`);
    console.log(`  The local server will load it automatically.\n`);
    return;
  }

  console.log(
    [
      "",
      "  ========================================================================",
      "  UTS X.509 CA INITIALIZED  (ECDSA P-256, the PAdES chain)",
      "  ========================================================================",
      "",
      `  Subject:  CN=${commonName}, O=${organization}`,
      `  Validity: ${days} days`,
      "",
      "  CA CERTIFICATE (public — set UTS_X509_CA_CERT, publish at /.well-known/uts-ca.pem):",
      "",
      ca.certPem.trimEnd(),
      "",
      "  CA PRIVATE KEY (SECRET — store as UTS_X509_CA_KEY in your secret manager):",
      "",
      ca.privateKeyPem.trimEnd(),
      "",
      "  ************************************************************************",
      "  *  Guard the CA PRIVATE KEY. Anyone holding it can issue signing certs  *",
      "  *  in UTS's name. Keep the root OFFLINE / in an HSM; issue an online    *",
      "  *  intermediate for day-to-day signing. NEVER commit either PEM.        *",
      "  ************************************************************************",
      "",
    ].join("\n"),
  );
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (cmd === "init") {
  await cmdInit(args);
} else {
  console.log(
    [
      "",
      "  UTS X.509 CA provisioning",
      "",
      "  Usage:",
      "    node scripts/x509-ca.mjs init [--cn <name>] [--org <org>] [--days 3650] [--dev]",
      "",
      "  --dev writes .keys/uts-x509-ca.json for local use; without it the PEMs are",
      "  printed for you to load into a secret manager (UTS_X509_CA_CERT/KEY).",
      "",
    ].join("\n"),
  );
}
