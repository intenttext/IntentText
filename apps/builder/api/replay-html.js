import {
  classifyPdfRuntimeError,
  createTypedError,
  ensurePost,
  getCore,
  normalizeHtml,
  sha256Hex,
} from "./_shared.js";
import { applyArtifactMigrations } from "./migration-hooks.js";

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const artifact =
      req.body?.artifact && typeof req.body.artifact === "object"
        ? req.body.artifact
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
      req.body?.data === undefined
        ? {}
        : req.body?.data && typeof req.body.data === "object"
          ? req.body.data
          : (() => {
              throw createTypedError(
                "data_error",
                "DATA_INVALID",
                "data must be an object when provided.",
                422,
              );
            })();

    const core = await getCore();
    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);
    const htmlSha256 = sha256Hex(normalizeHtml(html));

    res.status(200).json({
      html,
      replay: {
        template_version: templateVersion,
        renderer_version: rendererVersion,
        theme_version: themeVersion,
        html_sha256: htmlSha256,
      },
      migration: migrated.migration,
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
