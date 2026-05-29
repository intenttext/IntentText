#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const distDir = path.join(root, "dist");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

const files = fs.existsSync(distDir) ? walk(distDir) : [];
let totalBytes = 0;
let mapFileCount = 0;
const topFiles = [];
for (const file of files) {
  const size = fs.statSync(file).size;
  totalBytes += size;
  if (file.endsWith(".map")) mapFileCount += 1;
  topFiles.push({
    path: path.relative(root, file),
    bytes: size,
  });
}
topFiles.sort((a, b) => b.bytes - a.bytes);

const wasmFile = path.join(distDir, "rust-wasm", "intenttext_bg.wasm");
const wasmBytes = fs.existsSync(wasmFile) ? fs.statSync(wasmFile).size : 0;

const report = {
  package: "@intenttext/core",
  generatedAt: new Date().toISOString(),
  dist: {
    fileCount: files.length,
    mapFileCount,
    totalBytes,
    totalKB: Number((totalBytes / 1024).toFixed(2)),
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(3)),
    largestFiles: topFiles.slice(0, 10),
  },
  wasm: {
    path: path.relative(root, wasmFile),
    bytes: wasmBytes,
    kb: Number((wasmBytes / 1024).toFixed(2)),
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
