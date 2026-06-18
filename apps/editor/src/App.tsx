import { useState, useRef, useCallback, useEffect, useMemo, type ChangeEvent } from "react";
import {
  IntentTextEditor,
  FormFill,
  FormDesigner,
  Redline,
  BareView,
  DocumentView,
  SourcePanel,
  exportDocumentPDF,
  exportDocumentHTML,
  extractTemplateVariables,
} from "@dotit/editor";
import {
  isForm,
  hasTrackedChanges,
  compareVersions,
  verifyDocument,
  parseAndMerge,
  documentToSource,
  updateHistory,
} from "@dotit/core";
import { BLANK_DOC, FORM_STARTER, TEMPLATE_STARTER, buildPreviewData } from "./starters";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./status/StatusBar";
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
  const saveState = useAutoSave(content, filename);
  const docMeta = useDocumentMeta(content, setContent);
  const trustState = useTrustState(content, setContent);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("it-editor-theme") || "corporate",
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(() =>
    // Sanitize: a stale "source" from before Source mode was removed → "visual".
    localStorage.getItem("it-editor-mode") === "bare" ? "bare" : "visual",
  );
  // Document-type sub-modes: a FORM is either designed (edit its structure) or
  // filled (the recipient view); a TEMPLATE is either edited or previewed (merged
  // with sample data). Defaults match the common use: fill a form, edit a template.
  const [formView, setFormView] = useState<"design" | "fill">("fill");
  const [templateView, setTemplateView] = useState<"edit" | "preview">("edit");
  // Ribbon density (Ribbon vs Simple) — owned here so the toggle lives in the
  // single top title bar (the editor's built-in toggle is suppressed).
  const [ribbonMode, setRibbonMode] = useState<"ribbon" | "simple">(
    () =>
      (localStorage.getItem("dotit.ribbon.mode") as "ribbon" | "simple") ||
      "ribbon",
  );
  useEffect(() => {
    localStorage.setItem("dotit.ribbon.mode", ribbonMode);
  }, [ribbonMode]);
  // Live source side-panel: shows the raw .it in the empty margin beside the page,
  // on demand, so you can watch edits land in the source without leaving Visual mode.
  const [sourcePeek, setSourcePeek] = useState(false);
  // Change tracking for the title-bar chip. Dirty is reported by the editor itself
  // (doc-level: it reaches false when you undo back to the opened version — the
  // source byte-diff couldn't, because the bridge round-trip drifts the bytes). The
  // baseline (last clean content) is kept only for "Reset to original".
  const [editorDirty, setEditorDirty] = useState(false);
  const [baseline, setBaseline] = useState(content);
  useEffect(() => {
    if (!isUnsaved) setBaseline(content);
  }, [isUnsaved, content]);

  const templateVarCount = extractTemplateVariables(content).length;
  // Document type — drives the top-bar mode chip + sub-mode switch.
  const isFormDoc = useMemo(() => isForm(content), [content]);
  // A template (but not a form): has {{vars}} or meta type:template. Forms are
  // handled by their own design/fill switch, so exclude them here.
  const isTemplateDoc = useMemo(
    () => !isFormDoc && (trustState.isTemplate || templateVarCount > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFormDoc, trustState.isTemplate, content],
  );
  // Integrity verdict for the seal chip — only meaningful once sealed.
  const sealIntact = useMemo<boolean | null>(() => {
    if (!trustState.trust.isSealed) return null;
    try {
      return verifyDocument(content).intact;
    } catch {
      return null;
    }
  }, [content, trustState.trust.isSealed]);

  // Template Preview: merge the template with humanized sample data so it reads like
  // a finished document (the same merge engine production uses). Missing values keep
  // their {{placeholder}} so nothing silently disappears.
  const templatePreviewSource = useMemo(() => {
    if (!isTemplateDoc || templateView !== "preview") return content;
    try {
      const data = buildPreviewData(extractTemplateVariables(content));
      return documentToSource(parseAndMerge(content, data, { missing: "keep" }));
    } catch {
      return content;
    }
  }, [content, isTemplateDoc, templateView]);

  // File ▸ New ▸ {Document, Form, Template} — load a starter and route to the right
  // sub-mode (design a fresh form; edit a fresh template).
  const newDoc = useCallback(() => newFile(BLANK_DOC), [newFile]);
  const newForm = useCallback(() => {
    newFile(FORM_STARTER);
    setFormView("design");
    setEditorMode("visual");
  }, [newFile]);
  const newTemplate = useCallback(() => {
    newFile(TEMPLATE_STARTER);
    setTemplateView("edit");
    setEditorMode("visual");
  }, [newFile]);

  // Version history: a checkpoint baseline (the last recorded version). "Save
  // version" records the content changes since this baseline into the doc's
  // history: section, attributed to the author, then opens the History view.
  const historyBaseline = useRef(content);
  useEffect(() => {
    // A freshly opened/created file starts a new history baseline.
    historyBaseline.current = content;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename]);
  const saveVersion = useCallback(() => {
    const author = localStorage.getItem("it-author") || "Editor";
    try {
      const updated = updateHistory(historyBaseline.current, content, {
        by: author,
      });
      setContent(updated);
      historyBaseline.current = updated;
      setModal("history");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [content, setContent]);

  useEffect(() => {
    localStorage.setItem("it-editor-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("it-editor-mode", editorMode);
  }, [editorMode]);
  // Documents are light paper — the app stays in light mode (no dark theme), so
  // neither the canvas nor the bare view ever renders dark.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

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

  // Insert text at the caret of the visual editor (it owns the TipTap instance
  // and listens for this event).
  const insertAtCaret = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent("it-insert-text", { detail: text }));
  }, []);

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
        newFile(BLANK_DOC);
      } else if (mod && e.shiftKey && e.key === "V") {
        e.preventDefault();
        setModal("verify");
      } else if (mod && (e.key === "p" || e.key === "P")) {
        // The visual editor intercepts ⌘P itself; in Bare mode (no editor mounted)
        // we must intercept here too, or the browser prints the whole app page.
        if (editorMode === "bare") {
          e.preventDefault();
          exportDocumentPDF(content, theme, "normal", true);
        }
      } else if (e.key === "Escape") {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, openFile, newFile, editorMode, content, theme]);

  // Compare versions: pick an OLDER .it, then show what changed (this doc vs it) as
  // a redline. compareVersions emits a tracked-changes .it, so setting it as the
  // content drops straight into the existing <Redline> review surface — Accept all
  // keeps this version, Reject all reverts to the older one.
  const compareInputRef = useRef<HTMLInputElement>(null);
  const onComparePick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ""; // allow re-picking the same file
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const older = reader.result as string;
        setContent(compareVersions(older, content));
        setFilename(`compare — ${file.name} ↔ ${filename}`);
      };
      reader.readAsText(file);
    },
    [content, filename, setContent, setFilename],
  );

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
      <input
        ref={compareInputRef}
        type="file"
        accept=".it,text/plain"
        style={{ display: "none" }}
        onChange={onComparePick}
      />
      <div className="app-shell">
        <Toolbar
          filename={filename}
          onFilenameChange={setFilename}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          theme={theme}
          onThemeChange={setTheme}
          onNew={newDoc}
          onNewForm={newForm}
          onNewTemplate={newTemplate}
          onOpen={openFile}
          onSave={saveFile}
          onCompare={() => compareInputRef.current?.click()}
          onSaveVersion={saveVersion}
          onModal={setModal}
          onExportPDF={() =>
            exportDocumentPDF(content, theme, "normal", editorMode === "bare")
          }
          onExportHTML={() => exportDocumentHTML(content, theme)}
          isSealed={trustState.trust.isSealed}
          isTemplate={trustState.isTemplate}
          isTemplateDoc={isTemplateDoc}
          isForm={isFormDoc}
          formView={formView}
          onFormViewChange={setFormView}
          templateView={templateView}
          onTemplateViewChange={setTemplateView}
          trust={trustState.trust}
          sealIntact={sealIntact}
          source={content}
          onSourceChange={setContent}
          ribbonMode={ribbonMode}
          onRibbonModeChange={setRibbonMode}
          sourcePeek={sourcePeek}
          onToggleSourcePeek={() => setSourcePeek((v) => !v)}
          changeDirty={editorDirty}
          onUndo={() => window.dispatchEvent(new CustomEvent("it-editor-undo"))}
          onRedo={() => window.dispatchEvent(new CustomEvent("it-editor-redo"))}
          onResetChanges={() => setContent(baseline)}
          templateVarCount={templateVarCount}
          samples={DEMO_DOCS.map((d) => ({ id: d.id, title: d.title }))}
          onLoadSample={(id) => {
            const doc = getDemoDocById(id);
            if (doc) loadDemoDoc(doc);
          }}
        />

        <div className="panels" style={{ flex: 1 }}>
          <div className="panel-editor" style={{ flex: 1 }}>
            {editorMode === "bare" ? (
              // The document "as signed" — content + emphasis only, no decoration.
              <BareView value={content} theme={theme} />
            ) : isFormDoc && formView === "design" ? (
              // DESIGN a form — a dedicated VISUAL builder (separate from the main
              // editor): fields shown as real boxes, edited/reordered/resized in place.
              <FormDesigner value={content} onChange={setContent} />
            ) : isFormDoc ? (
              // FILL a form — the recipient experience (same FormFill the desktop
              // and embedded hosts use).
              <FormFill value={content} theme={theme} onChange={setContent} />
            ) : isTemplateDoc && templateView === "preview" ? (
              // PREVIEW a template — merged with sample data, read-only, exactly as
              // it will print. Edit mode falls through to the editor.
              <DocumentView value={templatePreviewSource} theme={theme} />
            ) : hasTrackedChanges(content) ? (
              // A document with pending redlines opens in REVIEW mode: the changes
              // are visible and the panel offers accept/reject. Once all are
              // resolved it reverts to the normal editor (and becomes sealable).
              <Redline value={content} theme={theme} onChange={setContent} />
            ) : (
              <IntentTextEditor
                // Remount on a fresh document (open/new/sample/reload) so the
                // undo history starts empty — no stale steps carried across files.
                key={filename || "untitled"}
                value={content}
                onChange={setContent}
                theme={theme}
                onThemeChange={setTheme}
                // Web app owns theme in its always-visible title bar → hide the
                // ribbon's duplicate. Embedded/desktop hosts keep it (default true).
                showThemePicker={false}
                showTrustBanner={false}
                showChangeIndicator={false}
                onChangeState={setEditorDirty}
                ribbonMode={ribbonMode}
                onRibbonModeChange={setRibbonMode}
              />
            )}
          </div>
          {sourcePeek && (
            <SourcePanel
              source={content}
              onChange={setContent}
              onClose={() => setSourcePeek(false)}
            />
          )}
        </div>

        <StatusBar
          blocks={docState.blocks}
          lines={docState.lines}
          keywords={docState.keywords}
          words={docState.words}
          errors={docState.errorCount}
          theme={theme}
          saveState={saveState}
          onErrorClick={() => {
            // The error is in the source — open the editable source panel to it.
            if (docState.errorCount > 0) setSourcePeek(true);
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
