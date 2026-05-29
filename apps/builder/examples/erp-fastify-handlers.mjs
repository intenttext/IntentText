// Copy-paste ERP integration example (Fastify).
// Provides /render-html, /render-pdf, /replay-html orchestration using core + runtime.

import Fastify from "fastify";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const app = Fastify({ logger: false });

function classifyError(error) {
  const msg = (
    error instanceof Error ? error.message : String(error || "Unknown error")
  ).toLowerCase();
  if (msg.includes("template") || msg.includes("line:")) {
    return {
      status: 422,
      type: "template_error",
      code: "TEMPLATE_INVALID",
      message: String(error?.message || error),
    };
  }
  if (msg.includes("data") || msg.includes("payload") || msg.includes("json")) {
    return {
      status: 422,
      type: "data_error",
      code: "DATA_INVALID",
      message: String(error?.message || error),
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
      message: String(error?.message || error),
    };
  }
  return {
    status: 500,
    type: "render_error",
    code: "RENDER_RUNTIME_FAILURE",
    message: String(error?.message || error),
  };
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
  const localCore = path.resolve(
    process.cwd(),
    "..",
    "IntentText",
    "packages",
    "core",
    "dist",
    "index.js",
  );
  return loadModule(["@intenttext/core", localCore]);
}

async function loadRuntime() {
  const localRuntime = path.resolve(
    process.cwd(),
    "packages",
    "pdf-runtime",
    "dist",
    "index.js",
  );
  return loadModule(["@intenttext/pdf-runtime", localRuntime]);
}

function normalizeHtml(html) {
  return String(html).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function sha256Hex(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

async function applyArtifactMigrations(artifact) {
  return {
    artifact: { ...artifact },
    migration: {
      from: {
        template_version: String(artifact.template_version || ""),
        renderer_version: String(artifact.renderer_version || ""),
        theme_version: String(artifact.theme_version || ""),
      },
      to: {
        template_version: String(artifact.template_version || ""),
        renderer_version: String(artifact.renderer_version || ""),
        theme_version: String(artifact.theme_version || ""),
      },
      applied_hooks: [],
    },
  };
}

const core = await loadCore();
const runtime = await loadRuntime();

app.post("/render-html", async (req, reply) => {
  try {
    const template = String(req.body?.template || "");
    const data =
      req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);
    return reply.code(200).send({ html });
  } catch (error) {
    const e = classifyError(error);
    return reply
      .code(e.status)
      .send({ error: e.message, type: e.type, code: e.code });
  }
});

app.post("/render-pdf", async (req, reply) => {
  try {
    const template = String(req.body?.template || "");
    if (!template.trim()) {
      return reply
        .code(422)
        .send({
          error: "Template is required for render-pdf.",
          type: "template_error",
          code: "TEMPLATE_EMPTY",
        });
    }

    const data =
      req.body?.data === undefined
        ? {}
        : req.body?.data && typeof req.body.data === "object"
          ? req.body.data
          : null;

    if (!data) {
      return reply
        .code(422)
        .send({
          error: "data must be an object for render-pdf.",
          type: "data_error",
          code: "DATA_INVALID",
        });
    }

    const result = await runtime.createPdf({
      template,
      data,
      pdf: req.body?.pdf,
    });
    return reply.code(200).send({
      html: result.html,
      pdfBase64: Buffer.from(result.pdf).toString("base64"),
      metrics: result.metrics || null,
    });
  } catch (error) {
    const e = classifyError(error);
    return reply
      .code(e.status)
      .send({ error: e.message, type: e.type, code: e.code });
  }
});

app.post("/replay-html", async (req, reply) => {
  try {
    const artifact =
      req.body?.artifact && typeof req.body.artifact === "object"
        ? req.body.artifact
        : null;
    if (!artifact) {
      return reply
        .code(422)
        .send({
          error: "artifact object is required for replay-html.",
          type: "data_error",
          code: "ARTIFACT_INVALID",
        });
    }

    const migrated = await applyArtifactMigrations(artifact);
    const normalized = migrated.artifact;

    const template = String(normalized.template || "");
    if (!template.trim()) {
      return reply
        .code(422)
        .send({
          error: "artifact.template is required for replay-html.",
          type: "template_error",
          code: "TEMPLATE_EMPTY",
        });
    }

    const templateVersion = String(normalized.template_version || "");
    const rendererVersion = String(normalized.renderer_version || "");
    const themeVersion = String(normalized.theme_version || "");
    if (!templateVersion || !rendererVersion || !themeVersion) {
      return reply
        .code(422)
        .send({
          error:
            "artifact.template_version, artifact.renderer_version, and artifact.theme_version are required.",
          type: "data_error",
          code: "ARTIFACT_VERSION_MISSING",
        });
    }

    const data =
      req.body?.data === undefined
        ? {}
        : req.body?.data && typeof req.body.data === "object"
          ? req.body.data
          : null;

    if (!data) {
      return reply
        .code(422)
        .send({
          error: "data must be an object when provided.",
          type: "data_error",
          code: "DATA_INVALID",
        });
    }

    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);

    return reply.code(200).send({
      html,
      replay: {
        template_version: templateVersion,
        renderer_version: rendererVersion,
        theme_version: themeVersion,
        html_sha256: sha256Hex(normalizeHtml(html)),
      },
      migration: migrated.migration,
    });
  } catch (error) {
    const e = classifyError(error);
    return reply
      .code(e.status)
      .send({ error: e.message, type: e.type, code: e.code });
  }
});

const port = Number(process.env.PORT || 3002);
await app.listen({ port, host: "127.0.0.1" });
console.log(`ERP Fastify example API listening at http://127.0.0.1:${port}`);
