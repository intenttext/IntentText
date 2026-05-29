import { validateDocument, PREDEFINED_SCHEMAS, parseIntentText } from "@intenttext/core";
import type { ModalType } from "../App";

interface Props {
  content: string;
  onContentChange: (c: string) => void;
  onClose: () => void;
  onModal: (m: ModalType) => void;
}

export function ToolsMenu({ content, onContentChange, onClose, onModal }: Props) {
  void onContentChange; // used in convert modal

  const validate = () => {
    try {
      const doc = parseIntentText(content);
      const schema = PREDEFINED_SCHEMAS.meeting || Object.values(PREDEFINED_SCHEMAS)[0];
      if (schema) {
        const result = validateDocument(doc, schema);
        if (result.valid) {
          alert("Document is valid ✅");
        } else {
          alert(
            "Validation issues:\n" +
              result.errors.map((e) => `• ${e.message}`).join("\n")
          );
        }
      }
    } catch (err) {
      alert("Parse error: " + (err instanceof Error ? err.message : String(err)));
    }
    onClose();
  };

  return (
    <div className="dropdown-menu">
      <button
        className="dropdown-item"
        onClick={() => {
          onClose();
          onModal("convert");
        }}
      >
        🔄 Convert from HTML / Markdown
      </button>
      <button className="dropdown-item" onClick={validate}>
        ✓ Validate document
      </button>
      <div className="dropdown-sep" />
      <a
        className="dropdown-item"
        href="https://intenttext-hub.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
      >
        🌐 Browse Hub templates
      </a>
    </div>
  );
}
