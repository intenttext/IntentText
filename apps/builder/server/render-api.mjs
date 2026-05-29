import http from "node:http";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyArtifactMigrations } from "../api/migration-hooks.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const PAGE_SIZES = new Set(["A4", "LETTER", "LEGAL"]);
const FIT_HEADER_FOOTER = new Set(["contain", "cover", "stretch"]);
const FIT_BACKGROUND = new Set(["contain", "cover"]);
const PDF_RUNTIME_ERROR =
  "Unable to load PDF runtime. Build packages/pdf-runtime first or set INTENTTEXT_PDF_RUNTIME_PATH.";

function createTypedError(type, code, message, status = 400) {
  const err = new Error(message);
  err.type = type;
  err.code = code;
  err.status = status;
  return err;
}

function classifyPdfRuntimeError(error) {
  const message =
    error instanceof Error ? error.message : String(error || "Unknown error");

  if (error && typeof error === "object") {
    const type = error.type;
    const code = error.code;
    const status = error.status;
    if (typeof type === "string" && typeof code === "string") {
      return {
        type,
        code,
        message,
        status: typeof status === "number" ? status : 400,
      };
    }
  }

  const msg = message.toLowerCase();
  if (
    msg.includes("invalid json") ||
    msg.includes("data") ||
    msg.includes("payload")
  ) {
    return {
      type: "data_error",
      code: "DATA_INVALID",
      message,
      status: 422,
    };
  }
  if (
    msg.includes("parse") ||
    msg.includes("template") ||
    msg.includes("line:")
  ) {
    return {
      type: "template_error",
      code: "TEMPLATE_INVALID",
      message,
      status: 422,
    };
  }
  if (
    msg.includes("puppeteer") ||
    msg.includes("browser") ||
    msg.includes("pdf") ||
    msg.includes("chrom")
  ) {
    return {
      type: "pdf_backend_error",
      code: "PDF_BACKEND_FAILURE",
      message,
      status: 503,
    };
  }

  return {
    type: "render_error",
    code: "RENDER_RUNTIME_FAILURE",
    message,
    status: 500,
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

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(payload));
}

function singularize(name) {
  if (name.endsWith("ies")) return name.slice(0, -3) + "y";
  if (name.endsWith("s")) return name.slice(0, -1);
  return name;
}

function extractRepeatAliases(source) {
  const aliases = new Map();
  const re = /each:\s*([a-zA-Z0-9_.]+)(?:\s+as\s+([a-zA-Z_][\w]*))?/gi;
  let m;
  while ((m = re.exec(source)) !== null) {
    const collection = String(m[1] || "").trim();
    if (!collection) continue;
    const alias = String(m[2] || singularize(collection)).trim();
    aliases.set(alias, collection);
  }
  return aliases;
}

function buildVariableInventory(source) {
  const vars = new Set();
  const repeated = [];
  const repeatAliases = extractRepeatAliases(source);
  const re = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const raw = String(m[1] || "").trim();
    if (!raw) continue;
    vars.add(raw);

    const top = raw.split(".")[0];
    if (repeatAliases.has(top)) {
      repeated.push({
        path: raw,
        itemAlias: top,
        collection: repeatAliases.get(top),
      });
      continue;
    }

    if (/\.\d+(\.|$)/.test(raw)) {
      repeated.push({ path: raw });
    }
  }

  const all = [...vars].sort();
  return {
    all,
    required: all,
    optional: [],
    repeated,
  };
}

