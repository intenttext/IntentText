// Dotit Desktop — native document manager for .it files.
//
// The product goal: click a .it file and it opens like a PDF — a clean,
// read-only paper page you trust. An Edit button switches to the @dotit/editor.
// A multi-vault registry (DEVONthink-style) indexes folders of .it files
// scattered across the machine and federates search across all of them.
//
// Shell: native Tauri menu + a Finder-style vault sidebar (All Files + each
// registered folder + Add Folder) + the document viewer/editor + status bar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog, ask } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  IntentTextEditor,
  exportDocumentHTML,
  exportDocumentPDF,
} from "@dotit/editor";
import type { TrustAction } from "@dotit/editor";
import {
  BadgeCheck,
  Code2,
  Download,
  FileText,
  FolderPlus,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenLine,
  Search,
  Unlock,
} from "lucide-react";

import { isTauri } from "./lib/backend";
import { installAppMenu } from "./lib/menu";
import type { MenuActions } from "./lib/menu";
import * as trustOps from "./lib/trust";
import { evaluateTrust } from "./lib/trust-status";
import { TrustBadge, TrustPanel } from "./components/TrustBadge";
import { useVaults } from "./hooks/useVaults";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { useTrustBadges } from "./hooks/useTrustBadges";
import { VaultSidebar } from "./components/VaultSidebar";
import { SearchPanel } from "./components/SearchPanel";
import { StatusBar } from "./components/StatusBar";
import { TrustDialogs } from "./components/TrustDialogs";
import type { TrustDialogKind } from "./components/TrustDialogs";

type SidebarTab = "library" | "search";
type DocMode = "view" | "edit";

