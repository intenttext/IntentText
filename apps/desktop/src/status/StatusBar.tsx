import type { EditorThemeMode } from "../App";

interface Props {
  blocks: number;
  lines: number;
  keywords: number;
  words: number;
  errors: number;
  theme: string;
  mainFolderPath: string | null;
  isUnsaved: boolean;
  editorTheme: EditorThemeMode;
  onToggleEditorTheme: () => void;
  onChangeMainFolder: () => void;
  onErrorClick: () => void;
}

export function StatusBar({
  blocks,
  lines,
  keywords,
  words,
  errors,
  theme,
  mainFolderPath,
  isUnsaved,
  editorTheme,
  onToggleEditorTheme,
  onChangeMainFolder,
  onErrorClick,
}: Props) {
  const compactMainFolder =
    mainFolderPath && mainFolderPath.length > 44
      ? `...${mainFolderPath.slice(-44)}`
      : (mainFolderPath ?? "Not set");

  return (
    <div
      style={{
        height: "var(--status-h)",
        background: "var(--bg-toolbar)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        fontVariantNumeric: "tabular-nums",
        color: "var(--text-muted)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", gap: 16 }}>
        <span>Blocks: {blocks}</span>
        <span>Lines: {lines}</span>
        <span>Keywords: {keywords}</span>
        <span>Words: {words}</span>
        {errors > 0 && (
          <button
            onClick={onErrorClick}
            style={{
              color: "var(--error)",
              fontSize: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0,
            }}
          >
            ⚠ {errors} error{errors !== 1 ? "s" : ""}
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span>v3.1.0</span>
        <span>Theme: {theme}</span>
        <span title={mainFolderPath ?? "No main folder selected"}>
          Main Folder: {compactMainFolder}
        </span>
        <button
          onClick={onChangeMainFolder}
          title="Change main folder"
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            padding: "1px 6px",
            lineHeight: 1.4,
            color: "var(--text-muted)",
          }}
        >
          Change
        </button>
        <span>
          {isUnsaved ? (
            <span style={{ color: "var(--warning)" }}>● Unsaved</span>
          ) : (
            <span style={{ color: "var(--success)" }}>✓ Saved</span>
          )}
        </span>
        <button
          onClick={onToggleEditorTheme}
          title="Toggle editor theme"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            padding: 0,
            lineHeight: 1,
          }}
        >
          {editorTheme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}