function mapParseIssues(result) {
  const issues = [];
  for (const item of result.errors || []) {
    issues.push({
      code: item.code || "PARSE_ERROR",
      category: "parse",
      message: item.message || "Parse error",
      path: item.line ? `line:${item.line}` : undefined,
      severity: "error",
    });
  }
  for (const item of result.warnings || []) {
    issues.push({
      code: item.code || "PARSE_WARNING",
      category: "parse",
      message: item.message || "Parse warning",
      path: item.line ? `line:${item.line}` : undefined,
      severity: "warning",
    });
  }
  return issues;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(String(value).replace(/mm$/i, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function collectBlocks(blocks, out = []) {
  for (const block of blocks || []) {
    out.push(block);
    if (Array.isArray(block.children) && block.children.length > 0) {
      collectBlocks(block.children, out);
    }
  }
  return out;
}

function getProp(block, ...keys) {
  const props = block?.properties || {};
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && props[key] !== "") {
      return props[key];
    }
  }
  return undefined;
}

function hasImageSource(block) {
  const content = String(block?.content || "").trim();
  const propSource = getProp(block, "imageUrl", "image", "src", "url");
  return Boolean(content || String(propSource || "").trim());
}

function issue(code, severity, message, path) {
  return { code, category: "template", severity, message, path };
}

function validateLayoutIssues(doc) {
  const issues = [];
  const all = collectBlocks(doc?.blocks || []);
  const pages = all.filter((b) => b.type === "page");
  const headers = all.filter((b) => b.type === "header");
  const footers = all.filter((b) => b.type === "footer");
  const backgrounds = all.filter(
    (b) => b.type === "background" || b.type === "watermark",
  );

  if (pages.length > 1) {
    issues.push(
      issue(
        "LAYOUT_MULTIPLE_PAGE_BLOCKS",
        "warning",
        "Multiple page: blocks found; only one page layout block is recommended.",
        "page",
      ),
    );
  }

  for (const page of pages) {
    const size = String(getProp(page, "size") || "")
      .trim()
      .toUpperCase();
    if (size && !PAGE_SIZES.has(size)) {
      issues.push(
        issue(
          "LAYOUT_PAGE_SIZE_UNSUPPORTED",
          "warning",
          `Unsupported page size '${size}'. Recommended: A4, Letter, Legal.`,
          "page.size",
        ),
      );
    }

    const marginKeys = [
      ["marginTopMm", "marginTop", "margin-top"],
      ["marginRightMm", "marginRight", "margin-right"],
      ["marginBottomMm", "marginBottom", "margin-bottom"],
      ["marginLeftMm", "marginLeft", "margin-left"],
    ];
    for (const keys of marginKeys) {
      const raw = getProp(page, ...keys);
      const val = toNumber(raw);
      if (raw !== undefined && val === undefined) {
        issues.push(
          issue(
            "LAYOUT_MARGIN_NOT_NUMBER",
            "error",
            `Margin '${keys[0]}' must be numeric (mm).`,
            `page.${keys[0]}`,
          ),
        );
      } else if (val !== undefined && (val < 0 || val > 60)) {
        issues.push(
          issue(
            "LAYOUT_MARGIN_RANGE",
            "warning",
            `Margin '${keys[0]}' is out of recommended range (0..60mm).`,
            `page.${keys[0]}`,
          ),
        );
      }
    }

    const safeArea = toNumber(
      getProp(page, "safeAreaMm", "safeArea", "safe-area"),
    );
    const safeAreaRaw = getProp(page, "safeAreaMm", "safeArea", "safe-area");
    if (safeAreaRaw !== undefined && safeArea === undefined) {
      issues.push(
        issue(
          "LAYOUT_SAFE_AREA_NOT_NUMBER",
          "error",
          "safeArea must be numeric (mm).",
          "page.safeAreaMm",
        ),
      );
    } else if (safeArea !== undefined && (safeArea < 0 || safeArea > 30)) {
      issues.push(
        issue(
          "LAYOUT_SAFE_AREA_RANGE",
          "warning",
          "safeArea is out of recommended range (0..30mm).",
          "page.safeAreaMm",
        ),
      );
    }
  }

  for (const [zoneName, blocks, minMm, maxMm] of [
    ["header", headers, 5, 80],
    ["footer", footers, 5, 60],
  ]) {
    for (const block of blocks) {
      if (!hasImageSource(block)) {
        issues.push(
          issue(
            "LAYOUT_IMAGE_MISSING",
            "error",
            `${zoneName} requires an image source (content/src/url/imageUrl).`,
            `${zoneName}.image`,
          ),
        );
      }

      const fitRaw = getProp(block, "fit");
      if (fitRaw !== undefined) {
        const fit = String(fitRaw).trim().toLowerCase();
        if (!FIT_HEADER_FOOTER.has(fit)) {
          issues.push(
            issue(
              "LAYOUT_FIT_INVALID",
              "error",
              `${zoneName}.fit must be one of: contain, cover, stretch.`,
              `${zoneName}.fit`,
            ),
          );
        }
      }

      const heightRaw = getProp(block, "heightMm", "height", "zoneHeightMm");
      const height = toNumber(heightRaw);
      if (heightRaw !== undefined && height === undefined) {
        issues.push(
          issue(
            "LAYOUT_ZONE_HEIGHT_NOT_NUMBER",
            "error",
            `${zoneName}.height must be numeric (mm).`,
            `${zoneName}.heightMm`,
          ),
        );
      } else if (height !== undefined && (height < minMm || height > maxMm)) {
        issues.push(
          issue(
            "LAYOUT_ZONE_HEIGHT_RANGE",
            "warning",
            `${zoneName}.height is out of recommended range (${minMm}..${maxMm}mm).`,
            `${zoneName}.heightMm`,
          ),
        );
      }
    }
  }

  for (const block of backgrounds) {
    if (!hasImageSource(block)) {
      issues.push(
        issue(
          "LAYOUT_BACKGROUND_IMAGE_MISSING",
          "error",
          "background/watermark requires an image source.",
          "background.image",
        ),
      );
    }

    const fitRaw = getProp(block, "fit");
    if (fitRaw !== undefined) {
      const fit = String(fitRaw).trim().toLowerCase();
      if (!FIT_BACKGROUND.has(fit)) {
        issues.push(
          issue(
            "LAYOUT_BACKGROUND_FIT_INVALID",
            "error",
            "background.fit must be one of: cover, contain.",
            "background.fit",
          ),
        );
      }
    }

    const opacityRaw = getProp(block, "opacity");
    const opacity = toNumber(opacityRaw);
    if (opacityRaw !== undefined && opacity === undefined) {
      issues.push(
        issue(
          "LAYOUT_OPACITY_NOT_NUMBER",
          "error",
          "background.opacity must be numeric (0..1).",
          "background.opacity",
        ),
      );
    } else if (opacity !== undefined && (opacity < 0 || opacity > 1)) {
      issues.push(
        issue(
          "LAYOUT_OPACITY_RANGE",
          "error",
          "background.opacity must be between 0 and 1.",
          "background.opacity",
        ),
      );
    }
  }

  if (
    (headers.length > 0 || footers.length > 0 || backgrounds.length > 0) &&
    pages.length === 0
  ) {
    issues.push(
      issue(
        "LAYOUT_PAGE_BLOCK_RECOMMENDED",
        "warning",
        "Using header/footer/background without page: block. Add page: size/margins for deterministic print layout.",
        "page",
      ),
    );
  }

  return issues;
}

async function loadCore() {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const explicit = process.env.INTENTTEXT_CORE_PATH?.trim();
  const runtimeInstalledCore = path.resolve(
    serverDir,
    "..",
    "packages",
    "pdf-runtime",
    "node_modules",
    "@intenttext",
    "core",
    "dist",
    "index.js",
  );

  const candidates = [
    explicit,
    runtimeInstalledCore,
    "@intenttext/core",
  ].filter(Boolean);
  let lastErr = null;
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
    lastErr ||
    new Error(
      "Unable to load IntentText core module. Install dependencies in packages/pdf-runtime or set INTENTTEXT_CORE_PATH.",
    )
  );
}

