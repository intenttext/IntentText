import { spawn } from "node:child_process";

const ROOT = process.cwd();
const API_BASE = process.env.REPLAY_API_BASE_URL || "http://127.0.0.1:8080/api";

async function startApiIfNeeded() {
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (health.ok) return null;
  } catch {
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

async function callReplay(payload) {
  const res = await fetch(`${API_BASE}/replay-html`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `replay-html failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }
  return body;
}

function assertMigrationShape(migration) {
  if (!migration || typeof migration !== "object") {
    throw new Error("Replay response missing migration object.");
  }

  const sides = ["from", "to"];
  for (const side of sides) {
    if (!migration[side] || typeof migration[side] !== "object") {
      throw new Error(`Replay response missing migration.${side} object.`);
    }
    if (typeof migration[side].template_version !== "string") {
      throw new Error(
        `Replay response migration.${side}.template_version must be a string.`,
      );
    }
    if (typeof migration[side].renderer_version !== "string") {
      throw new Error(
        `Replay response migration.${side}.renderer_version must be a string.`,
      );
    }
    if (typeof migration[side].theme_version !== "string") {
      throw new Error(
        `Replay response migration.${side}.theme_version must be a string.`,
      );
    }
  }

  if (!Array.isArray(migration.applied_hooks)) {
    throw new Error(
      "Replay response migration.applied_hooks must be an array.",
    );
  }
  for (const hook of migration.applied_hooks) {
    if (typeof hook !== "string") {
      throw new Error(
        "Replay response migration.applied_hooks entries must be strings.",
      );
    }
  }
}

async function run() {
  const startedApi = await startApiIfNeeded();

  try {
    const payload = {
      artifact: {
        template: [
          "title: Replay Check",
          "summary: Hello {{user.name}}",
          "text: Total {{invoice.total}}",
        ].join("\n"),
        template_version: "template-v1",
        renderer_version: "renderer-v1",
        theme_version: "theme-v1",
      },
      data: {
        user: { name: "IntentText" },
        invoice: { total: "$89.00" },
      },
    };

    const a = await callReplay(payload);
    const b = await callReplay(payload);

    if (!a?.replay || !b?.replay) {
      throw new Error("replay-html response missing replay metadata");
    }

    if (a.replay.html_sha256 !== b.replay.html_sha256) {
      throw new Error(
        "Replay check failed: html_sha256 differs for identical payloads",
      );
    }

    if (
      typeof a.replay.html_sha256 !== "string" ||
      a.replay.html_sha256.length !== 64
    ) {
      throw new Error(
        "Replay response replay.html_sha256 must be a 64-char sha256 hex string.",
      );
    }

    assertMigrationShape(a.migration);

    for (const key of [
      "template_version",
      "renderer_version",
      "theme_version",
    ]) {
      if (
        a.replay[key] !== payload.artifact[key] ||
        b.replay[key] !== payload.artifact[key]
      ) {
        throw new Error(
          `Replay check failed: ${key} mismatch in replay metadata`,
        );
      }
    }

    const legacyPayload = {
      artifact: {
        template: payload.artifact.template,
        templateVersion: "template-v1",
        rendererVersion: "renderer-v1",
        themeVersion: "theme-v1",
      },
      data: payload.data,
    };

    const legacy = await callReplay(legacyPayload);
    assertMigrationShape(legacy.migration);

    if (legacy.replay.html_sha256 !== a.replay.html_sha256) {
      throw new Error(
        "Replay check failed: legacy migration changed canonical HTML hash.",
      );
    }

    if (
      !legacy.migration.applied_hooks.includes(
        "artifact-version-camelcase-to-snakecase-v1",
      )
    ) {
      throw new Error(
        "Replay check failed: expected camelCase migration hook to run.",
      );
    }

    if (
      legacy.replay.template_version !== "template-v1" ||
      legacy.replay.renderer_version !== "renderer-v1" ||
      legacy.replay.theme_version !== "theme-v1"
    ) {
      throw new Error(
        "Replay check failed: migrated legacy artifact did not normalize versions.",
      );
    }

    console.log("Replay check passed.");
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
