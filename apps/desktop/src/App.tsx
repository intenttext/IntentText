import { useState, useRef, useCallback, useEffect } from "react";
import { Toolbar } from "./toolbar/Toolbar";
import { StatusBar } from "./status/StatusBar";
import { MonacoEditor } from "./editor/MonacoEditor";
import { VisualEditor } from "./visual/VisualEditor";
import { Preview } from "./preview/Preview";
import { Sidebar } from "./sidebar/Sidebar";
import { SealModal } from "./modals/SealModal";
import { VerifyModal } from "./modals/VerifyModal";
import { HistoryModal } from "./modals/HistoryModal";
import { AmendModal } from "./modals/AmendModal";
import { ConvertModal } from "./modals/ConvertModal";
import { HelpOverlay } from "./modals/HelpOverlay";
import { useWorkspace } from "./hooks/useWorkspace";
import { useFile } from "./hooks/useFile";
import { useAutoSave } from "./hooks/useAutoSave";
import { useDocument } from "./hooks/useDocument";
import { useTrustState } from "./hooks/useTrustState";
import { SearchShowcasePanel } from "./showcase/SearchShowcasePanel";
import { TrustShowcasePanel } from "./showcase/TrustShowcasePanel";
import { WorkflowShowcasePanel } from "./showcase/WorkflowShowcasePanel";
import { FirstRunGuide } from "./showcase/FirstRunGuide";
import {
  DEMO_DOCS,
  DEFAULT_DEMO_DOC_ID,
  getDemoDocById,
  type DemoDoc,
} from "./showcase/demoVault";
import type * as monaco from "monaco-editor";
import type { EditorMode } from "./visual/types";

const WELCOME = `// Welcome to Dotit Desktop
// Open a folder (Cmd+Shift+O) or a file (Cmd+O) to begin.

title: My First Document
summary: A document written in Dotit

section: Getting Started
note: Every line in Dotit starts with a keyword.
note: The preview on the right updates as you type.
tip: Try changing the theme using the Theme picker above.

section: Learn More
link: Documentation | to: https://itdocs.vercel.app
link: Browse Templates | to: https://intenttext-hub.vercel.app
link: GitHub | to: https://github.com/intenttext/IntentText
`;

export type LayoutMode = "split" | "editor" | "preview";
export type EditorThemeMode = "dark" | "light";
type ShowcaseMode = "search" | "trust" | "workflow";
export type ModalType =
  | "seal"
  | "verify"
  | "history"
  | "amend"
  | "convert"
  | "help"
  | null;