const core = await loadCore();

async function loadPdfRuntime() {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const explicit = process.env.INTENTTEXT_PDF_RUNTIME_PATH?.trim();
  const localDist = path.resolve(
    serverDir,
    "..",
    "packages",
    "pdf-runtime",
    "dist",
    "index.js",
  );
  const candidates = [explicit, localDist, "@intenttext/pdf-runtime"].filter(
    Boolean,
  );
  let lastErr = null;

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

  throw lastErr || new Error(PDF_RUNTIME_ERROR);
}

function matchPath(url, pathName) {
  return url === pathName || url === `/api${pathName}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return json(res, 204, { ok: true });
  }

  try {
    if (req.method === "GET" && matchPath(req.url, "/health")) {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && matchPath(req.url, "/validate-template")) {
      const body = await readJson(req);
      const template = String(body.template || "");
      const parsed = core.parseIntentTextSafe(template);
      const issues = [
        ...mapParseIssues(parsed),
        ...validateLayoutIssues(parsed.document),
      ];
      return json(res, 200, {
        valid: !issues.some((i) => i.severity === "error"),
        issues,
        variables: buildVariableInventory(template),
      });
    }

    if (req.method === "POST" && matchPath(req.url, "/render-html")) {
      const body = await readJson(req);
      const template = String(body.template || "");
      const data = body.data && typeof body.data === "object" ? body.data : {};

      const doc = core.parseAndMerge(template, data);
      const html = core.renderHTML(doc);
      return json(res, 200, { html });
    }

    if (req.method === "POST" && matchPath(req.url, "/replay-html")) {
      const body = await readJson(req);
      const artifact =
        body.artifact && typeof body.artifact === "object"
          ? body.artifact
          : null;
      if (!artifact) {
        throw createTypedError(
          "data_error",
          "ARTIFACT_INVALID",
          "artifact object is required for replay-html.",
          422,
        );
      }

      const migrated = await applyArtifactMigrations(artifact);
      const normalizedArtifact = migrated.artifact;

      const template = String(normalizedArtifact.template || "");
      const templateVersion = String(normalizedArtifact.template_version || "");
      const rendererVersion = String(normalizedArtifact.renderer_version || "");
      const themeVersion = String(normalizedArtifact.theme_version || "");

      if (!template.trim()) {
        throw createTypedError(
          "template_error",
          "TEMPLATE_EMPTY",
          "artifact.template is required for replay-html.",
          422,
        );
      }
      if (
        !templateVersion.trim() ||
        !rendererVersion.trim() ||
        !themeVersion.trim()
      ) {
        throw createTypedError(
          "data_error",
          "ARTIFACT_VERSION_MISSING",
          "artifact.template_version, artifact.renderer_version, and artifact.theme_version are required.",
          422,
        );
      }

      const data =
        body.data === undefined
          ? {}
          : body.data && typeof body.data === "object"
            ? body.data
            : (() => {
                throw createTypedError(
                  "data_error",
                  "DATA_INVALID",
                  "data must be an object when provided.",
                  422,
                );
              })();

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

    if (req.method === "POST" && matchPath(req.url, "/render-pdf")) {
      const body = await readJson(req);
      const template = String(body.template || "");
      if (!template.trim()) {
        throw createTypedError(
          "template_error",
          "TEMPLATE_EMPTY",
          "Template is required for render-pdf.",
          422,
        );
      }

      let data = {};
      if (body.data === undefined) {
        data = {};
      } else if (body.data && typeof body.data === "object") {
        data = body.data;
      } else {
        throw createTypedError(
          "data_error",
          "DATA_INVALID",
          "data must be an object for render-pdf.",
          422,
        );
      }

      const pdf =
        body.pdf === undefined
          ? undefined
          : body.pdf && typeof body.pdf === "object"
            ? body.pdf
            : (() => {
                throw createTypedError(
                  "data_error",
                  "PDF_OPTIONS_INVALID",
                  "pdf must be an object when provided.",
                  422,
                );
              })();

      const runtimeConfig =
        body.runtimeConfig === undefined
          ? undefined
          : body.runtimeConfig && typeof body.runtimeConfig === "object"
            ? body.runtimeConfig
            : (() => {
                throw createTypedError(
                  "data_error",
                  "RUNTIME_CONFIG_INVALID",
                  "runtimeConfig must be an object when provided.",
                  422,
                );
              })();

      const runtime = await loadPdfRuntime();
      if (typeof runtime.createPdf !== "function") {
        throw new Error("PDF runtime missing createPdf");
      }

      const result = await runtime.createPdf(
        { template, data, pdf },
        runtimeConfig,
      );

      return json(res, 200, {
        html: result.html,
        pdfBase64: Buffer.from(result.pdf).toString("base64"),
        metrics: result.metrics || null,
      });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    if (req.method === "POST" && matchPath(req.url, "/render-pdf")) {
      const classified = classifyPdfRuntimeError(error);
      return json(res, classified.status, {
        error: classified.message,
        type: classified.type,
        code: classified.code,
      });
    }

    return json(res, 400, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`intenttext-builder API listening on http://${HOST}:${PORT}`);
});
