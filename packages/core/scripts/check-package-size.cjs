#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const inputPath = process.argv[2] || "core-package-size.json";
const reportPathCandidates = [
  path.resolve(process.cwd(), inputPath),
  path.resolve(__dirname, "..", "..", inputPath),
  path.resolve(__dirname, "..", "..", "..", inputPath),
];
const reportPath = reportPathCandidates.find((p) => fs.existsSync(p));

if (!reportPath) {
  console.error(`Could not find size report file: ${inputPath}`);
  process.exit(1);
}

const LIMITS = {
  distTotalBytes: 950000,
  wasmBytes: 600000,
  mapFileCount: 0,
};

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const distTotal = Number(report?.dist?.totalBytes || 0);
const wasmBytes = Number(report?.wasm?.bytes || 0);
const mapFileCount = Number(report?.dist?.mapFileCount || 0);

const failures = [];
if (distTotal > LIMITS.distTotalBytes) {
  failures.push(
    `dist.totalBytes ${distTotal} exceeds limit ${LIMITS.distTotalBytes}`,
  );
}
if (wasmBytes > LIMITS.wasmBytes) {
  failures.push(`wasm.bytes ${wasmBytes} exceeds limit ${LIMITS.wasmBytes}`);
}
if (mapFileCount > LIMITS.mapFileCount) {
  failures.push(
    `dist.mapFileCount ${mapFileCount} exceeds limit ${LIMITS.mapFileCount}`,
  );
}

if (failures.length > 0) {
  console.error("Core package size check failed:");
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log(
  `Core package size check passed (dist=${distTotal}, wasm=${wasmBytes}, maps=${mapFileCount})`,
);