export default function App() {
  const [state, actions] = useWorkspace();
  const { content, setContent, filename, setFilename, isUnsaved, markSaved } =
    state;

  const docState = useDocument(content);
  const trustState = useTrustState(content, setContent);
  const { openFile, saveFile, newFile } = useFile(
    state,
    actions.openFileByPath,
  );
  const { hasRestore, restore, dismiss } = useAutoSave(content, setContent);

  const [layout, setLayout] = useState<LayoutMode>("split");
  const [theme, setTheme] = useState(
    () => localStorage.getItem("it-editor-theme") || "corporate",
  );
  const [editorTheme, setEditorTheme] = useState<EditorThemeMode>(
    () =>
      (localStorage.getItem("it-editor-color") as EditorThemeMode) || "light",
  );
  const [modal, setModal] = useState<ModalType>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(
    () => (localStorage.getItem("it-editor-mode") as EditorMode) || "visual",
  );
  const [showcaseMode, setShowcaseMode] = useState<ShowcaseMode>("search");
  const [trustShowcaseDocId, setTrustShowcaseDocId] =
    useState("service-agreement");
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [dividerPos, setDividerPos] = useState(50);
  const [sidebarVisible, setSidebarVisible] = useState(
    () => localStorage.getItem("it-sidebar-visible") !== "false",
  );
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const panelsRef = useRef<HTMLDivElement>(null);

  // Persist theme choices
  useEffect(() => {
    localStorage.setItem("it-editor-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("it-editor-color", editorTheme);
    document.documentElement.setAttribute("data-theme", editorTheme);
  }, [editorTheme]);
  useEffect(() => {
    localStorage.setItem("it-sidebar-visible", String(sidebarVisible));
  }, [sidebarVisible]);
  useEffect(() => {
    localStorage.setItem("it-editor-mode", editorMode);
  }, [editorMode]);

  // Set initial content
  useEffect(() => {
    if (!content && !hasRestore) {
      const defaultDoc = getDemoDocById(DEFAULT_DEMO_DOC_ID);
      setContent(defaultDoc?.source || WELCOME);
      setFilename(defaultDoc ? `${defaultDoc.id}.it` : "untitled.it");
      markSaved();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const seen = localStorage.getItem("it-desktop-showcase-onboarded") === "1";
    if (!seen) {
      setShowFirstRunGuide(true);
    }
  }, []);

  // Update window title
  useEffect(() => {
    const parts = ["Dotit"];
    if (filename) parts.push(filename);
    if (state.folderName) parts.push(state.folderName);
    document.title = parts.join(" — ");
  }, [filename, state.folderName]);

  const loadDemoDoc = useCallback(
    (doc: DemoDoc) => {
      setContent(doc.source);
      setFilename(`${doc.id}.it`);
      markSaved();
      setShowFirstRunGuide(false);
      localStorage.setItem("it-desktop-showcase-onboarded", "1");
    },
    [setContent, setFilename, markSaved],
  );

  const loadTrustDocById = useCallback(
    (docId: string) => {
      const doc = getDemoDocById(docId);
      if (!doc) return;
      setTrustShowcaseDocId(docId);
      loadDemoDoc(doc);
    },
    [loadDemoDoc],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      } else if (mod && e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        openFile();
      } else if (mod && e.shiftKey && e.key === "O") {
        e.preventDefault();
        actions.openFolder();
      } else if (mod && e.key === "n") {
        e.preventDefault();
        newFile(WELCOME);
      } else if (mod && e.key === "b") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (mod && e.key === "w") {
        e.preventDefault();
        newFile(WELCOME);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        if (e.shiftKey) {
          setLayout("preview");
        } else {
          setLayout((l) => (l === "split" ? "editor" : "split"));
        }
      } else if (mod && e.shiftKey && e.key === "V") {
        e.preventDefault();
        setModal("verify");
      } else if (e.key === "Escape") {
        setModal(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveFile, openFile, newFile, actions]);

  // Divider drag
  const onDividerDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const panels = panelsRef.current;
      if (!panels) return;
      const startX = e.clientX;
      const startPos = dividerPos;
      const rect = panels.getBoundingClientRect();
      const divEl = e.currentTarget as HTMLElement;
      divEl.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const pct = startPos + (dx / rect.width) * 100;
        setDividerPos(Math.max(20, Math.min(80, pct)));
      };
      const onUp = () => {
        divEl.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dividerPos],
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

  const showEditor = layout !== "preview";
  const showPreview = layout !== "editor";

  return (
    <div className="desktop-layout">
      {/* Titlebar overlay region */}
      <div className="titlebar-region" data-tauri-drag-region />

      {hasRestore && (
        <div className="restore-banner">
          <span>Unsaved session found. Restore previous work?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={restore}>
              Restore
            </button>
            <button className="btn-secondary" onClick={dismiss}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <Toolbar
        filename={filename}
        onFilenameChange={setFilename}
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        layout={layout}
        onLayoutChange={setLayout}
        theme={theme}
        onThemeChange={setTheme}
        onNew={() => newFile(WELCOME)}
        onOpen={openFile}
        onOpenFolder={actions.openFolder}
        onSave={saveFile}
        onModal={setModal}
        content={content}
        onContentChange={setContent}
      />

      <div className="main-area">
        <Sidebar
          visible={sidebarVisible}
          files={state.files}
          activeFilePath={state.activeFilePath}
          folderPath={state.folderPath}
          folderName={state.folderName}
          isFileUnsaved={isUnsaved}
          onFileOpen={actions.openFileByPath}
          onRefresh={actions.refreshFiles}
        />

        <div className="panels" ref={panelsRef}>
          {showEditor && (
            <div
              className="panel-editor"
              style={
                layout === "split" ? { flex: `0 0 ${dividerPos}%` } : undefined
              }
            >
              {editorMode === "source" ? (
                <MonacoEditor
                  value={content}
                  onChange={setContent}
                  editorRef={editorRef}
                  editorTheme={editorTheme}
                />
              ) : (
                <VisualEditor
                  value={content}
                  onChange={setContent}
                  theme={theme}
                />
              )}
            </div>
          )}

          {layout === "split" && (
            <div className="panel-divider" onMouseDown={onDividerDown} />
          )}

          {showPreview && (
            <div
              className="panel-preview"
              style={
                layout === "split"
                  ? { flex: `0 0 ${100 - dividerPos}%` }
                  : undefined
              }
            >
              <Preview
                content={content}
                theme={theme}
                errors={docState.errors}
              />
            </div>
          )}

          {showcaseMode === "search" && (
            <SearchShowcasePanel
              mode={showcaseMode}
              onModeChange={setShowcaseMode}
              activeTitle={filename}
              folderPath={state.folderPath}
              activeFilePath={state.activeFilePath}
              onFileOpen={actions.openFileByPath}
              onLoadDemo={loadDemoDoc}
            />
          )}
          {showcaseMode === "trust" && (
            <TrustShowcasePanel
              mode={showcaseMode}
              onModeChange={setShowcaseMode}
              trust={trustState.trust}
              demoDocs={DEMO_DOCS}
              activeDocId={trustShowcaseDocId}
              onSelectDoc={loadTrustDocById}
              content={content}
              onContentChange={setContent}
              onTrack={trustState.startTracking}
              onApprove={trustState.addApproval}
              onSign={trustState.addSignature}
              onSeal={trustState.seal}
              onVerify={trustState.verify}
              onAmend={trustState.addAmendment}
            />
          )}
          {showcaseMode === "workflow" && (
            <WorkflowShowcasePanel
              content={content}
              mode={showcaseMode}
              onModeChange={setShowcaseMode}
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
        mainFolderPath={state.folderPath}
        isUnsaved={isUnsaved}
        editorTheme={editorTheme}
        onToggleEditorTheme={() =>
          setEditorTheme((t) => (t === "dark" ? "light" : "dark"))
        }
        onChangeMainFolder={actions.openFolder}
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

      {/* Modals */}
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

      {showFirstRunGuide && (
        <FirstRunGuide
          docs={DEMO_DOCS}
          mainFolderPath={state.folderPath}
          onChangeMainFolder={actions.openFolder}
          onPick={loadDemoDoc}
          onClose={() => {
            setShowFirstRunGuide(false);
            localStorage.setItem("it-desktop-showcase-onboarded", "1");
          }}
        />
      )}
    </div>
  );
}
