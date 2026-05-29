import { spawn } from "node:child_process";

const ROOT = process.cwd();
const API_BASE =
  process.env.RUNTIME_ERROR_API_BASE_URL || "http://127.0.0.1:8080/api";

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

async function expectErrorCase(
  name,
  payload,
  expectedStatus,
  expectedType,
  expectedCode,
) {
  const res = await fetch(`${API_BASE}/render-pdf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();

  if (res.status !== expectedStatus) {
    throw new Error(
      `${name}: expected status ${expectedStatus}, got ${res.status}`,
    );
  }
  if (body.type !== expectedType) {
    throw new Error(`${name}: expected type ${expectedType}, got ${body.type}`);
  }
  if (body.code !== expectedCode) {
    throw new Error(`${name}: expected code ${expectedCode}, got ${body.code}`);
  }
}

async function run() {
  const startedApi = await startApiIfNeeded();

  try {
    await expectErrorCase(
      "empty-template",
      { template: "   ", data: {} },
      422,
      "template_error",
      "TEMPLATE_EMPTY",
    );

    await expectErrorCase(
      "invalid-data",
      { template: "title: x", data: "bad" },
      422,
      "data_error",
      "DATA_INVALID",
    );

    await expectErrorCase(
      "invalid-runtime-config",
      { template: "title: x", data: {}, runtimeConfig: "bad" },
      422,
      "data_error",
      "RUNTIME_CONFIG_INVALID",
    );

    console.log("Runtime error contract check passed.");
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