export default function App() {
  const vaultsApi = useVaults();

  const docApi = useOpenDocument({
    defaultDir: vaultsApi.activeVault?.path ?? null,
    onSaved: () => {
      const v = vaultsApi.activeVault;
      if (v) void vaultsApi.refreshVault(v.path);
    },
  });
  const { doc } = docApi;

  const [sidebarVisible, setSidebarVisible] = useState(
    () => localStorage.getItem("dotit.ui.sidebar") !== "0",
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("library");
  const [mode, setMode] = useState<DocMode>("view");
  const [sourceView, setSourceView] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("dotit.doc.theme") ?? "corporate",
  );
  const [trustDialog, setTrustDialog] = useState<TrustDialogKind>(null);
  const [trustPanelOpen, setTrustPanelOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live trust status — recomputed from the CURRENT content on every render, so
  // the header badge updates the instant the document changes (editing a signed
  // doc flips it to "Signature broken" with no dialog).
  const trustStatus = useMemo(
    () => (doc ? evaluateTrust(doc.content) : null),
    [doc?.content],
  );

  // Signature count at the moment the document was opened — used to detect
  // whether a SAVE would persist a doc whose signatures we just broke by editing.
  const openedValidSigs = useRef(0);

  const badges = useTrustBadges(vaultsApi.allFiles, vaultsApi.revision);

  useEffect(() => {
    localStorage.setItem("dotit.ui.sidebar", sidebarVisible ? "1" : "0");
  }, [sidebarVisible]);
  useEffect(() => {
    localStorage.setItem("dotit.doc.theme", theme);
  }, [theme]);

  // A freshly opened/created doc always starts in the read-only viewer.
  const docIsSealed = useMemo(
    () => (doc ? trustOps.sealed(doc.content) : false),
    [doc?.content],
  );

  const openFile = useCallback(
    async (path: string) => {
      try {
        await docApi.openPath(path);
        vaultsApi.noteRecent(path);
        setMode("view");
        setSourceView(false);
        setTrustPanelOpen(false);
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [docApi, vaultsApi],
  );

  // Snapshot how many signatures verified at open-time. We only warn on save
  // when editing has since BROKEN signatures that were valid when we opened.
  useEffect(() => {
    if (!doc) return;
    openedValidSigs.current = evaluateTrust(doc.content).validSignatureCount;
    // Only recompute the baseline when the open file changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.path]);

  // Save, but for a SIGNED (unsealed) doc whose signatures were valid at open
  // and are now broken by editing, confirm once before persisting. No nagging
  // during typing — just this single gate at save time.
  const guardedSave = useCallback(async () => {
    if (!doc) return;
    const status = evaluateTrust(doc.content);
    const brokeSigs =
      !status.sealed &&
      openedValidSigs.current > 0 &&
      status.validSignatureCount < openedValidSigs.current;
    if (brokeSigs) {
      const n = openedValidSigs.current - status.validSignatureCount;
      const ok = await ask(
        `Saving will invalidate ${n} signature${n === 1 ? "" : "s"}. Save anyway?`,
        { title: "Signatures will break", kind: "warning" },
      );
      if (!ok) return;
    }
    await docApi.save();
    openedValidSigs.current = evaluateTrust(doc.content).validSignatureCount;
  }, [doc, docApi]);

  const newDocument = useCallback(async () => {
    await docApi.newDocument();
    setMode("edit"); // a blank doc opens straight into editing
    setSourceView(false);
  }, [docApi]);

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

  const toggleEdit = useCallback(() => {
    if (!doc) return;
    // Sealed documents are read-only; never drop into edit mode.
    if (trustOps.sealed(doc.content)) {
      setMode("view");
      return;
    }
    setMode((m) => (m === "view" ? "edit" : "view"));
  }, [doc]);

  // ----- native menu (always sees latest state through the ref) -----
  const actionsRef = useRef<MenuActions>(null!);
  actionsRef.current = {
    newDocument: () => void newDocument(),
    openFile: () => void openFileViaDialog(),
    addFolder: () => void vaultsApi.addFolder(),
    save: () => void guardedSave(),
    saveAs: () => void docApi.saveAs(),
    exportPDF: () => {
      if (doc) exportDocumentPDF(doc.content, theme);
    },
    exportHTML: () => {
      if (doc) exportDocumentHTML(doc.content, theme);
    },
    toggleSidebar: () => setSidebarVisible((v) => !v),
    toggleEdit,
    toggleSourceView: () => {
      setMode("edit");
      setSourceView((v) => !v);
    },
    focusSearch,
    trustSeal: () => doc && setTrustDialog("seal"),
    trustSign: () => doc && setTrustDialog("sign"),
    trustApprove: () => doc && setTrustDialog("approve"),
    trustTrack: () => {
      if (doc) void docApi.applyAndSave(trustOps.startTracking(doc.content));
    },
    trustUnseal: () => {
      if (doc && trustOps.sealed(doc.content)) {
        void docApi.applyAndSave(trustOps.unseal(doc.content));
      }
    },
    trustVerify: () => doc && setTrustPanelOpen(true),
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
      : "Dotit";
    document.title = title;
    if (isTauri) getCurrentWindow().setTitle(title).catch(() => {});
  }, [doc, doc?.name, doc?.dirty]);

  // ----- file association: .it opened from the OS -----
  useEffect(() => {
    if (!isTauri) return;
    // Cold start (the app was launched BY double-clicking a file): drain the
    // path the OS handed us. This is the fix for "opens blank, have to open it
    // again" — the launch event used to fire before this listener existed.
    invoke<string | null>("take_pending_open")
      .then((p) => {
        if (p) void openFile(p);
      })
      .catch(() => {});
    // Warm start (app already running, OS sends another file): live event.
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
        void guardedSave();
      } else if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        focusSearch();
      } else if (key === "e" && e.shiftKey) {
        e.preventDefault();
        setMode("edit");
        setSourceView((v) => !v);
      } else if (key === "e" && !e.shiftKey) {
        e.preventDefault();
        toggleEdit();
      } else if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        if (doc) exportDocumentPDF(doc.content, theme);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [docApi, focusSearch, toggleEdit, doc, theme, guardedSave]);

  const onTrustAction = useCallback((action: TrustAction) => {
    if (action === "verify") {
      setTrustPanelOpen(true);
      return;
    }
    setTrustDialog(action);
  }, []);

  const scopeLabel =
    vaultsApi.scope === "all"
      ? "All Files"
      : (vaultsApi.activeVault?.label ?? "Library");
  const docCount =
    vaultsApi.scope === "all"
      ? vaultsApi.allFiles.length
      : (vaultsApi.activeVault?.itFiles.length ?? 0);

  const mainPane = useMemo(() => {
    if (!doc) return null;
    if (sourceView && mode === "edit") {
      return (
        <textarea
          className="source-view"
          spellCheck={false}
          value={doc.content}
          onChange={(e) => docApi.setContent(e.target.value)}
        />
      );
    }
    // View and Edit render with the SAME engine (@dotit/editor) so the page
    // layout, pagination, and spacing are byte-identical between modes — only
    // editing and the ribbon toggle. View = read-only, no ribbon (a clean
    // paginated "reading" view); Edit = full editor.
    return (
      <IntentTextEditor
        value={doc.content}
        onChange={docApi.setContent}
        theme={theme}
        onThemeChange={setTheme}
        onTrustAction={onTrustAction}
        readOnly={mode === "view"}
        showRibbon={mode === "edit"}
        showTrustBanner={false}
      />
    );
  }, [doc, mode, sourceView, theme, docApi, onTrustAction]);

  return (
    <div className="app">
      <header className="topbar" data-tauri-drag-region>
        <div className="topbar-left" data-tauri-drag-region>
          <button
            className="icon-btn"
            title="Toggle sidebar (⌘B)"
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
              <span>{doc.name.replace(/\.it$/i, "")}</span>
              {doc.dirty && <span className="dirty-dot">•</span>}
              {docIsSealed && (
                <Lock size={12} className="trust-icon trust-sealed" />
              )}
            </>
          ) : (
            <span className="muted">Dotit</span>
          )}
        </div>
        <div className="topbar-right">
          {doc && trustStatus && (
            <div className="doc-actions">
              <div className="trust-widget">
                <TrustBadge
                  status={trustStatus}
                  open={trustPanelOpen}
                  onToggle={() => setTrustPanelOpen((v) => !v)}
                />
                {trustPanelOpen && (
                  <TrustPanel
                    status={trustStatus}
                    onClose={() => setTrustPanelOpen(false)}
                  />
                )}
              </div>
              <span className="topbar-divider" />
              {docIsSealed ? (
                <span className="sealed-pill" title="Sealed — read-only">
                  <Lock size={12} /> Read-only
                </span>
              ) : (
                <button
                  className={`pill-btn${mode === "edit" ? " active" : ""}`}
                  title="Edit / view (⌘E)"
                  onClick={toggleEdit}
                >
                  <Pencil size={13} /> {mode === "edit" ? "Done" : "Edit"}
                </button>
              )}
              {mode === "edit" && !docIsSealed && (
                <button
                  className={`icon-btn${sourceView ? " active" : ""}`}
                  title="Toggle source (⌘⇧E)"
                  onClick={() => setSourceView((v) => !v)}
                >
                  <Code2 size={15} />
                </button>
              )}
              <span className="topbar-divider" />
              <button
                className="icon-btn"
                title="Sign document"
                onClick={() => setTrustDialog("sign")}
              >
                <PenLine size={15} />
              </button>
              <button
                className="icon-btn"
                title="Approve document"
                onClick={() => setTrustDialog("approve")}
              >
                <BadgeCheck size={15} />
              </button>
              {docIsSealed ? (
                <button
                  className="icon-btn"
                  title="Unseal document"
                  onClick={() =>
                    void docApi.applyAndSave(trustOps.unseal(doc.content))
                  }
                >
                  <Unlock size={15} />
                </button>
              ) : (
                <button
                  className="icon-btn"
                  title="Seal document"
                  onClick={() => setTrustDialog("seal")}
                >
                  <Lock size={15} />
                </button>
              )}
              <span className="topbar-divider" />
              <button
                className="icon-btn"
                title="Export PDF (⌘P)"
                onClick={() => exportDocumentPDF(doc.content, theme)}
              >
                <Download size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="body">
        {sidebarVisible && (
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab${sidebarTab === "library" ? " active" : ""}`}
                onClick={() => setSidebarTab("library")}
              >
                Library
              </button>
              <button
                className={`sidebar-tab${sidebarTab === "search" ? " active" : ""}`}
                onClick={() => setSidebarTab("search")}
              >
                <Search size={13} /> Search
              </button>
            </div>
            {sidebarTab === "library" ? (
              <VaultSidebar
                api={vaultsApi}
                badges={badges}
                activePath={doc?.path ?? null}
                dirty={doc?.dirty ?? false}
                onOpenFile={(p) => void openFile(p)}
              />
            ) : (
              <SearchPanel
                ref={searchInputRef}
                api={vaultsApi}
                onOpenFile={(p) => void openFile(p)}
              />
            )}
          </aside>
        )}

        <main className={`main${doc && mode === "view" ? " main-viewer" : ""}`}>
          {doc ? (
            mainPane
          ) : (
            <div className="empty-state">
              <div className="empty-brand">.it</div>
              <h1>Dotit</h1>
              <p>
                A native home for your <code>.it</code> documents — register your
                folders, search across all of them, and open any file like a PDF.
              </p>
              <div className="empty-actions">
                <button
                  className="btn primary"
                  onClick={() => vaultsApi.addFolder()}
                >
                  <FolderPlus size={15} /> Add Folder…
                </button>
                <button className="btn" onClick={() => void newDocument()}>
                  New Document
                </button>
                <button className="btn" onClick={() => openFileViaDialog()}>
                  Open File…
                </button>
              </div>
              {vaultsApi.recentFiles.length > 0 && (
                <div className="empty-recents">
                  <div className="panel-subtitle">Recent</div>
                  {vaultsApi.recentFiles.slice(0, 6).map((p) => (
                    <button
                      key={p}
                      className="link"
                      onClick={() => void openFile(p)}
                      title={p}
                    >
                      {p.split("/").pop()?.replace(/\.it$/i, "")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <StatusBar
        scopeLabel={scopeLabel}
        docCount={docCount}
        doc={doc}
        mode={mode}
        onAddFolder={() => vaultsApi.addFolder()}
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
