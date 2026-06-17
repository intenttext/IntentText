#!/usr/bin/env node

const { execSync } = require("node:child_process");

// Re-baselined at 1.14.0, nudged at 1.16.0. The previous limits were set at core
// 1.5.0 (XLSX/DOCX converters); core has since legitimately grown through the
// PDF/Word-parity features — forms, trust workflow, redline, version compare,
// redaction, math, mergeThreeWay, attachments — and at 1.16.0 the faithful-recorder
// `defaults.ts` module (read-time defaults). Current real size: packed ~126 KB,
// unpacked ~583 KB, 101 entries. Limits sit just above so the guard still catches
// FUTURE accidental bloat. Bump deliberately when real features grow the surface;
// never to wave through an accidental dependency or stray src file.
const LIMITS = {
  packedBytes: 135000,
  unpackedBytes: 630000,
  entryCount: 105,
};

const raw = execSync("npm pack --json --dry-run", {
  cwd: process.cwd(),
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
