import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GOLDEN_DIR = path.resolve(ROOT, "fixtures", "golden");
const MANIFEST_PATH = path.resolve(GOLDEN_DIR, "manifest.json");
const API_BASE = process.env.PARITY_API_BASE_URL || "http://127.0.0.1:8080/api";

function normalizeHtml(html) {
  return String(html).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

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

  throw lastErr || new Error("Unable to load core module for parity check");
}

async function startApiIfNeeded() {
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (health.ok) return null;
  } catch {
    // ignore and start local server
  }

  const child = spawn("node", ["server/render-api.mjs"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("API startup timeout")),
      8000,
    );

    const onData = (buf) => {
      const text = String(buf);
      if (text.includes("API listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => reject(new Error(`API exited early (${code})`)));
  });

  return child;
}

async function loadFixture(name) {
  const dir = path.resolve(GOLDEN_DIR, name);
  const [template, dataRaw] = await Promise.all([
    fs.readFile(path.resolve(dir, "template.it"), "utf8"),
    fs.readFile(path.resolve(dir, "data.json"), "utf8"),
  ]);
  return { template, data: JSON.parse(dataRaw) };
}

async function run() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const fixtureNames = manifest.fixtures || [];
  if (fixtureNames.length === 0) {
    throw new Error("No fixtures in manifest");
  }

  const core = await loadCore();
  const startedApi = await startApiIfNeeded();

  const failures = [];
  try {
    for (const name of fixtureNames) {
      const { template, data } = await loadFixture(name);

      const coreDoc = core.parseAndMerge(template, data);
      const coreHtml = core.renderHTML(coreDoc);

      const res = await fetch(`${API_BASE}/render-html`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template, data }),
      });

      if (!res.ok) {
        failures.push(`${name}: API error ${res.status}`);
        continue;
      }

      const apiJson = await res.json();
      const apiHtml = apiJson.html || "";

      if (normalizeHtml(coreHtml) !== normalizeHtml(apiHtml)) {
        failures.push(
          `${name}: HTML mismatch between core and API render output`,
        );
      } else {
        console.log(`PASS ${name}`);
      }
    }
  } finally {
    if (startedApi) {
      startedApi.kill("SIGTERM");
    }
  }

  if (failures.length > 0) {
    console.error("\nParity check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`\nParity check passed for ${fixtureNames.length} fixtures.`);
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
