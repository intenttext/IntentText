import type { CoreApi } from "./types.js";

export async function loadCore(): Promise<CoreApi> {
  const candidates = ["@intenttext/core"];

  let coreModule: Record<string, unknown> | null = null;
  let lastErr: unknown = null;
  for (const spec of candidates) {
    try {
      coreModule = (await import(spec)) as Record<string, unknown>;
      break;
    } catch (error) {
      lastErr = error;
    }
  }

  if (!coreModule) {
    throw lastErr instanceof Error
      ? lastErr
      : new Error("Unable to load @intenttext/core");
  }
  const parseIntentTextSafe = coreModule.parseIntentTextSafe;
  const parseAndMerge = coreModule.parseAndMerge;
  const renderHTML = coreModule.renderHTML;

  if (
    typeof parseIntentTextSafe !== "function" ||
    typeof parseAndMerge !== "function" ||
    typeof renderHTML !== "function"
  ) {
    throw new Error(
      "@intenttext/core missing parseIntentTextSafe/parseAndMerge/renderHTML",
    );
  }

  return {
    validateTemplate: ((template: string) =>
      (parseIntentTextSafe as (source: string) => unknown)(
        template,
      )) as CoreApi["validateTemplate"],
    renderHtml: ((template: string, data: Record<string, unknown>) => {
      const doc = (
        parseAndMerge as (
          source: string,
          input: Record<string, unknown>,
        ) => unknown
      )(template, data);
      return (renderHTML as (document: unknown) => string)(doc);
    }) as CoreApi["renderHtml"],
  };
}
