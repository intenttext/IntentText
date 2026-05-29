import type * as Monaco from "monaco-editor";

export function registerThemes(monaco: typeof Monaco) {
  monaco.editor.defineTheme("intenttext-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "4b5563", fontStyle: "italic" },
      { token: "boundary", foreground: "374151" },
      { token: "template.variable", foreground: "fbbf24" },
      { token: "keyword.trust", foreground: "f59e0b", fontStyle: "bold" },
      { token: "keyword.identity", foreground: "60a5fa", fontStyle: "bold" },
      { token: "keyword.structure", foreground: "4ade80", fontStyle: "bold" },
      { token: "keyword.content", foreground: "e2e8f0", fontStyle: "bold" },
      { token: "keyword.data", foreground: "c084fc", fontStyle: "bold" },
      { token: "keyword.agent", foreground: "fb923c", fontStyle: "bold" },
      { token: "keyword.layout", foreground: "94a3b8", fontStyle: "bold" },
      { token: "delimiter.pipe", foreground: "475569" },
      { token: "property.key", foreground: "7dd3fc" },
    ],
    colors: {
      "editor.background": "#0f1117",
      "editor.lineHighlightBackground": "#1a1f2e",
      "editorGutter.background": "#0d1117",
      "editor.selectionBackground": "#1e3a5f",
      "editorLineNumber.foreground": "#30363d",
      "editorLineNumber.activeForeground": "#7d8590",
      "editor.foreground": "#e6edf3",
    },
  });

  monaco.editor.defineTheme("intenttext-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "9ca3af", fontStyle: "italic" },
      { token: "boundary", foreground: "d1d5db" },
      { token: "template.variable", foreground: "b45309" },
      { token: "keyword.trust", foreground: "b45309", fontStyle: "bold" },
      { token: "keyword.identity", foreground: "2563eb", fontStyle: "bold" },
      { token: "keyword.structure", foreground: "16a34a", fontStyle: "bold" },
      { token: "keyword.content", foreground: "1e293b", fontStyle: "bold" },
      { token: "keyword.data", foreground: "7c3aed", fontStyle: "bold" },
      { token: "keyword.agent", foreground: "ea580c", fontStyle: "bold" },
      { token: "keyword.layout", foreground: "64748b", fontStyle: "bold" },
      { token: "delimiter.pipe", foreground: "94a3b8" },
      { token: "property.key", foreground: "0284c7" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.lineHighlightBackground": "#f8fafc",
      "editorGutter.background": "#f1f5f9",
      "editor.selectionBackground": "#bfdbfe",
      "editorLineNumber.foreground": "#d1d5db",
      "editorLineNumber.activeForeground": "#6b7280",
      "editor.foreground": "#1e293b",
    },
  });
}
