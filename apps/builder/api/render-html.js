import { ensurePost, getCore } from "./_shared.js";

export default async function handler(req, res) {
  if (!ensurePost(req, res)) return;

  try {
    const template = String(req.body?.template || "");
    const data =
      req.body?.data && typeof req.body.data === "object" ? req.body.data : {};

    const core = await getCore();
    const doc = core.parseAndMerge(template, data);
    const html = core.renderHTML(doc);

    res.status(200).json({ html });
  } catch (error) {
    res
      .status(400)
      .json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
  }
}
