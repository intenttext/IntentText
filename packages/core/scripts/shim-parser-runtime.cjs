#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const distParserPath = path.join(__dirname, "..", "dist", "parser.js");

if (!fs.existsSync(distParserPath)) {
  console.error(`dist parser file not found: ${distParserPath}`);
  process.exit(1);
}

// Save the original tsc-compiled parser as parser-ts.js so rust-core can import
// the real TS implementation as a fallback without going through the shim (which
// would create an infinite call cycle: rust-core → parser shim → rust-core → ...).
const parserTsPath = path.join(__dirname, "..", "dist", "parser-ts.js");
const originalParserContent = fs.readFileSync(distParserPath, "utf8");
fs.writeFileSync(parserTsPath, originalParserContent, "utf8");
console.log("Saved original TS parser as dist/parser-ts.js");

const parserDtsPath = path.join(__dirname, "..", "dist", "parser.d.ts");
const parserTsDtsPath = path.join(__dirname, "..", "dist", "parser-ts.d.ts");
if (fs.existsSync(parserDtsPath)) {
  fs.copyFileSync(parserDtsPath, parserTsDtsPath);
  console.log("Copied parser.d.ts to dist/parser-ts.d.ts");
}

const shim = `"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SAFE_PARSE_OPTIONS = void 0;
exports._resetIdCounter = _resetIdCounter;
exports.detectHistoryBoundary = detectHistoryBoundary;
exports.parseIntentText = parseIntentText;
exports.parseIntentTextSafe = parseIntentTextSafe;

const rustCore = require("./rust-core");
const trust = require("./trust");

exports.DEFAULT_SAFE_PARSE_OPTIONS = {
  unknownKeyword: "note",
  maxBlocks: 10000,
  maxLineLength: 50000,
  strict: false,
};

function _resetIdCounter() {
  return rustCore._resetIdCounter();
}

function detectHistoryBoundary(lines) {
  return trust.detectHistoryBoundary(lines);
}

function parseIntentText(source, options) {
  return rustCore.parseIntentText(source, options);
}

function parseIntentTextSafe(source, options) {
  return rustCore.parseIntentTextSafe(source, options);
}
`;

fs.writeFileSync(distParserPath, shim, "utf8");
console.log("Wrote parser runtime shim to dist/parser.js");
