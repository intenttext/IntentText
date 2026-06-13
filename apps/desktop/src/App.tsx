// Dotit Desktop — enterprise document manager for .it files.
//
// Shell layout: native menu bar (Tauri) + library/search sidebar + the
// embeddable @dotit/editor WYSIWYG canvas + status bar. The desktop app owns
// files, search and trust flows; all editor chrome comes from the package.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  IntentTextEditor,
  exportDocumentHTML,
  exportDocumentPDF,
} from "@dotit/editor";
import type { TrustAction } from "@dotit/editor";
import {
  FileText,
  FolderOpen,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

import { isTauri } from "./lib/backend";
import { installAppMenu } from "./lib/menu";
import type { MenuActions } from "./lib/menu";
import * as trustOps from "./lib/trust";
import { useWorkspace } from "./hooks/useWorkspace";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { useTrustBadges } from "./hooks/useTrustBadges";
import { LibraryPanel } from "./components/LibraryPanel";
import { SearchPanel } from "./components/SearchPanel";
import { StatusBar } from "./components/StatusBar";
import { TrustDialogs } from "./components/TrustDialogs";
import type { TrustDialogKind } from "./components/TrustDialogs";

type SidebarTab = "library" | "search";

export default function App() {
  const workspaceApi = useWorkspace();
  const { workspace } = workspaceApi;

  const docApi = useOpenDocument({
    defaultDir: workspace?.path ?? null,
    onSaved: () => workspaceApi.refresh(),
  });
  const { doc } = docApi;

  const [sidebarVisible, setSidebarVisible] = useState(
    () => localStorage.getItem("dotit.ui.sidebar") !== "0",
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("library");
  const [sourceView, setSourceView] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("dotit.doc.theme") ?? "corporate",
  );
  const [trustDialog, setTrustDialog] = useState<TrustDialogKind>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const badges = useTrustBadges(
    workspace?.itFiles ?? [],
    workspaceApi.revision,
  );

  useEffect(() => {
    localStorage.setItem("dotit.ui.sidebar", sidebarVisible ? "1" : "0");
  }, [sidebarVisible]);
  useEffect(() => {
    localStorage.setItem("dotit.doc.theme", theme);
  }, [theme]);

  const openFile = useCallback(
    async (path: string) => {
      try {
        await docApi.openPath(path);
        workspaceApi.noteRecent(path);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [docApi, workspaceApi],
  );

  const openFileViaDialog = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "IntentText", extensions: ["it"] }],
    });
    if (typeof selected === "string") await openFile(selected);
  }, [openFile]);

  const focusSearch = useCallback(() => {
    setSidebarVisible(true);
    setSidebarTab("search");
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  // ----- native menu (always sees latest state through the ref) -----
  const actionsRef = useRef<MenuActions>(null!);
  actionsRef.current = {
    newDocument: () => void docApi.newDocument(),
    openFile: () => void openFileViaDialog(),
    openWorkspace: () => void workspaceApi.chooseWorkspace(),
    save: () => void docApi.save(),
    saveAs: () => void docApi.saveAs(),
    exportPDF: () => {
      if (doc) exportDocumentPDF(doc.content, theme);
    },
    exportHTML: () => {
      if (doc) exportDocumentHTML(doc.content, theme);
    },
    toggleSidebar: () => setSidebarVisible((v) => !v),
    toggleSourceView: () => setSourceView((v) => !v),
    focusSearch,
    trustSeal: () => doc && setTrustDialog("seal"),
    trustSign: () => doc && setTrustDialog("sign"),
    trustApprove: () => doc && setTrustDialog("approve"),
    trustTrack: () => {
      if (doc) void docApi.applyAndSave(trustOps.startTracking(doc.content));
    },
    trustVerify: () => doc && setTrustDialog("verify"),
  };

  useEffect(() => {
    installAppMenu(() => actionsRef.current).catch((err) =>
      console.warn("App menu unavailable:", err),
    );
  }, []);

  // ----- native window title: filename + dirty dot -----
  useEffect(() => {
    const title = doc
      ? `${doc.dirty ? "• " : ""}${doc.name} — Dotit`
      : workspace
        ? `${workspace.name} — Dotit`
        : "Dotit";
    document.title = title;
    if (isTauri) getCurrentWindow().setTitle(title).catch(() => {});
  }, [doc, doc?.name, doc?.dirty, workspace]);

  // ----- file association: .it opened from the OS -----
  useEffect(() => {
    if (!isTauri) return;
    const un = listen<string>("open-file", (e) => void openFile(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, [openFile]);

  // ----- keyboard fallbacks (menu accelerators cover the Tauri shell) -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        void docApi.save();
      } else if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        focusSearch();
      } else if (key === "e" && !e.shiftKey) {
        e.preventDefault();
        setSourceView((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [docApi, focusSearch]);

  const onTrustAction = useCallback((action: TrustAction) => {
    setTrustDialog(action);
  }, []);

  const editorPane = useMemo(() => {
    if (!doc) return null;
    if (sourceView) {
      return (
        <textarea
          className="source-view"
          spellCheck={false}
          value={doc.content}
          onChange={(e) => docApi.setContent(e.target.value)}
        />
      );
    }
    return (
      <IntentTextEditor
        value={doc.content}
        onChange={docApi.setContent}
        theme={theme}
        onThemeChange={setTheme}
        onTrustAction={onTrustAction}
      />
    );
  }, [doc, sourceView, theme, docApi, onTrustAction]);

  return (
    <div className="app">
      <header className="topbar" data-tauri-drag-region>
        <div className="topbar-left" data-tauri-drag-region>
          <button
            className="icon-btn"
            title="Toggle library (⌘B)"
            onClick={() => setSidebarVisible((v) => !v)}
          >
            {sidebarVisible ? (
              <PanelLeftClose size={16} />
            ) : (
              <PanelLeftOpen size={16} />
            )}
          </button>
        </div>
        <div className="topbar-title" data-tauri-drag-region>
          {doc ? (
            <>
              <FileText size={13} />
              <span>{doc.name}</span>
              {doc.dirty && <span className="dirty-dot">•</span>}
            </>
          ) : (
            <span className="muted">Dotit</span>
          )}
        </div>
        <div className="topbar-right" data-tauri-drag-region />
      </header>

      <div className="body">
        {sidebarVisible && (
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab${sidebarTab === "library" ? " active" : ""}`}
                onClick={() => setSidebarTab("library")}
              >
                <Library size={14} /> Library
              </button>
              <button
                className={`sidebar-tab${sidebarTab === "search" ? " active" : ""}`}
                onClick={() => setSidebarTab("search")}
              >
                <Search size={14} /> Search
              </button>
            </div>
            {sidebarTab === "library" ? (
              <LibraryPanel
                api={workspaceApi}
                badges={badges}
                activePath={doc?.path ?? null}
                dirty={doc?.dirty ?? false}
                onOpenFile={(p) => void openFile(p)}
              />
            ) : (
              <SearchPanel
                ref={searchInputRef}
                workspace={workspace}
                onOpenFile={(p) => void openFile(p)}
              />
            )}
          </aside>
        )}

        <main className="main">
          {doc ? (
            editorPane
          ) : (
            <div className="empty-state">
              <h1>Dotit</h1>
              <p>Manage, search, and seal your .it documents.</p>
              <div className="empty-actions">
                <button
                  className="btn primary"
                  onClick={() => workspaceApi.chooseWorkspace()}
                >
                  <FolderOpen size={15} /> Open Workspace…
                </button>
                <button className="btn" onClick={() => docApi.newDocument()}>
                  New Document
                </button>
                <button className="btn" onClick={() => openFileViaDialog()}>
                  Open File…
                </button>
              </div>
              {workspaceApi.recentFiles.length > 0 && (
                <div className="empty-recents">
                  <div className="panel-subtitle">Recent</div>
                  {workspaceApi.recentFiles.slice(0, 6).map((p) => (
                    <button
                      key={p}
                      className="link"
                      onClick={() => void openFile(p)}
                      title={p}
                    >
                      {p.split("/").pop()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <StatusBar
        workspace={workspace}
        doc={doc}
        onChooseWorkspace={() => workspaceApi.chooseWorkspace()}
      />

      {doc && (
        <TrustDialogs
          kind={trustDialog}
          content={doc.content}
          onApply={(next) => docApi.applyAndSave(next)}
          onClose={() => setTrustDialog(null)}
        />
      )}
    </div>
  );
}
