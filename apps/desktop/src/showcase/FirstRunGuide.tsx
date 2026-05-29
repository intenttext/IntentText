import type { DemoDoc } from "./demoVault";

interface Props {
  docs: DemoDoc[];
  mainFolderPath: string | null;
  onChangeMainFolder: () => void;
  onPick: (doc: DemoDoc) => void;
  onClose: () => void;
}

export function FirstRunGuide({
  docs,
  mainFolderPath,
  onChangeMainFolder,
  onPick,
  onClose,
}: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal showcase-guide"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Dotit Showcase</h2>
        <p>
          This editor is now in showcase mode. Use the right panel mode switch
          to move between Search, Trust, and Workflow.
        </p>

        <div className="showcase-current-doc" style={{ margin: "0 0 12px" }}>
          <label>Main folder</label>
          <div style={{ marginBottom: 8 }}>
            {mainFolderPath || "Not set yet"}
          </div>
          <button className="btn-secondary" onClick={onChangeMainFolder}>
            Change Main Folder
          </button>
        </div>

        <div className="showcase-guide-list">
          {docs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onPick(doc)}
              className="showcase-guide-item"
            >
              <strong>{doc.title}</strong>
              <span>
                {doc.section}/{doc.id}.it
              </span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Continue with Current
          </button>
        </div>
      </div>
    </div>
  );
}
