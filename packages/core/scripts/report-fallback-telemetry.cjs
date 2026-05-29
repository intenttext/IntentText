#!/usr/bin/env node

const path = require("node:path");

// Read telemetry from built package output so CI can call this after build/tests.
const core = require(path.join(__dirname, "..", "dist", "index.js"));

const telemetry = core.getRustCoreFallbackTelemetry();
process.stdout.write(
  `${JSON.stringify({ rustCoreFallbackTelemetry: telemetry }, null, 2)}\n`,
);
