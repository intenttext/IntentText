// Example ERP backend usage for IntentText rendering.
// Run with Node 18+.
//
// Modes:
// 1) HTML only:    node examples/erp-print-node.mjs html
// 2) PDF output:   node examples/erp-print-node.mjs pdf

import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";

const mode = process.argv[2] || "html";

const template = [
  "page: | size: A4 | marginTopMm: 20 | marginBottomMm: 16",
  "title: Invoice {{invoice_number}}",
  "text: Customer {{customer_name}}",
  "metric: Total | value: {{total}} | unit: {{currency}}",
].join("\n");

const data = {
  invoice_number: "INV-2401",
  customer_name: "Atlas Corp",
  total: "14250",
  currency: "SAR",
};

async function loadModule(candidates) {
  let lastErr;
  for (const spec of candidates) {
    try {
      if (spec.endsWith(".js") || spec.startsWith("/")) {
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

async function loadPdfRuntime() {
  const localRuntime = path.resolve(
    process.cwd(),
    "packages",
    "pdf-runtime",
    "dist",
    "index.js",
  );
  return loadModule(["@intenttext/pdf-runtime", localRuntime]);
}

async function main() {
  const core = await loadCore();
  if (
    typeof core.parseAndMerge !== "function" ||
    typeof core.renderHTML !== "function"
  ) {
    throw new Error("Core module missing parseAndMerge/renderHTML");
  }

  const doc = core.parseAndMerge(template, data);
  const html = core.renderHTML(doc);

  if (mode === "html") {
    console.log("Rendered HTML length:", html.length);
    await fs.writeFile("artifacts/erp-example.html", html, "utf8");
    console.log("Wrote artifacts/erp-example.html");
    return;
  }

  if (mode === "pdf") {
    const runtime = await loadPdfRuntime();
    if (typeof runtime.createPdf !== "function") {
      throw new Error("PDF runtime missing createPdf");
    }

    const result = await runtime.createPdf({ template, data });
    await fs.writeFile("artifacts/erp-example.pdf", Buffer.from(result.pdf));
    console.log("Wrote artifacts/erp-example.pdf");
    console.log("Metrics:", result.metrics);
    return;
  }

  throw new Error(`Unknown mode '${mode}'. Use 'html' or 'pdf'.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
