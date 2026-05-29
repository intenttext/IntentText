#!/usr/bin/env node

const { execSync } = require("node:child_process");

const LIMITS = {
  packedBytes: 265000,
  unpackedBytes: 940000,
  entryCount: 63,
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
