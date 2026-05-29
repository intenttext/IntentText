interface Props {
  onClose: () => void;
}

const shortcuts: [string, string][] = [
  ["⌘ S", "Save file"],
  ["⌘ O", "Open file"],
  ["⌘ N", "New document"],
  ["⌘ \\", "Toggle preview"],
  ["⌘ ⇧ \\", "Preview-only mode"],
  ["⌘ ⇧ E", "Export PDF"],
  ["⌘ ⇧ V", "Verify document"],
  ["Esc", "Close modal / menu"],
  ["⌘ Z", "Undo"],
  ["⌘ ⇧ Z", "Redo"],
  ["⌘ D", "Select next occurrence"],
  ["⌘ /", "Toggle comment"],
  ["⌘ ⇧ K", "Delete line"],
  ["Alt ↑/↓", "Move line up/down"],
];

export function HelpOverlay({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <h2>⌨️ Keyboard Shortcuts</h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <tbody>
            {shortcuts.map(([key, desc]) => (
              <tr
                key={key}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td
                  style={{
                    padding: "8px 12px 8px 0",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                    color: "var(--accent)",
                    fontWeight: 600,
                  }}
                >
                  {key}
                </td>
                <td style={{ padding: "8px 0", color: "var(--text-primary)" }}>
                  {desc}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Monaco editor shortcuts also work (Ctrl+Space for autocomplete, F1
          for command palette, etc.)
        </p>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
