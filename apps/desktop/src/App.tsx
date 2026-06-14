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
import { open as openDialog, ask } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { invoke } from "@tauri-apps/api/core";
import { IntentTextEditor } from "@dotit/editor";
import type { TrustAction } from "@dotit/editor";
import { isTemplate } from "@dotit/core";
import {
  BadgeCheck,
  Clock,
  Code2,
  ListTree,
  FileDown,
  FileText,
  FileType2,
  FileUp,
  FolderPlus,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PenLine,
  Printer,
  Search,
  Settings,
  Unlock,
} from "lucide-react";

import { isTauri, windowFile } from "./lib/backend";
import {
  printDocument,
  exportHTML,
  exportDOCX,
  importDOCX,
  importDOCXFromPath,
} from "./lib/export";
import { installAppMenu } from "./lib/menu";
import type { MenuActions } from "./lib/menu";
import * as trustOps from "./lib/trust";
import { evaluateTrust } from "./lib/trust-status";
import { TrustBadge, TrustPanel } from "./components/TrustBadge";
import { useVaults } from "./hooks/useVaults";
import { useSettings } from "./hooks/useSettings";
import { useOpenDocument } from "./hooks/useOpenDocument";
import { useTrustBadges } from "./hooks/useTrustBadges";
import { VaultSidebar } from "./components/VaultSidebar";
import { OutlinePanel, buildOutline } from "./components/OutlinePanel";
import { FindBar } from "./components/FindBar";
import { QuickOpen } from "./components/QuickOpen";
import { SearchPanel } from "./components/SearchPanel";
import { StatusBar } from "./components/StatusBar";
import { TrustDialogs } from "./components/TrustDialogs";
import type { TrustDialogKind } from "./components/TrustDialogs";
import {
  AboutDialog,
  PreferencesDialog,
  ShortcutsDialog,
} from "./components/AppDialogs";

type SidebarTab = "library" | "search";
type DocMode = "view" | "edit";

