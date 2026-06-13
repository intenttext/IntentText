import { useState, useRef, useCallback, useEffect } from "react";
import {
  IntentTextEditor,
  exportDocumentPDF,
  exportDocumentHTML,
  extractTemplateVariables,
} from "@dotit/editor";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./status/StatusBar";
import { MonacoEditor } from "./editor/MonacoEditor";
import { TrustPanel } from "./panels/TrustPanel";
import { TemplatePanel } from "./panels/TemplatePanel";
import { SealModal } from "./modals/SealModal";
import { VerifyModal } from "./modals/VerifyModal";
import { HistoryModal } from "./modals/HistoryModal";
import { AmendModal } from "./modals/AmendModal";
import { ConvertModal } from "./modals/ConvertModal";
import { HelpOverlay } from "./modals/HelpOverlay";
import { useWorkspace } from "./hooks/useWorkspace";
import { useFile } from "./hooks/useFile";
import { useAutoSave, readDraft } from "./hooks/useAutoSave";
import { useDocument } from "./hooks/useDocument";
import { useDocumentMeta } from "./hooks/useDocumentMeta";
import { useTrustState } from "./hooks/useTrustState";
import type { EditorMode } from "./types";
import type * as monaco from "monaco-editor";
import {
  DEMO_DOCS,
  DEFAULT_DEMO_DOC_ID,
  getDemoDocById,
  type DemoDoc,
} from "./showcase/demoVault";

const WELCOME = `title: My First Document
summary: A document written in Dotit

section: Getting Started
text: Dotit uses a frozen canonical keyword contract in core.
text: The preview on the right updates as you type.
info: Try changing the theme using the Theme picker above. | type: tip

section: Learn More
link: Documentation | to: https://dotit.uts.qa
link: Browse Templates | to: https://hub.dotit.uts.qa
link: GitHub | to: https://github.com/intenttext/IntentText
`;

export type ModalType =
  | "seal"
  | "verify"
  | "history"
  | "amend"
  | "convert"
  | "help"
  | "trust"
  | "template"
  | null;

