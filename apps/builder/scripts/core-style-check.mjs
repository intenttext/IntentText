import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GOLDEN_DIR = path.resolve(ROOT, "fixtures", "golden");
const MANIFEST_PATH = path.resolve(GOLDEN_DIR, "manifest.json");

const STYLE_KEYS = new Set([
  "color",
  "size",
  "family",
  "weight",
  "align",
  "bg",
  "indent",
  "opacity",
  "italic",
  "border",
]);

const BLOCKED_BUILDER_ONLY_KEYS = new Set([
  "focalX",
  "focalY",
  "scale",
  "cropX",
  "cropY",
  "cropWidth",
  "cropHeight",
]);

const LAYOUT_ALLOWED_KEYS = {
  page: new Set([
    "size",
    "marginTopMm",
    "marginTop",
    "margin-top",
    "marginRightMm",
    "marginRight",
    "margin-right",
    "marginBottomMm",
    "marginBottom",
    "margin-bottom",
    "marginLeftMm",
    "marginLeft",
    "margin-left",
    "safeAreaMm",
    "safeArea",
    "safe-area",
  ]),
  header: new Set([
    "fit",
    "heightMm",
    "height",
    "zoneHeightMm",
    "imageUrl",
    "image",
    "src",
    "url",
    "position",
    "enabled",
  ]),
  footer: new Set([
    "fit",
    "heightMm",
    "height",
    "zoneHeightMm",
    "imageUrl",
    "image",
    "src",
    "url",
    "position",
    "enabled",
  ]),
  watermark: new Set([
    "fit",
    "opacity",
    "imageUrl",
    "image",
    "src",
    "url",
    "enabled",
  ]),
  background: new Set([
    "fit",
    "opacity",
    "imageUrl",
    "image",
    "src",
    "url",
    "enabled",
  ]),
};

async function loadCore() {
  const explicit = process.env.INTENTTEXT_CORE_PATH?.trim();
  const localDefault = path.resolve(
    ROOT,
    "..",
    "IntentText",
    "packages",
    "core",
    "dist",
    "index.js",
  );

  const candidates = [explicit, localDefault, "@intenttext/core"].filter(
    Boolean,
  );
  let lastErr;
  for (const spec of candidates) {
    try {
      if (spec.startsWith("/") || spec.endsWith(".js")) {
        return await import(pathToFileURL(spec).href);
      }
      return await import(spec);
    } catch (err) {
      lastErr = err;
    }
  }

  throw (
    lastErr ||
    new Error("Unable to load core module for style compatibility check")
  );
}

function flattenBlocks(blocks, acc = []) {
  for (const block of blocks || []) {
    acc.push(block);
    if (Array.isArray(block.children) && block.children.length > 0) {
      flattenBlocks(block.children, acc);
    }
  }
  return acc;
}

function checkBlockProperties(fixtureName, block, failures) {
  const props =
    block?.properties && typeof block.properties === "object"
      ? block.properties
      : {};
  const keys = Object.keys(props);
  if (keys.length === 0) return;

  for (const key of keys) {
    if (BLOCKED_BUILDER_ONLY_KEYS.has(key)) {
      failures.push(
        `${fixtureName}: blocked builder-only style key '${key}' found in ${block.type}: block`,
      );
    }
  }

  const type = String(block.type || "");
  const allowedLayout = LAYOUT_ALLOWED_KEYS[type];
  if (!allowedLayout) return;

  for (const key of keys) {
    if (allowedLayout.has(key) || STYLE_KEYS.has(key)) continue;
    failures.push(
      `${fixtureName}: unsupported ${type}: property '${key}' is not core-mapped style/layout metadata`,
    );
  }
}

async function loadFixtureTemplate(name) {
  const templatePath = path.resolve(GOLDEN_DIR, name, "template.it");
  return fs.readFile(templatePath, "utf8");
}

async function run() {
  const core = await loadCore();
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const fixtureNames = Array.isArray(manifest.fixtures)
    ? manifest.fixtures
    : [];

  if (fixtureNames.length === 0) {
    throw new Error("No golden fixtures found for core-style check");
  }

  const failures = [];

  for (const fixtureName of fixtureNames) {
    const template = await loadFixtureTemplate(fixtureName);
    const parsed = core.parseIntentTextSafe(template);
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      failures.push(
        `${fixtureName}: parse errors prevent style compatibility check`,
      );
      continue;
    }

    const blocks = flattenBlocks(parsed.document?.blocks || []);
    for (const block of blocks) {
      checkBlockProperties(fixtureName, block, failures);
    }
  }

  if (failures.length > 0) {
    console.error("\nCore-style compatibility check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(
    `Core-style compatibility check passed for ${fixtureNames.length} fixtures.`,
  );
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
