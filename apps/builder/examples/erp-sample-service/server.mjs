import http from "node:http";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 3090);
const HOST = process.env.HOST || "127.0.0.1";

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
}

function classifyError(error) {
  const message =
    error instanceof Error ? error.message : String(error || "Unknown error");
  const msg = message.toLowerCase();

  if (msg.includes("template") || msg.includes("line:")) {
    return {
      status: 422,
      type: "template_error",
      code: "TEMPLATE_INVALID",
      message,
    };
  }
  if (msg.includes("data") || msg.includes("payload") || msg.includes("json")) {
    return {
      status: 422,
      type: "data_error",
      code: "DATA_INVALID",
      message,
    };
  }
  if (
    msg.includes("puppeteer") ||
    msg.includes("browser") ||
    msg.includes("pdf") ||
    msg.includes("chrom")
  ) {
    return {
      status: 503,
      type: "pdf_backend_error",
      code: "PDF_BACKEND_FAILURE",
      message,
    };
  }

  return {
    status: 500,
    type: "render_error",
    code: "RENDER_RUNTIME_FAILURE",
    message,
  };
}

function normalizeHtml(html) {
  return String(html).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function sha256Hex(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function loadModule(candidates) {
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
  throw lastErr || new Error("Unable to load module");
}

async function loadCore() {
  const explicit = process.env.INTENTTEXT_CORE_PATH?.trim();
  const localCore = path.resolve(
    process.cwd(),
    "..",
    "..",
    "..",
    "IntentText",
    "packages",
    "core",
    "dist",
    "index.js",
  );
  const core = await loadModule(
    [explicit, "@intenttext/core", localCore].filter(Boolean),
  );

  if (
    typeof core.parseAndMerge !== "function" ||
    typeof core.renderHTML !== "function"
  ) {
    throw new Error("Core module missing parseAndMerge/renderHTML");
  }
  return core;
}

async function loadPdfRuntime() {
  const explicit = process.env.INTENTTEXT_PDF_RUNTIME_PATH?.trim();
  const localRuntime = path.resolve(
    process.cwd(),
    "..",
    "..",
    "packages",
    "pdf-runtime",
    "dist",
    "index.js",
  );
  const runtime = await loadModule(
    [explicit, "@intenttext/pdf-runtime", localRuntime].filter(Boolean),
  );

  if (typeof runtime.createPdf !== "function") {
    throw new Error("PDF runtime missing createPdf");
  }
  return runtime;
}

// Minimal placeholder migration flow for sample service.
async function applyArtifactMigrations(artifact) {
  const versions = {
    template_version: String(artifact.template_version || ""),
    renderer_version: String(artifact.renderer_version || ""),
    theme_version: String(artifact.theme_version || ""),
  };
  return {
    artifact: { ...artifact },
    migration: {
      from: versions,
      to: versions,
      applied_hooks: [],
    },
  };
}

const core = await loadCore();
const runtime = await loadPdfRuntime();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, { ok: true });
  }

  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && req.url === "/render-html") {
      const body = await readJson(req);
      const template = String(body.template || "");
      const data = body.data && typeof body.data === "object" ? body.data : {};
      const doc = core.parseAndMerge(template, data);
      const html = core.renderHTML(doc);
      return json(res, 200, { html });
    }

    if (req.method === "POST" && req.url === "/render-pdf") {
      const body = await readJson(req);
      const template = String(body.template || "");
      if (!template.trim()) {
        return json(res, 422, {
          error: "Template is required for render-pdf.",
          type: "template_error",
          code: "TEMPLATE_EMPTY",
        });
      }

      const data =
        body.data === undefined
          ? {}
          : body.data && typeof body.data === "object"
            ? body.data
            : null;

      if (!data) {
        return json(res, 422, {
          error: "data must be an object for render-pdf.",
          type: "data_error",
          code: "DATA_INVALID",
        });
      }

      const result = await runtime.createPdf({ template, data, pdf: body.pdf });
      return json(res, 200, {
        html: result.html,
        pdfBase64: Buffer.from(result.pdf).toString("base64"),
        metrics: result.metrics || null,
      });
    }

    if (req.method === "POST" && req.url === "/replay-html") {
      const body = await readJson(req);
      const artifact =
        body.artifact && typeof body.artifact === "object"
          ? body.artifact
          : null;

      if (!artifact) {
        return json(res, 422, {
          error: "artifact object is required for replay-html.",
          type: "data_error",
          code: "ARTIFACT_INVALID",
        });
      }

      const migrated = await applyArtifactMigrations(artifact);
      const normalized = migrated.artifact;
      const template = String(normalized.template || "");

      if (!template.trim()) {
        return json(res, 422, {
          error: "artifact.template is required for replay-html.",
          type: "template_error",
          code: "TEMPLATE_EMPTY",
        });
      }

      const templateVersion = String(normalized.template_version || "");
      const rendererVersion = String(normalized.renderer_version || "");
      const themeVersion = String(normalized.theme_version || "");

      if (!templateVersion || !rendererVersion || !themeVersion) {
        return json(res, 422, {
          error:
            "artifact.template_version, artifact.renderer_version, and artifact.theme_version are required.",
          type: "data_error",
          code: "ARTIFACT_VERSION_MISSING",
        });
      }

      const data =
        body.data === undefined
          ? {}
          : body.data && typeof body.data === "object"
            ? body.data
            : null;

      if (!data) {
        return json(res, 422, {
          error: "data must be an object when provided.",
          type: "data_error",
          code: "DATA_INVALID",
        });
      }

      const doc = core.parseAndMerge(template, data);
      const html = core.renderHTML(doc);

      return json(res, 200, {
        html,
        replay: {
          template_version: templateVersion,
          renderer_version: rendererVersion,
          theme_version: themeVersion,
          html_sha256: sha256Hex(normalizeHtml(html)),
        },
        migration: migrated.migration,
      });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    const e = classifyError(error);
    return json(res, e.status, {
      error: e.message,
      type: e.type,
      code: e.code,
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ERP sample service listening at http://${HOST}:${PORT}`);
});