export default function App() {
  const workspace = useWorkspace();
  const { content, setContent, filename, setFilename, isUnsaved, markSaved } =
    workspace;

  const docState = useDocument(content);
  const { openFile, saveFile, newFile } = useFile(workspace);
  useAutoSave(content, filename);
  const docMeta = useDocumentMeta(content, setContent);
  const trustState = useTrustState(content, setContent);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("it-editor-theme") || "corporate",
  );
  const [uiTheme, setUiTheme] = useState<"light" | "dark">(
    () =>
      (localStorage.getItem("it-editor-color") as "light" | "dark") || "light",
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    () => (localStorage.getItem("it-editor-mode") as EditorMode) || "visual",
  );
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    localStorage.setItem("it-editor-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("it-editor-color", uiTheme);
    document.documentElement.setAttribute("data-theme", uiTheme);
  }, [uiTheme]);
  useEffect(() => {
    localStorage.setItem("it-editor-mode", editorMode);
  }, [editorMode]);
  // The visual editor's canvas is a light, paper-like surface — force light
  // chrome while it is active (previously done inside VisualEditor itself).
  useEffect(() => {
    if (editorMode === "visual") {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [editorMode]);

  // Load from URL ?source= parameter (hub "Open in Editor")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source) {
      setContent(source);
      markSaved();
      // Clean the URL so a refresh doesn't reload from param
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!content) {
      // Silent auto-restore: the editor is opening with the default/empty doc,
      // so a newer autosaved draft can never clobber a deliberately opened
      // file — just load it and keep autosaving. No prompt.
      const draft = readDraft();
      if (draft) {
        setContent(draft.content);
        if (draft.filename) setFilename(draft.filename);
        return; // restored work is unsaved by definition
      }
      const defaultDoc = getDemoDocById(DEFAULT_DEMO_DOC_ID);
      setContent(defaultDoc?.source || WELCOME);
      setFilename(defaultDoc ? `${defaultDoc.id}.it` : "untitled.it");
      markSaved();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDemoDoc = useCallback(
    (doc: DemoDoc) => {
      setContent(doc.source);
      setFilename(`${doc.id}.it`);
      markSaved();
    },
    [setContent, setFilename, markSaved],
  );

  // Insert text at the caret of whichever editor is active. The visual editor
  // listens for this event (it owns the TipTap instance).
  const insertAtCaret = useCallback(
    (text: string) => {
      if (editorMode === "source" && editorRef.current) {
        const ed = editorRef.current;
        const sel = ed.getSelection();
        if (sel) {
          ed.executeEdits("template-insert", [
            { range: sel, text, forceMoveMarkers: true },
          ]);
          ed.focus();
        }
        return;
      }
      window.dispatchEvent(
        new CustomEvent("it-insert-text", { detail: text }),
      );
    },
    [editorMode],
  );

  const templateVarCount = extractTemplateVariables(content).length;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      } else if (mod && e.key === "o") {
        e.preventDefault();
        openFile();
      } else if (mod && e.key === "n") {
        e.preventDefault();
        newFile(WELCOME);
      } else if (mod && e.shiftKey && e.key === "V") {
        e.preventDefault();
        setModal("verify");
      } else if (e.key === "Escape") {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, openFile, newFile]);

  // Drag and drop files
  useEffect(() => {
    const handler = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (file.name.endsWith(".it") || file.name.endsWith(".json")) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          if (file.name.endsWith(".json")) {
            // JSON merge — not implemented inline, open convert modal
            setModal("convert");
          } else {
            setContent(text);
            setFilename(file.name);
            markSaved();
          }
        };
        reader.readAsText(file);
      }
    };
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", handler);
    window.addEventListener("dragover", prevent);
    return () => {
      window.removeEventListener("drop", handler);
      window.removeEventListener("dragover", prevent);
    };
  }, [setContent, setFilename, markSaved]);

  return (
    <>
      <div className="app-shell">
        <Toolbar
          filename={filename}
          onFilenameChange={setFilename}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          theme={theme}
          onThemeChange={setTheme}
          onNew={() => newFile(WELCOME)}
          onOpen={openFile}
          onSave={saveFile}
          onModal={setModal}
          onExportPDF={() => exportDocumentPDF(content, theme)}
          onExportHTML={() => exportDocumentHTML(content, theme)}
          isSealed={trustState.trust.isSealed}
          isTemplate={trustState.isTemplate}
          templateVarCount={templateVarCount}
          samples={DEMO_DOCS.map((d) => ({ id: d.id, title: d.title }))}
          onLoadSample={(id) => {
            const doc = getDemoDocById(id);
            if (doc) loadDemoDoc(doc);
          }}
        />

        <div className="panels" style={{ flex: 1 }}>
          <div className="panel-editor" style={{ flex: 1 }}>
            {editorMode === "source" ? (
              <MonacoEditor
                value={content}
                onChange={setContent}
                editorRef={editorRef}
              />
            ) : (
              <IntentTextEditor
                value={content}
                onChange={setContent}
                theme={theme}
                onThemeChange={setTheme}
              />
            )}
          </div>
        </div>

        <StatusBar
          blocks={docState.blocks}
          lines={docState.lines}
          keywords={docState.keywords}
          words={docState.words}
          errors={docState.errorCount}
          theme={theme}
          uiTheme={uiTheme}
          isUnsaved={isUnsaved}
          onToggleUiTheme={() =>
            setUiTheme((t) => (t === "dark" ? "light" : "dark"))
          }
          onErrorClick={() => {
            if (docState.firstErrorLine && editorRef.current) {
              editorRef.current.revealLineInCenter(docState.firstErrorLine);
              editorRef.current.setPosition({
                lineNumber: docState.firstErrorLine,
                column: 1,
              });
            }
          }}
        />
      </div>

      {/* Modals */}
      {modal === "trust" && (
        <div
          className="modal-backdrop modal-backdrop--top"
          onClick={() => setModal(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <TrustPanel
              trust={trustState.trust}
              isTemplate={trustState.isTemplate}
              onTrack={trustState.startTracking}
              onApprove={trustState.addApproval}
              onSign={trustState.addSignature}
              onSeal={trustState.seal}
              onVerify={trustState.verify}
              onAmend={trustState.addAmendment}
            />
            <button
              className="btn-secondary"
              style={{ margin: "8px 16px 16px" }}
              onClick={() => setModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {modal === "template" && (
        <div
          className="modal-backdrop modal-backdrop--top"
          onClick={() => setModal(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <TemplatePanel
              content={content}
              theme={theme}
              filename={filename}
              onInsert={insertAtCaret}
            />
            <button
              className="btn-secondary"
              style={{ margin: "8px 16px 16px" }}
              onClick={() => setModal(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {modal === "seal" && (
        <SealModal
          content={content}
          onApply={setContent}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "verify" && (
        <VerifyModal content={content} onClose={() => setModal(null)} />
      )}
      {modal === "history" && (
        <HistoryModal content={content} onClose={() => setModal(null)} />
      )}
      {modal === "amend" && (
        <AmendModal
          content={content}
          onApply={setContent}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "convert" && (
        <ConvertModal
          onApply={(text) => {
            setContent(text);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "help" && <HelpOverlay onClose={() => setModal(null)} />}
    </>
  );
}
