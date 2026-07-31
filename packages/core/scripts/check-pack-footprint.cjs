#!/usr/bin/env node

const { execSync } = require("node:child_process");
const path = require("node:path");

// Always measure the @dotit/core package itself, regardless of where this script
// is invoked from. CI runs `node packages/core/scripts/check-pack-footprint.cjs`
// from the repo ROOT; without a fixed cwd, `npm pack` would pack the monorepo root
// (thousands of files) instead of the core package and the gate would false-fail.
const PKG_DIR = path.resolve(__dirname, "..");

// Re-baselined at 1.14.0, nudged at 1.16.0. The previous limits were set at core
// 1.5.0 (XLSX/DOCX converters); core has since legitimately grown through the
// PDF/Word-parity features — forms, trust workflow, redline, version compare,
// redaction, math, mergeThreeWay, attachments — and at 1.16.0 the faithful-recorder
// `defaults.ts` module (read-time defaults). Nudged again at 4.4 for the FORMAT-REVIEW
// freeze work: reserving route/require/certify, the rendered approval-route panel
// (+ its CSS), the optional format-version stamp, and the read-only conformance module
// (conformance.{js,d.ts}) and the typed-value reader (typed-value.{js,d.ts}). Limits sit just above real size
// so the guard still catches FUTURE accidental bloat. Bump deliberately when real
// features grow the surface; never to wave through an accidental dependency or stray
// src file. Nudged at 3.1.0 for the trust-integrity work: the committed history digest
// (computeHistoryHash), the aggregate verifyTrust module, and the bank-grade circular
// seal STAMP (renderSeal rewrite with arc text + guilloché). Nudged at 3.2.0 for the
// bank-readiness P0 fixes: the invisible-content defense (visibility.{js,d.ts} —
// findHiddenContent/styleHidesContent, wired into verify + trust band) and the
// typed-value-aware numeric query engine.
// Re-baselined at 3.8.0. The limits had gone stale at 3.7.0, which embedded the
// subsetted Noto print fonts as woff2 data URIs (dist/print-fonts.js alone is
// 380 KB) and shipped anyway — npm records 3.7.0 at 118 files / 1,067,866 bytes
// unpacked, well past the numbers this gate was still enforcing. A gate nobody
// can pass is a gate nobody reads, so these are set just above the REAL 3.8.0
// size. The font payload is deliberate (PDF/A needs embedded glyphs); anything
// beyond these numbers is not, and should be justified before the limit moves.
const LIMITS = {
  packedBytes: 460000,
  unpackedBytes: 1120000,
  entryCount: 118,
};

const raw = execSync("npm pack --json --dry-run", {
  cwd: PKG_DIR,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const parsed = JSON.parse(raw);
const first = Array.isArray(parsed) ? parsed[0] : null;
if (!first) {
  console.error("npm pack --json --dry-run returned no package data");
  process.exit(1);
}

const packed = Number(first.size || 0);
const unpacked = Number(first.unpackedSize || 0);
const entryCount = Number(first.entryCount || 0);

const failures = [];
if (packed > LIMITS.packedBytes) {
  failures.push(`packed size ${packed} exceeds limit ${LIMITS.packedBytes}`);
}
if (unpacked > LIMITS.unpackedBytes) {
  failures.push(
    `unpacked size ${unpacked} exceeds limit ${LIMITS.unpackedBytes}`,
  );
}
if (entryCount > LIMITS.entryCount) {
  failures.push(`entry count ${entryCount} exceeds limit ${LIMITS.entryCount}`);
}

if (failures.length > 0) {
  console.error("npm pack footprint check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `npm pack footprint check passed (packed=${packed}, unpacked=${unpacked}, entries=${entryCount})`,
);
