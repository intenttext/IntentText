#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");
const filesToCheck = [
  "index.js",
  "browser.js",
  "merge.js",
  "trust.js",
  "history.js",
];

const offenders = [];
for (const rel of filesToCheck) {
  const full = path.join(distDir, rel);
  if (!fs.existsSync(full)) {
    offenders.push(`${rel}: missing (run build first)`);
    continue;
  }
  const content = fs.readFileSync(full, "utf8");
  if (content.includes('require("./parser")')) {
    offenders.push(`${rel}: contains require("./parser")`);
  }
}

if (offenders.length > 0) {
  console.error("Parser runtime coupling check failed:");
  for (const line of offenders) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log(
  "Parser runtime coupling check passed (no built core entrypoint requires ./parser)",
);
