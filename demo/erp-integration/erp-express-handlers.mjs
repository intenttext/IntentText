// Copy-paste ERP integration example (Express).
// Provides /render-html, /render-pdf, /replay-html orchestration using @dotit/core
// for parse/merge/render, plus the optional puppeteer-backed PDF helper
// (./intenttext-pdf.server.mjs) for real PDF bytes. Same APIs as erp-service.mjs,
// just wrapped in Express routes. Run `npm i express` first.

import express from "express";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

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
  return loadModule(["@dotit/core", localCore]);
}

function normalizeHtml(html) {
  return String(html).replace(/\s+/g, " ").replace(/>\s+</g, "><").trim();
}

function sha256Hex(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

// Simple no-op migration hook placeholder.
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

app.post("/render-html", async (req, res) => {
  try {
    const template = String(req.body?.template || "");
    const data =
      req.body?.data && typeof req.body.data === "object" ? req.body.data : {};
    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);
    res.status(200).json({ html });
  } catch (error) {
    const e = classifyError(error);
    res.status(e.status).json({ error: e.message, type: e.type, code: e.code });
  }
});

app.post("/render-pdf", async (req, res) => {
  try {
    const template = String(req.body?.template || "");
    if (!template.trim()) {
      return res
        .status(422)
        .json({
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
      return res
        .status(422)
        .json({
          error: "data must be an object for render-pdf.",
          type: "data_error",
          code: "DATA_INVALID",
        });
    }

    // Optional dependency: puppeteer (npm i puppeteer). The HTML route works
    // without it; this route 503s with a typed error when missing. Same helper
    // and lifecycle as erp-service.mjs.
    const { renderDocumentPDF } = await import("./intenttext-pdf.server.mjs");
    const started = Date.now();
    const pdf = await renderDocumentPDF(template, data, { theme: req.body?.theme });
    const doc = core.parseAndMerge(template, data);
    res.status(200).json({
      html: core.renderHTML(doc),
      pdfBase64: Buffer.from(pdf).toString("base64"),
      metrics: { durationMs: Date.now() - started },
    });
  } catch (error) {
    const e = classifyError(error);
    res.status(e.status).json({ error: e.message, type: e.type, code: e.code });
  }
});

app.post("/replay-html", async (req, res) => {
  try {
    const artifact =
      req.body?.artifact && typeof req.body.artifact === "object"
        ? req.body.artifact
        : null;
    if (!artifact) {
      return res
        .status(422)
        .json({
          error: "artifact object is required for replay-html.",
          type: "data_error",
          code: "ARTIFACT_INVALID",
        });
    }

    const migrated = await applyArtifactMigrations(artifact);
    const normalized = migrated.artifact;

    const template = String(normalized.template || "");
    if (!template.trim()) {
      return res
        .status(422)
        .json({
          error: "artifact.template is required for replay-html.",
          type: "template_error",
          code: "TEMPLATE_EMPTY",
        });
    }

    const templateVersion = String(normalized.template_version || "");
    const rendererVersion = String(normalized.renderer_version || "");
    const themeVersion = String(normalized.theme_version || "");
    if (!templateVersion || !rendererVersion || !themeVersion) {
      return res
        .status(422)
        .json({
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
      return res
        .status(422)
        .json({
          error: "data must be an object when provided.",
          type: "data_error",
          code: "DATA_INVALID",
        });
    }

    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);
    const htmlSha = sha256Hex(normalizeHtml(html));

    res.status(200).json({
      html,
      replay: {
        template_version: templateVersion,
        renderer_version: rendererVersion,
        theme_version: themeVersion,
        html_sha256: htmlSha,
      },
      migration: migrated.migration,
    });
  } catch (error) {
    const e = classifyError(error);
    res.status(e.status).json({ error: e.message, type: e.type, code: e.code });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`ERP example API listening at http://127.0.0.1:${port}`);
});
