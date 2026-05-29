import { BrowserPool } from "./browser-pool.js";
import { loadCore } from "./core-loader.js";
import { DEFAULT_RUNTIME_CONFIG } from "./defaults.js";
import { executeWithRetries } from "./retry.js";
import type {
  BrowserPoolConfig,
  CreatePdfRequest,
  CreatePdfResult,
  RenderHtmlRequest,
  RuntimeMetrics,
  RuntimeConfig,
  ValidateTemplateRequest,
} from "./types.js";

function mergeConfig(config?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    browserPool: {
      ...DEFAULT_RUNTIME_CONFIG.browserPool,
      ...(config?.browserPool ?? {}),
    },
    retryAttempts:
      config?.retryAttempts ?? DEFAULT_RUNTIME_CONFIG.retryAttempts,
    shutdownGraceMs:
      config?.shutdownGraceMs ?? DEFAULT_RUNTIME_CONFIG.shutdownGraceMs,
  };
}

async function loadPuppeteer(): Promise<{
  launch: (opts?: Record<string, unknown>) => Promise<any>;
}> {
  try {
    const moduleId = "puppeteer";
    return (await import(moduleId)) as {
      launch: (opts?: Record<string, unknown>) => Promise<any>;
    };
  } catch {
    throw new Error(
      "puppeteer is required for createPdf. Install it in the runtime package consumer.",
    );
  }
}

type PageLike = {
  setContent: (html: string, options?: { waitUntil?: string }) => Promise<void>;
  pdf: (options?: Record<string, unknown>) => Promise<Uint8Array>;
};

type PoolLike = {
  withPage: <T>(task: (page: PageLike) => Promise<T>) => Promise<{
    value: T;
    queueWaitMs: number;
  }>;
  getCrashCount: () => number;
  shutdown: () => Promise<void>;
};

type CreatePdfDeps = {
  renderHtmlFn: (request: RenderHtmlRequest) => Promise<string>;
  loadPuppeteerFn: () => Promise<{
    launch: (opts?: Record<string, unknown>) => Promise<unknown>;
  }>;
  createPool: (
    config: BrowserPoolConfig,
    launchBrowser: () => Promise<any>,
  ) => PoolLike;
  now: () => number;
};

async function createPdfWithDeps(
  request: CreatePdfRequest,
  config: Partial<RuntimeConfig> | undefined,
  deps: CreatePdfDeps,
): Promise<CreatePdfResult> {
  const startedAt = deps.now();
  const finalConfig = mergeConfig(config);
  const html = await deps.renderHtmlFn(request);
  const puppeteer = await deps.loadPuppeteerFn();
  let totalCrashCount = 0;

  const result = await executeWithRetries(
    async () => {
      const pool = deps.createPool(finalConfig.browserPool, () =>
        puppeteer.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        }),
      );

      try {
        const pageResult = await pool.withPage(async (page) => {
          await page.setContent(html, { waitUntil: "networkidle0" });
          const raw = await page.pdf({
            format: "A4",
            printBackground: true,
            ...(request.pdf ?? {}),
          });
          return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        });

        totalCrashCount += pool.getCrashCount();
        const metrics: RuntimeMetrics = {
          durationMs: deps.now() - startedAt,
          queueWaitMs: pageResult.queueWaitMs,
          crashCount: totalCrashCount,
        };

        return { pdf: pageResult.value, metrics };
      } catch (error) {
        totalCrashCount += pool.getCrashCount();
        throw error;
      } finally {
        const shutdown = pool.shutdown();
        await Promise.race([
          shutdown,
          new Promise((resolve) =>
            setTimeout(resolve, finalConfig.shutdownGraceMs),
          ),
        ]);
      }
    },
    {
      retryAttempts: finalConfig.retryAttempts,
    },
  );

  return { html, pdf: result.pdf, metrics: result.metrics };
}

export async function validateTemplate(
  request: ValidateTemplateRequest,
): Promise<unknown> {
  const core = await loadCore();
  return core.validateTemplate(request.template);
}

export async function renderHtml(request: RenderHtmlRequest): Promise<string> {
  const core = await loadCore();
  return core.renderHtml(request.template, request.data);
}

export async function createPdf(
  request: CreatePdfRequest,
  config?: Partial<RuntimeConfig>,
): Promise<CreatePdfResult> {
  return createPdfWithDeps(request, config, {
    renderHtmlFn: renderHtml,
    loadPuppeteerFn: loadPuppeteer,
    createPool: (poolConfig, launchBrowser) =>
      new BrowserPool(poolConfig, launchBrowser),
    now: () => Date.now(),
  });
}

// Testing-only hooks for integration tests that should not depend on live browsers.
export const __testing = {
  createPdfWithDeps,
};

export type {
  CreatePdfRequest,
  CreatePdfResult,
  RenderHtmlRequest,
  RuntimeConfig,
  RuntimeMetrics,
  ValidateTemplateRequest,
} from "./types.js";
