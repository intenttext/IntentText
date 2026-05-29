import { useEffect, useRef, MutableRefObject } from "react";
import * as monaco from "monaco-editor";
import { registerLanguage } from "./language";
import { registerThemes } from "./theme";
import { registerCompletionProvider } from "./completion";
import { registerHoverProvider } from "./hover";
import type { EditorThemeMode } from "../App";

// Self-hosted workers — Vite worker imports
// @ts-expect-error Vite worker import
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
// @ts-expect-error Vite worker import
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === "typescript" || label === "javascript") return new tsWorker();
    return new editorWorker();
  },
};

let registered = false;

function ensureRegistered() {
  if (registered) return;
  registered = true;
  registerLanguage(monaco);
  registerThemes(monaco);
  registerCompletionProvider(monaco);
  registerHoverProvider(monaco);
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  editorTheme: EditorThemeMode;
}

export function MonacoEditor({ value, onChange, editorRef, editorTheme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSettingValue = useRef(false);

  useEffect(() => {
    ensureRegistered();
    const el = containerRef.current;
    if (!el) return;

    const editor = monaco.editor.create(el, {
      value,
      language: "intenttext",
      theme: editorTheme === "dark" ? "intenttext-dark" : "intenttext-light",
      fontSize: 14,
      lineHeight: 24,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontLigatures: true,
      wordWrap: "on",
      wordWrapColumn: 100,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      renderLineHighlight: "line",
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      padding: { top: 24, bottom: 24 },
      lineNumbers: "on",
      glyphMargin: false,
      folding: true,
      quickSuggestions: true,
      automaticLayout: true,
      tabSize: 2,
    });

    editorRef.current = editor;

    editor.onDidChangeModelContent(() => {
      if (!isSettingValue.current) {
        onChange(editor.getValue());
      }
    });

    return () => {
      editor.dispose();
      editorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external value changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    if (model.getValue() !== value) {
      isSettingValue.current = true;
      model.setValue(value);
      isSettingValue.current = false;
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme changes
  useEffect(() => {
    monaco.editor.setTheme(
      editorTheme === "dark" ? "intenttext-dark" : "intenttext-light"
    );
  }, [editorTheme]);

  return <div ref={containerRef} className="monaco-container" />;
}
