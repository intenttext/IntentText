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

// Code and the embedded print fonts (opt-in PDF/A data, core 3.7.0) have separate
// budgets: the fonts are ~390 KB of woff2 data URIs that sat inside the code limit
// and turned this gate red, hiding any real code growth behind them.
const LIMITS = {
  distCodeBytes: 950000,
  distFontsBytes: 400000,
  mapFileCount: 0,
};

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const distTotal = Number(report?.dist?.totalBytes || 0);
const fontsBytes = Number(report?.dist?.fontsBytes || 0);
const codeBytes = Number(report?.dist?.codeBytes ?? distTotal - fontsBytes);
const mapFileCount = Number(report?.dist?.mapFileCount || 0);

const failures = [];
if (codeBytes > LIMITS.distCodeBytes) {
  failures.push(`dist.codeBytes ${codeBytes} exceeds limit ${LIMITS.distCodeBytes}`);
}
if (fontsBytes > LIMITS.distFontsBytes) {
  failures.push(`dist.fontsBytes ${fontsBytes} exceeds limit ${LIMITS.distFontsBytes}`);
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
  `Core package size check passed (code=${codeBytes}, fonts=${fontsBytes}, maps=${mapFileCount})`,
);
