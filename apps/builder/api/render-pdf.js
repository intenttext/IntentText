import {
  classifyPdfRuntimeError,
  createTypedError,
  ensurePost,
  getPdfRuntime,
  toBase64,
} from "./_shared.js";

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const template = String(req.body?.template || "");
    if (!template.trim()) {
      throw createTypedError(
        "template_error",
        "TEMPLATE_EMPTY",
        "Template is required for render-pdf.",
        422,
      );
    }

    let data = {};
    if (req.body?.data === undefined) {
      data = {};
    } else if (req.body?.data && typeof req.body.data === "object") {
      data = req.body.data;
    } else {
      throw createTypedError(
        "data_error",
        "DATA_INVALID",
        "data must be an object for render-pdf.",
        422,
      );
    }

    const pdf =
      req.body?.pdf === undefined
        ? undefined
        : req.body?.pdf && typeof req.body.pdf === "object"
          ? req.body.pdf
          : createTypedError(
              "data_error",
              "PDF_OPTIONS_INVALID",
              "pdf must be an object when provided.",
              422,
            );

    if (pdf instanceof Error) {
      throw pdf;
    }

    const runtimeConfig =
      req.body?.runtimeConfig === undefined
        ? undefined
        : req.body?.runtimeConfig && typeof req.body.runtimeConfig === "object"
          ? req.body.runtimeConfig
          : createTypedError(
              "data_error",
              "RUNTIME_CONFIG_INVALID",
              "runtimeConfig must be an object when provided.",
              422,
            );

    if (runtimeConfig instanceof Error) {
      throw runtimeConfig;
    }

    const runtime = await getPdfRuntime();
    if (typeof runtime.createPdf !== "function") {
      throw new Error("PDF runtime missing createPdf");
    }

    const result = await runtime.createPdf(
      { template, data, pdf },
      runtimeConfig,
    );

    res.status(200).json({
      html: result.html,
      pdfBase64: toBase64(result.pdf),
      metrics: result.metrics || null,
    });
  } catch (error) {
    const classified = classifyPdfRuntimeError(error);
    res.status(classified.status).json({
      error: classified.message,
      type: classified.type,
      code: classified.code,
    });
  }
}
