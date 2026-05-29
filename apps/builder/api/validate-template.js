import {
  buildVariableInventory,
  ensurePost,
  getCore,
  mapParseIssues,
  validateLayoutIssues,
} from "./_shared.js";

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const template = String(req.body?.template || "");
    const core = await getCore();
    const parsed = core.parseIntentTextSafe(template);
    const issues = [
      ...mapParseIssues(parsed),
      ...validateLayoutIssues(parsed.document),
    ];

    res.status(200).json({
      valid: !issues.some((i) => i.severity === "error"),
      issues,
      variables: buildVariableInventory(template),
    });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
