interface Props {
  onAction: (action: string) => void;
}

export function TrustMenu({ onAction }: Props) {
  return (
    <div className="dropdown-menu">
      <button className="dropdown-item" onClick={() => onAction("seal")}>
        🔒 Seal document
      </button>
      <button className="dropdown-item" onClick={() => onAction("verify")}>
        ✓ Verify document
      </button>
      <button className="dropdown-item" onClick={() => onAction("history")}>
        📜 View history
      </button>
      <button className="dropdown-item" onClick={() => onAction("amend")}>
        ✏️ Add amendment
      </button>
    </div>
  );
}
