export type TemplateValidationIssue = {
  code: string;
  category: "parse" | "template" | "data_contract" | "system";
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type VariableInventory = {
  all: string[];
  required: string[];
  optional: string[];
  repeated: Array<{
    path: string;
    itemAlias?: string;
    collection?: string;
  }>;
};

export type TemplateValidationResult = {
  valid: boolean;
  issues: TemplateValidationIssue[];
  variables: VariableInventory;
};

export type RenderRequest = {
  template: string;
  data: Record<string, unknown>;
};

export type RuntimeMetrics = {
  durationMs: number;
  queueWaitMs: number;
  crashCount: number;
};

export type RenderPdfRequest = RenderRequest & {
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
  runtimeConfig?: {
    browserPool?: {
      maxBrowsers?: number;
      maxPagesPerBrowser?: number;
      queueTimeoutMs?: number;
      launchTimeoutMs?: number;
      taskTimeoutMs?: number;
    };
    retryAttempts?: number;
    shutdownGraceMs?: number;
  };
};

export type RenderHtmlResponse = {
  html: string;
};

export type RenderPdfResponse = {
  html: string;
  pdfBase64: string;
  metrics: RuntimeMetrics | null;
};

export type ReplayHtmlRequest = {
  artifact: {
    template: string;
    template_version: string;
    renderer_version: string;
    theme_version: string;
  };
  data?: Record<string, unknown>;
};

export type ReplayHtmlResponse = {
  html: string;
  replay: {
    template_version: string;
    renderer_version: string;
    theme_version: string;
    html_sha256: string;
  };
  migration: {
    from: {
      template_version: string;
      renderer_version: string;
      theme_version: string;
    };
    to: {
      template_version: string;
      renderer_version: string;
      theme_version: string;
    };
    applied_hooks: string[];
  };
};

export type RenderPdfErrorResponse = {
  error: string;
  type: "template_error" | "data_error" | "render_error" | "pdf_backend_error";
  code: string;
};

const API_BASE = import.meta.env.VITE_RENDER_API_BASE_URL ?? "/api";

function endpoint(path: string): string {
  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export async function validateTemplate(
  template: string,
): Promise<TemplateValidationResult> {
  const res = await fetch(endpoint("/validate-template"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ template }),
  });
  if (!res.ok) {
    throw new Error(`validateTemplate failed: ${res.status}`);
  }
  return res.json() as Promise<TemplateValidationResult>;
}

export async function renderHtml(
  req: RenderRequest,
): Promise<RenderHtmlResponse> {
  const res = await fetch(endpoint("/render-html"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`renderHtml failed: ${res.status}`);
  }
  return res.json() as Promise<RenderHtmlResponse>;
}

export async function renderPdf(
  req: RenderPdfRequest,
): Promise<RenderPdfResponse> {
  const res = await fetch(endpoint("/render-pdf"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = `renderPdf failed: ${res.status}`;
    try {
      const body = (await res.json()) as Partial<RenderPdfErrorResponse>;
      if (body?.error && body?.type && body?.code) {
        detail = `${body.type} (${body.code}): ${body.error}`;
      }
    } catch {
      // Keep default status-based error message.
    }
    throw new Error(detail);
  }
  return res.json() as Promise<RenderPdfResponse>;
}

export async function replayHtml(
  req: ReplayHtmlRequest,
): Promise<ReplayHtmlResponse> {
  const res = await fetch(endpoint("/replay-html"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let detail = `replayHtml failed: ${res.status}`;
    try {
      const body = (await res.json()) as Partial<RenderPdfErrorResponse>;
      if (body?.error && body?.type && body?.code) {
        detail = `${body.type} (${body.code}): ${body.error}`;
      }
    } catch {
      // Keep default status-based error message.
    }
    throw new Error(detail);
  }
  return res.json() as Promise<ReplayHtmlResponse>;
}
