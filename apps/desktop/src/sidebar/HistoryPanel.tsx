interface HistoryPanelProps {
  recentFiles: string[];
  onFileOpen: (path: string) => void;
}

export function HistoryPanel({ recentFiles, onFileOpen }: HistoryPanelProps) {
  if (recentFiles.length === 0) {
    return (
      <div className="sidebar-empty">
        <p>No recent files</p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      {recentFiles.map((path, i) => {
        const parts = path.replace(/\\/g, "/").split("/");
        const name = parts.pop() ?? path;
        const folder = parts.pop() ?? "";

        return (
          <div
            key={i}
            className="history-item"
            onClick={() => onFileOpen(path)}
          >
            <span className="history-icon">📄</span>
            <div className="history-info">
              <div className="history-name">{name}</div>
              {folder && <div className="history-folder">{folder}/</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
