interface Props {
  blocks: number;
  lines: number;
  keywords: number;
  words: number;
  errors: number;
  theme: string;
  /** Live autosave state for the Google-Docs-style "Saving…/Saved" indicator. */
  saveState: "saving" | "saved";
  onErrorClick: () => void;
}

export function StatusBar({
  blocks,
  lines,
  keywords,
  words,
  errors,
  theme,
  saveState,
  onErrorClick,
}: Props) {
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
        <span>Canonical Keywords: {keywords}</span>
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
        <span title="Powered by @dotit/core">@dotit/core</span>
        <span>Theme: {theme}</span>
        <span
          title="Auto-saved in this browser. File ▸ Download to save a copy to your device."
        >
          {saveState === "saving" ? (
            <span style={{ color: "var(--text-muted)" }}>Saving…</span>
          ) : (
            <span style={{ color: "var(--success)" }}>✓ Saved</span>
          )}
        </span>
      </div>
    </div>
  );
}
