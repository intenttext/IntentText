import { spawn } from "node:child_process";

const ROOT = process.cwd();
const API_BASE =
  process.env.ERP_CONTRACT_API_BASE_URL || "http://127.0.0.1:8080/api";
const REQUEST_TIMEOUT_MS = 20000;

async function startApiIfNeeded() {
  const healthController = new AbortController();
  const healthTimer = setTimeout(() => healthController.abort(), 2000);
  try {
    const health = await fetch(`${API_BASE}/health`, {
      signal: healthController.signal,
    });
    clearTimeout(healthTimer);
    if (health.ok) return null;
  } catch {
    clearTimeout(healthTimer);
    // Start local API if needed.
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
      if (String(buf).includes("API listening")) {
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

async function postJson(path, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json();
    return { res, body };
  } finally {
    clearTimeout(timer);
  }
}

function isTypedError(body) {
  return (
    body &&
    typeof body === "object" &&
    typeof body.error === "string" &&
    typeof body.type === "string" &&
    typeof body.code === "string"
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkRenderHtml() {
  const payload = {
    template:
      "title: Invoice {{invoice_number}}\\ntext: Customer {{customer_name}}",
    data: { invoice_number: "INV-2401", customer_name: "Atlas Corp" },
  };

  const { res, body } = await postJson("/render-html", payload);

  assert(res.status === 200, `render-html expected 200, got ${res.status}`);
  assert(
    body && typeof body.html === "string",
    "render-html response missing html string",
  );
}

async function checkReplayHtml() {
  const payload = {
    artifact: {
      template:
        "title: Invoice {{invoice_number}}\\ntext: Customer {{customer_name}}",
      template_version: "template-v1",
      renderer_version: "renderer-v1",
      theme_version: "theme-v1",
    },
    data: { invoice_number: "INV-2401", customer_name: "Atlas Corp" },
  };

  const { res, body } = await postJson("/replay-html", payload);

  assert(res.status === 200, `replay-html expected 200, got ${res.status}`);
  assert(
    body && typeof body.html === "string",
    "replay-html response missing html string",
  );
  assert(
    body.replay && typeof body.replay === "object",
    "replay-html response missing replay object",
  );
  assert(
    typeof body.replay.template_version === "string",
    "replay.template_version must be string",
  );
  assert(
    typeof body.replay.renderer_version === "string",
    "replay.renderer_version must be string",
  );
  assert(
    typeof body.replay.theme_version === "string",
    "replay.theme_version must be string",
  );
  assert(
    typeof body.replay.html_sha256 === "string" &&
      body.replay.html_sha256.length === 64,
    "replay.html_sha256 must be 64-char hash",
  );

  assert(
    body.migration && typeof body.migration === "object",
    "replay-html response missing migration object",
  );
  assert(
    body.migration.from && typeof body.migration.from === "object",
    "migration.from missing",
  );
  assert(
    body.migration.to && typeof body.migration.to === "object",
    "migration.to missing",
  );
  assert(
    Array.isArray(body.migration.applied_hooks),
    "migration.applied_hooks must be array",
  );
}

async function checkRenderPdfErrorContract() {
  const payload = {
    template: "title: x",
    data: "invalid",
  };

  const { res, body } = await postJson("/render-pdf", payload);

  assert(
    res.status === 422,
    `render-pdf invalid-data expected 422, got ${res.status}`,
  );
  assert(isTypedError(body), "render-pdf invalid-data must return typed error");
  assert(
    body.type === "data_error",
    `render-pdf invalid-data expected data_error, got ${body.type}`,
  );
  assert(
    body.code === "DATA_INVALID",
    `render-pdf invalid-data expected DATA_INVALID, got ${body.code}`,
  );
}

async function run() {
  const startedApi = await startApiIfNeeded();

  try {
    await checkRenderHtml();
    await checkReplayHtml();
    await checkRenderPdfErrorContract();
    console.log("ERP contract check passed.");
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
