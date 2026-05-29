import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const API_BASE =
  process.env.PDF_SMOKE_API_BASE_URL || "http://127.0.0.1:8080/api";
const SHOULD_WRITE_ARTIFACT = process.env.PDF_SMOKE_WRITE === "1";
const ARTIFACT_DIR =
  process.env.PDF_SMOKE_ARTIFACT_DIR || path.resolve(ROOT, "artifacts");

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

function assertPdfBase64(pdfBase64) {
  if (typeof pdfBase64 !== "string" || pdfBase64.length < 16) {
    throw new Error("render-pdf did not return a valid pdfBase64 payload");
  }

  const bytes = Buffer.from(pdfBase64, "base64");
  if (bytes.length < 8) {
    throw new Error("decoded PDF payload is too small");
  }

  const signature = bytes.subarray(0, 4).toString("ascii");
  if (signature !== "%PDF") {
    throw new Error("decoded payload is not a PDF (%PDF signature missing)");
  }
}

function assertMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") {
    throw new Error("render-pdf did not return metrics");
  }

  for (const key of ["durationMs", "queueWaitMs", "crashCount"]) {
    if (typeof metrics[key] !== "number") {
      throw new Error(`metrics.${key} must be a number`);
    }
  }
}

async function maybeWriteArtifact(pdfBase64) {
  if (!SHOULD_WRITE_ARTIFACT) return;
  const bytes = Buffer.from(pdfBase64, "base64");
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  const outPath = path.resolve(ARTIFACT_DIR, "pdf-smoke.pdf");
  await fs.writeFile(outPath, bytes);
  console.log(`WROTE_ARTIFACT ${outPath}`);
}

async function run() {
  const startedApi = await startApiIfNeeded();

  try {
    const template = [
      "title: PDF Smoke",
      "text: Hello {{user.name}}",
      "text: Amount {{invoice.total}}",
    ].join("\n");

    const data = {
      user: { name: "IntentText" },
      invoice: { total: "$42.00" },
    };

    const res = await fetch(`${API_BASE}/render-pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ template, data }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`render-pdf failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    assertPdfBase64(json.pdfBase64);
    assertMetrics(json.metrics);
    await maybeWriteArtifact(json.pdfBase64);

    console.log("PDF smoke check passed.");
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