export default function App() {
  const vaultsApi = useVaults();
  const settingsApi = useSettings();
  const { settings } = settingsApi;

  const docApi = useOpenDocument({
    defaultDir: settings.defaultFolder || (vaultsApi.activeVault?.path ?? null),
    autosave: settings.autosave,
    defaultPageSize: settings.defaultPageSize,
    onSaved: () => {
      const v = vaultsApi.activeVault;
      if (v) void vaultsApi.refreshVault(v.path);
    },
  });
  const { doc } = docApi;

  const [sidebarVisible, setSidebarVisible] = useState(
    () => localStorage.getItem("dotit.ui.sidebar") !== "0",
  );
  const [leftPanel, setLeftPanel] = useState<"none" | "outline">("none");
  const [findOpen, setFindOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const hasOutline = useMemo(
    () => (doc ? buildOutline(doc.content).length > 1 : false),
    [doc],
  );
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("library");
  const [mode, setMode] = useState<DocMode>("view");
  const [sourceView, setSourceView] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("dotit.doc.theme") ?? "corporate",
  );
  const [trustDialog, setTrustDialog] = useState<TrustDialogKind>(null);
  const [trustPanelOpen, setTrustPanelOpen] = useState(false);
  const [appDialog, setAppDialog] = useState<
    "preferences" | "about" | "shortcuts" | null
  >(null);
  const [dragOver, setDragOver] = useState(false);
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
  // A template (.it blueprint) is outside the trust workflow — Sign/Approve/Seal
  // are disabled for it (the hash would cover placeholder text).
  const docIsTemplate = useMemo(
    () => (doc ? isTemplate(doc.content) : false),
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

  const importDocxFlow = useCallback(async () => {
    const imported = await importDOCX();
    if (!imported) return;
    await docApi.openSource(imported.source, imported.suggestedName);
    setMode("edit");
    setSourceView(false);
    setTrustPanelOpen(false);
  }, [docApi]);

  const importDocxFromPath = useCallback(
    async (path: string) => {
      const imported = await importDOCXFromPath(path);
      if (!imported) return;
      await docApi.openSource(imported.source, imported.suggestedName);
      setMode("edit");
      setSourceView(false);
      setTrustPanelOpen(false);
    },
    [docApi],
  );

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
    openRecent: (p) => void openFile(p),
    recentFiles: vaultsApi.recentFiles,
    clearRecent: () => vaultsApi.clearRecent(),
    openPreferences: () => setAppDialog("preferences"),
    showAbout: () => setAppDialog("about"),
    showShortcuts: () => setAppDialog("shortcuts"),
    addFolder: () => void vaultsApi.addFolder(),
    save: () => void guardedSave(),
    saveAs: () => void docApi.saveAs(),
    printDocument: () => {
      if (doc) printDocument(doc.content, theme);
    },
    exportHTML: () => {
      if (doc) void exportHTML(doc.content, theme);
    },
    exportDOCX: () => {
      if (doc) void exportDOCX(doc.content);
    },
    importDOCX: () => void importDocxFlow(),
    toggleSidebar: () => setSidebarVisible((v) => !v),
    toggleEdit,
    toggleSourceView: () => {
      setMode("edit");
      setSourceView((v) => !v);
    },
    focusSearch,
    // A template is outside the trust workflow — the Trust menu's seal/sign/
    // approve/track items are refused for it (the panel explains why). Trust
    // applies only to the merged document.
    trustSeal: () =>
      doc &&
      (isTemplate(doc.content) ? setTrustPanelOpen(true) : setTrustDialog("seal")),
    trustSign: () =>
      doc &&
      (isTemplate(doc.content) ? setTrustPanelOpen(true) : setTrustDialog("sign")),
    trustApprove: () =>
      doc &&
      (isTemplate(doc.content)
        ? setTrustPanelOpen(true)
        : setTrustDialog("approve")),
    trustTrack: () => {
      if (!doc) return;
      if (isTemplate(doc.content)) {
        setTrustPanelOpen(true);
        return;
      }
      void docApi.applyAndSave(trustOps.startTracking(doc.content));
    },
    trustUnseal: () => {
      if (doc && trustOps.sealed(doc.content)) {
        void docApi.applyAndSave(trustOps.unseal(doc.content));
      }
    },
    trustVerify: () => doc && setTrustPanelOpen(true),
  };

  // Rebuild the menu whenever the recents change so "Open Recent" stays current
  // (the Tauri menu is static once built; we re-set it on each change).
  useEffect(() => {
    installAppMenu(() => actionsRef.current).catch((err) =>
      console.warn("App menu unavailable:", err),
    );
  }, [vaultsApi.recentFiles]);

  // ----- native window title: filename + dirty dot -----
  useEffect(() => {
    const title = doc
      ? `${doc.dirty ? "• " : ""}${doc.name} — Dotit`
      : "Dotit";
    document.title = title;
    if (isTauri) getCurrentWindow().setTitle(title).catch(() => {});
  }, [doc, doc?.name, doc?.dirty]);

  // ----- which file this window opens -----
  useEffect(() => {
    if (!isTauri) return;
    // A doc window opens the file it was created for; the main window drains the
    // cold-start pending-open (launch-by-double-click on Windows/Linux CLI arg).
    (async () => {
      try {
        const assigned = await windowFile();
        if (assigned) {
          await openFile(assigned);
        } else {
          const pending = await invoke<string | null>("take_pending_open");
          if (pending) await openFile(pending);
        }
      } catch {
        /* ignore */
      }
    })();
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
      } else if (key === "f" && !e.shiftKey) {
        if (doc) {
          e.preventDefault();
          setFindOpen(true);
        }
      } else if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        setQuickOpen((v) => !v);
      } else if (key === "e" && e.shiftKey) {
        e.preventDefault();
        setMode("edit");
        setSourceView((v) => !v);
      } else if (key === "e" && !e.shiftKey) {
        e.preventDefault();
        toggleEdit();
      } else if (key === "p" && !e.shiftKey) {
        e.preventDefault();
        if (doc) printDocument(doc.content, theme);
      } else if (key === ",") {
        e.preventDefault();
        setAppDialog("preferences");
      } else if (key === "/") {
        e.preventDefault();
        setAppDialog("shortcuts");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [docApi, focusSearch, toggleEdit, doc, theme, guardedSave]);

  // ----- drag-and-drop to open (.it / .docx onto the window) -----
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    getCurrentWebview()
      .onDragDropEvent((e) => {
        if (e.payload.type === "over") {
          setDragOver(true);
        } else if (e.payload.type === "drop") {
          setDragOver(false);
          const paths = e.payload.paths ?? [];
          // Open the first .it; otherwise import the first .docx. (A single
          // window holds one document, so we take the first usable file.)
          const it = paths.find((p) => p.toLowerCase().endsWith(".it"));
          if (it) {
            void openFile(it);
            return;
          }
          const docx = paths.find((p) => p.toLowerCase().endsWith(".docx"));
          if (docx) void importDocxFromPath(docx);
        } else {
          setDragOver(false);
        }
      })
      .then((un) => {
        if (active) unlisten = un;
        else un();
      })
      .catch((err) => console.warn("Drag-drop unavailable:", err));
    return () => {
      active = false;
      unlisten?.();
    };
  }, [openFile, importDocxFromPath]);

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
          {doc && hasOutline && (
            <button
              className={`icon-btn${leftPanel === "outline" ? " active" : ""}`}
              title="Contents / outline"
              onClick={() =>
                setLeftPanel((p) => (p === "outline" ? "none" : "outline"))
              }
            >
              <ListTree size={16} />
            </button>
          )}
          <button
            className="icon-btn topbar-gear"
            title="Preferences (⌘,)"
            onClick={() => setAppDialog("preferences")}
          >
            <Settings size={16} />
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
                title={
                  docIsTemplate
                    ? "Templates can't be signed — merge first."
                    : "Sign document"
                }
                disabled={docIsTemplate}
                onClick={() => setTrustDialog("sign")}
              >
                <PenLine size={15} />
              </button>
              <button
                className="icon-btn"
                title={
                  docIsTemplate
                    ? "Templates can't be approved — merge first."
                    : "Approve document"
                }
                disabled={docIsTemplate}
                onClick={() => setTrustDialog("approve")}
              >
                <BadgeCheck size={15} />
              </button>
              {docIsTemplate ? (
                <button
                  className="icon-btn"
                  title="Templates can't be sealed — merge first."
                  disabled
                >
                  <Lock size={15} />
                </button>
              ) : docIsSealed ? (
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
                title="Import Word (.docx)…"
                onClick={() => void importDocxFlow()}
              >
                <FileUp size={15} />
              </button>
              <button
                className="icon-btn"
                title="Print / Save as PDF (⌘P)"
                onClick={() => printDocument(doc.content, theme)}
              >
                <Printer size={15} />
              </button>
              <button
                className="icon-btn"
                title="Export as HTML…"
                onClick={() => void exportHTML(doc.content, theme)}
              >
                <FileDown size={15} />
              </button>
              <button
                className="icon-btn"
                title="Export as Word (.docx)…"
                onClick={() => void exportDOCX(doc.content)}
              >
                <FileType2 size={15} />
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
          {doc && findOpen && (
            <FindBar
              onClose={() => setFindOpen(false)}
              replace={
                mode === "edit" && !docIsSealed
                  ? {
                      getContent: () => docApi.doc?.content ?? "",
                      setContent: docApi.setContent,
                    }
                  : undefined
              }
            />
          )}
          <div className="main-row">
          {doc && leftPanel === "outline" && (
            <OutlinePanel
              source={doc.content}
              onClose={() => setLeftPanel("none")}
            />
          )}
          {/* keyed on the file path so each switch remounts + plays the
              document-open transition — a file should feel like it OPENS, not
              blink in like a database row. */}
          <div className="doc-surface" key={doc?.path ?? "home"}>
          {doc ? (
            mainPane
          ) : (
            <div className="empty-state">
              <div className="home-hero">
                <div className="empty-brand">.it</div>
                <h1>Dotit</h1>
                <p>
                  Your documents — read like a PDF, edit like a word processor,
                  prove like a notary.
                </p>
                <div className="empty-actions">
                  <button
                    className="btn primary"
                    onClick={() => void newDocument()}
                  >
                    <FileText size={15} /> New Document
                  </button>
                  <button className="btn" onClick={() => openFileViaDialog()}>
                    <FileUp size={15} /> Open File…
                  </button>
                  <button className="btn" onClick={() => void importDocxFlow()}>
                    <FileType2 size={15} /> Import Word…
                  </button>
                  <button className="btn" onClick={() => vaultsApi.addFolder()}>
                    <FolderPlus size={15} /> Add Folder…
                  </button>
                </div>
              </div>

              {vaultsApi.recentFiles.length > 0 && (
                <div className="home-recent">
                  <div className="home-section-head">
                    <span>
                      <Clock size={14} /> Recent
                    </span>
                    <button
                      className="link small"
                      onClick={() => vaultsApi.clearRecent()}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="recent-grid">
                    {vaultsApi.recentFiles.slice(0, 9).map((p) => {
                      const name =
                        p.split("/").pop()?.replace(/\.it$/i, "") ?? p;
                      const folder = p.split("/").slice(-2, -1)[0] ?? "";
                      return (
                        <button
                          key={p}
                          className="recent-card"
                          onClick={() => void openFile(p)}
                          title={p}
                        >
                          <FileText size={20} className="recent-card-icon" />
                          <span className="recent-card-name">{name}</span>
                          {folder && (
                            <span className="recent-card-folder">{folder}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
          </div>
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

      {quickOpen && (
        <QuickOpen
          files={vaultsApi.allFiles}
          recent={vaultsApi.recentFiles}
          vaultLabelFor={vaultsApi.vaultLabelFor}
          onOpen={(p) => {
            void openFile(p);
            setQuickOpen(false);
          }}
          onClose={() => setQuickOpen(false)}
        />
      )}

      {appDialog === "preferences" && (
        <PreferencesDialog api={settingsApi} onClose={() => setAppDialog(null)} />
      )}
      {appDialog === "about" && <AboutDialog onClose={() => setAppDialog(null)} />}
      {appDialog === "shortcuts" && (
        <ShortcutsDialog onClose={() => setAppDialog(null)} />
      )}

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-card">
            <FileUp size={28} />
            Drop to open
          </div>
        </div>
      )}
    </div>
  );
}
