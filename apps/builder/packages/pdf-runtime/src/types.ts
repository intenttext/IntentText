export interface BrowserPoolConfig {
  maxBrowsers: number;
  maxPagesPerBrowser: number;
  queueTimeoutMs: number;
  launchTimeoutMs: number;
  taskTimeoutMs: number;
}

export interface RuntimeConfig {
  browserPool: BrowserPoolConfig;
  retryAttempts: number;
  shutdownGraceMs: number;
}

export interface ValidateTemplateRequest {
  template: string;
}

export interface RenderHtmlRequest {
  template: string;
  data: Record<string, unknown>;
}

export interface CreatePdfRequest extends RenderHtmlRequest {
  pdf?: {
    format?: string;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
  };
}

export interface CreatePdfResult {
  pdf: Uint8Array;
  html: string;
  metrics: RuntimeMetrics;
}

export interface RuntimeMetrics {
  durationMs: number;
  queueWaitMs: number;
  crashCount: number;
}

export type CoreApi = {
  validateTemplate: (template: string) => unknown;
  renderHtml: (template: string, data: Record<string, unknown>) => string;
};
