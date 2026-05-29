function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightItSource(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);

      // Comments
      if (line.trim().startsWith("//")) {
        return `<span class="it-comment">${escaped}</span>`;
      }

      // Dividers
      if (line.trim() === "---") {
        return `<span class="it-divider">${escaped}</span>`;
      }

      let result = escaped;

      // Keyword at line start
      result = result.replace(
        /^(\s*)([\w-]+)(:)/,
        (_, space, kw, colon) =>
          `${space}<span class="it-kw">${kw}</span>${colon}`,
      );

      // Pipe property keys
      result = result.replace(
        /(\|\s*)([\w-]+)(:)/g,
        (_, pipe, key, colon) =>
          `${pipe}<span class="it-prop">${key}</span>${colon}`,
      );

      // Template variables
      result = result.replace(
        /\{\{([^}]+)\}\}/g,
        (_, v) => `<span class="it-var">{{${v}}}</span>`,
      );

      // Inline bold *text*
      result = result.replace(
        /\*([^*]+)\*/g,
        (_, t) => `<span class="it-bold">*${t}*</span>`,
      );

      return result;
    })
    .join("\n");
}

export default function ItSourceViewer({ source }: { source: string }) {
  return (
    <pre className="it-source">
      <code dangerouslySetInnerHTML={{ __html: highlightItSource(source) }} />
    </pre>
  );
}
