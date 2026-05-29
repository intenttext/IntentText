import fs from "node:fs/promises";
import path from "node:path";

import { applyArtifactMigrations } from "../shared/migration-hooks.js";

const ROOT = process.cwd();
const FIXTURE_DIR = path.resolve(ROOT, "fixtures", "migration");
const MANIFEST_PATH = path.resolve(FIXTURE_DIR, "manifest.json");

async function loadJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected '${expected}', got '${actual}'`);
  }
}

function assertArrayEqual(actual, expected, message) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error(`${message}: expected arrays`);
  }
  if (actual.length !== expected.length) {
    throw new Error(
      `${message}: expected length ${expected.length}, got ${actual.length}`,
    );
  }
  for (let i = 0; i < expected.length; i += 1) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `${message}: mismatch at index ${i}, expected '${expected[i]}', got '${actual[i]}'`,
      );
    }
  }
}

async function runFixture(name) {
  const fixturePath = path.resolve(FIXTURE_DIR, `${name}.json`);
  const fixture = await loadJson(fixturePath);

  const first = await applyArtifactMigrations(fixture.input);
  const second = await applyArtifactMigrations(first.artifact);

  assertEqual(
    String(first.artifact.template_version || ""),
    fixture.expected.template_version,
    `${name} template_version`,
  );
  assertEqual(
    String(first.artifact.renderer_version || ""),
    fixture.expected.renderer_version,
    `${name} renderer_version`,
  );
  assertEqual(
    String(first.artifact.theme_version || ""),
    fixture.expected.theme_version,
    `${name} theme_version`,
  );

  assertArrayEqual(
    first.migration.applied_hooks,
    fixture.expected.applied_hooks,
    `${name} applied_hooks`,
  );

  if (second.migration.applied_hooks.length !== 0) {
    throw new Error(
      `${name} idempotence failed: second pass should apply zero hooks`,
    );
  }

  console.log(`PASS ${name}`);
}

async function run() {
  const manifest = await loadJson(MANIFEST_PATH);
  const fixtureNames = Array.isArray(manifest.fixtures)
    ? manifest.fixtures
    : [];

  if (fixtureNames.length === 0) {
    throw new Error("No migration fixtures in manifest");
  }

  for (const name of fixtureNames) {
    await runFixture(name);
  }

  console.log(`\nMigration check passed for ${fixtureNames.length} fixtures.`);
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
