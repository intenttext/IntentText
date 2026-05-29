import { useRef, useEffect, useCallback, useMemo } from "react";
import {
  parseIntentText,
  renderHTML,
  generateThemeCSS,
  getBuiltinTheme,
} from "@intenttext/core";

interface Props {
  content: string;
  theme: string;
  errors: string[];
}

export function Preview({ content, theme, errors }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const themeCSS = useMemo(() => {
    try {
      const t = getBuiltinTheme(theme);
      return t ? generateThemeCSS(t) : "";
    } catch {
      return "";
    }
  }, [theme]);

  const render = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let html = "";
    try {
      const doc = parseIntentText(content);
      html = renderHTML(doc, { theme });
    } catch {
      html = "<p style='color:#f85149;padding:24px;'>Parse error</p>";
    }

    const errorBanner =
      errors.length > 0
        ? `<div style="background:rgba(248,81,73,0.1);border-bottom:1px solid rgba(248,81,73,0.3);color:#f85149;padding:8px 24px;font:12px/1.5 monospace;">${errors
            .map((e) => e.replace(/</g, "&lt;"))
            .join("<br>")}</div>`
        : "";

    iframe.srcdoc = `<!doctype html>
<html>
<head>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; background: #fff; }
  ${themeCSS}
  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
  /* Trust banners */
  .it-frozen-banner { background: #fef3c7; border: 1px solid #fbbf24; color: #92400e; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
  .it-signed-badge { display: inline-block; background: #dcfce7; border: 1px solid #4ade80; color: #166534; padding: 4px 12px; border-radius: 16px; font-size: 13px; margin: 4px 0; }
  .it-approval-stamp { display: inline-block; background: #dbeafe; border: 1px solid #60a5fa; color: #1e40af; padding: 4px 12px; border-radius: 16px; font-size: 13px; margin: 4px 0; }
  .it-amendment-notice { background: #fff7ed; border: 1px solid #fb923c; color: #9a3412; padding: 8px 16px; border-radius: 8px; margin: 8px 0; font-size: 14px; }
</style>
</head>
<body>
${errorBanner}
${html}
</body>
</html>`;
  }, [content, theme, themeCSS, errors]);

  // Debounced render at 300ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(render, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [render]);

  return <iframe ref={iframeRef} title="Preview" />;
}
