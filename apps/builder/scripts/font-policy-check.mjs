import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const API_BASE =
  process.env.FONT_POLICY_API_BASE_URL || "http://127.0.0.1:8080/api";
const GOLDEN_DIR = path.resolve(ROOT, "fixtures", "golden");
const MANIFEST_PATH = path.resolve(GOLDEN_DIR, "manifest.json");

const SOURCE_DIRS = [
  path.resolve(ROOT, "packages", "pdf-runtime", "src"),
  path.resolve(ROOT, "api"),
  path.resolve(ROOT, "server"),
  GOLDEN_DIR,
];

const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".it",
  ".css",
  ".html",
]);

const PATTERNS = [
  { id: "FONT_GOOGLEAPIS", re: /fonts\.googleapis\.com/i },
  { id: "FONT_GSTATIC", re: /fonts\.gstatic\.com/i },
  { id: "FONT_IMPORT_REMOTE", re: /@import\s+url\(\s*["']?https?:\/\//i },
  {
    id: "FONT_FACE_REMOTE_SRC",
    re: /@font-face[\s\S]{0,1200}src\s*:\s*[^;]*https?:\/\//i,
  },
];

function collectLines(text, pattern) {
  const lines = [];
  const rows = String(text).split("\n");
  for (let i = 0; i < rows.length; i += 1) {
    if (pattern.re.test(rows[i])) {
      lines.push({ line: i + 1, text: rows[i].trim() });
    }
  }
  return lines;
}

async function walk(dir, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const next = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(next, out);
      continue;
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(next);
    }
  }
  return out;
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
  throw (
    lastErr || new Error("Unable to load core module for font policy check")
  );
}

async function startApiIfNeeded() {
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (health.ok) return null;
  } catch {
    // Start local API if no server is running.
  }

  const child = spawn("node", ["server/render-api.mjs"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("API startup timeout")),
      12000,
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

function evaluateText(text, context, failures) {
  for (const pattern of PATTERNS) {
    if (!pattern.re.test(text)) continue;
    const hits = collectLines(text, pattern);
    if (hits.length === 0) {
      failures.push(`${context}: matched ${pattern.id}`);
      continue;
    }
    for (const hit of hits) {
      failures.push(`${context}:${hit.line} [${pattern.id}] ${hit.text}`);
    }
  }
}

async function runSourceScan(failures) {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    const found = await walk(dir);
    for (const file of found) files.push(file);
  }

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    evaluateText(text, path.relative(ROOT, file), failures);
  }
}

async function runRenderScan(failures) {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const fixtureNames = manifest.fixtures || [];
  if (fixtureNames.length === 0) {
    throw new Error("No fixtures in manifest");
  }

  const core = await loadCore();
  const startedApi = await startApiIfNeeded();

  try {
    for (const name of fixtureNames) {
      const { template, data } = await loadFixture(name);

      const coreDoc = core.parseAndMerge(template, data);
      const coreHtml = core.renderHTML(coreDoc);
      evaluateText(coreHtml, `render:core:${name}`, failures);

      const res = await fetch(`${API_BASE}/render-html`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template, data }),
      });

      if (!res.ok) {
        failures.push(`render:api:${name}: API error ${res.status}`);
        continue;
      }

      const json = await res.json();
      evaluateText(String(json.html || ""), `render:api:${name}`, failures);
    }
  } finally {
    if (startedApi) startedApi.kill("SIGTERM");
  }
}

async function run() {
  const failures = [];
  await runSourceScan(failures);
  await runRenderScan(failures);

  if (failures.length > 0) {
    console.error("\nFont policy check failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Font policy check passed.");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
