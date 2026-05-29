import { spawn } from "node:child_process";

const ROOT = process.cwd();
const API_BASE =
  process.env.DETERMINISM_API_BASE_URL || "http://127.0.0.1:8080/api";

function normalizeHtml(html) {
  return String(html).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
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

async function renderHtml(template, data) {
  const res = await fetch(`${API_BASE}/render-html`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template, data }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`render-html failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (typeof json.html !== "string") {
    throw new Error("render-html returned invalid html payload");
  }
  return json.html;
}

async function run() {
  const startedApi = await startApiIfNeeded();

  try {
    const template = [
      "title: Determinism",
      "summary: Hello {{user.name}}",
      "text: Total {{invoice.total}}",
      "each: items as item",
      "text: - {{item.name}} x {{item.qty}}",
    ].join("\n");

    const data = {
      user: { name: "IntentText" },
      invoice: { total: "$123.45" },
      items: [
        { name: "Pen", qty: 2 },
        { name: "Notebook", qty: 1 },
      ],
    };

    const htmlA = await renderHtml(template, data);
    const htmlB = await renderHtml(template, data);

    if (normalizeHtml(htmlA) !== normalizeHtml(htmlB)) {
      throw new Error(
        "Determinism check failed: render-html output changed between identical requests",
      );
    }

    console.log("Determinism check passed.");
  } finally {
    if (startedApi) {
      startedApi.kill("SIGTERM");
    }
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
