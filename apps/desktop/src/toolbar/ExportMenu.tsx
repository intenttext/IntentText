import {
  parseIntentText,
  renderHTML,
  generateThemeCSS,
  getBuiltinTheme,
  documentToSource,
  convertMarkdownToIntentText,
} from "@intenttext/core";

interface Props {
  content: string;
  theme: string;
  onClose: () => void;
}

function toMarkdown(content: string): string {
  try {
    const doc = parseIntentText(content);
    const lines: string[] = [];
    for (const b of doc.blocks) {
      const c = b.content ?? "";
      switch (b.type) {
        case "title":
          lines.push(`# ${c}`);
          break;
        case "section":
          lines.push(`\n## ${c}`);
          break;
        case "sub":
          lines.push(`\n### ${c}`);
          break;
        case "text":
          lines.push(`\n${c}`);
          break;
        case "task":
          lines.push(`- [ ] ${c}`);
          break;
        case "done":
          lines.push(`- [x] ${c}`);
          break;
        case "quote":
          lines.push(`\n> ${c}`);
          break;
        case "info":
          {
            const t = String(b.properties?.type || "").toLowerCase();
            if (t === "warning") lines.push(`\n> ⚠️ ${c}`);
            else if (t === "tip") lines.push(`\n> 💡 ${c}`);
            else lines.push(`\n> ℹ️ ${c}`);
          }
          break;
        case "link":
          lines.push(`[${c}](${b.properties?.to ?? "#"})`);
          break;
        case "code":
          lines.push(`\n\`\`\`\n${c}\n\`\`\``);
          break;
        case "divider":
          lines.push("\n---");
          break;
        default:
          lines.push(`\n${c}`);
      }
    }
    return lines.join("\n").trim();
  } catch {
    return content;
  }
}

export function ExportMenu({ content, theme, onClose }: Props) {
  const exportPDF = () => {
    const iframe = document.querySelector<HTMLIFrameElement>(
      ".panel-preview iframe",
    );
    if (iframe?.contentWindow) iframe.contentWindow.print();
    onClose();
  };

  const exportHTML = () => {
    try {
      const doc = parseIntentText(content);
      const html = renderHTML(doc, { theme });
      const t = getBuiltinTheme(theme);
      const css = t ? generateThemeCSS(t) : "";
      const full = `<!doctype html>\n<html>\n<head>\n<style>\nbody { font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto; }\n${css}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
      download(full, "document.html", "text/html");
    } catch {
      /* ignore */
    }
    onClose();
  };

  const exportMarkdown = () => {
    const md = toMarkdown(content);
    download(md, "document.md", "text/markdown");
    onClose();
  };

  const copyHTML = async () => {
    try {
      const doc = parseIntentText(content);
      const html = renderHTML(doc, { theme });
      await navigator.clipboard.writeText(html);
    } catch {
      /* ignore */
    }
    onClose();
  };

  // Import back from markdown
  void convertMarkdownToIntentText;
  void documentToSource;

  return (
    <div className="dropdown-menu">
      <button className="dropdown-item" onClick={exportPDF}>
        📄 Export as PDF
      </button>
      <button className="dropdown-item" onClick={exportHTML}>
        🌐 Export as HTML
      </button>
      <button className="dropdown-item" onClick={exportMarkdown}>
        📝 Export as Markdown
      </button>
      <div className="dropdown-sep" />
      <button className="dropdown-item" onClick={copyHTML}>
        📋 Copy HTML to clipboard
      </button>
    </div>
  );
}

function download(data: string, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
