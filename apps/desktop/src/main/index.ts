// Electron main process — the native layer for Dotit desktop.
//
// Implements the same command surface the renderer used under Tauri (read_file,
// write_file, print, settings, identity, workspace watch, …) via ipcMain. The
// renderer talks to it through window.electronAPI (see ../preload) which the Tauri
// shims (../renderer/src/tauri-shims/*) call — so the React app is unchanged.

import { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage, screen } from "electron";
import { join, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import {
  readFile,
  writeFile,
  appendFile,
  readdir,
  stat,
  mkdir,
  rename,
  unlink,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import chokidar, { type FSWatcher } from "chokidar";

const isDev = !app.isPackaged;
const SETTINGS_PATH = () => join(app.getPath("userData"), "settings.json");
const IDENTITY_PATH = () => join(app.getPath("userData"), "identity.bin");
const PADES_IDENTITY_PATH = () =>
  join(app.getPath("userData"), "pades-identity.bin");

// ── Window + file-open state ────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
const windowFiles = new Map<number, string>(); // webContents.id → .it path it opened
const docWindows = new Map<string, BrowserWindow>(); // path → its window (dedup)
let pendingOpen: string | null = null; // cold-start file before the renderer mounts

function rendererUrl(): string | undefined {
  return process.env["ELECTRON_RENDERER_URL"];
}

function loadRenderer(win: BrowserWindow): void {
  const url = rendererUrl();
  if (url) void win.loadURL(url);
  else void win.loadFile(join(__dirname, "../renderer/index.html"));
}

function createWindow(file?: string): BrowserWindow {
  // Open centered on the PRIMARY display at a sensible fraction of the work
  // area — never off-screen, never tiny, regardless of multi-monitor layout.
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.min(1400, Math.round(wa.width * 0.86));
  const height = Math.min(920, Math.round(wa.height * 0.92));
  const x = wa.x + Math.round((wa.width - width) / 2);
  const y = wa.y + Math.round((wa.height - height) / 2);
  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f3f4f6",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      backgroundThrottling: false,
      paintWhenInitiallyHidden: true,
    },
  });
  if (file) windowFiles.set(win.webContents.id, file);
  const reveal = () => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
      win.focus();
    }
  };
  win.on("ready-to-show", reveal);
  // Safety net: if ready-to-show is delayed (slow first paint), reveal anyway so
  // the window never gets stuck hidden.
  win.webContents.on("did-finish-load", reveal);
  setTimeout(reveal, 2500);

  // Dev diagnostics (DOTIT_RLOG=path): surface renderer console + fatal events.
  const rlog = process.env["DOTIT_RLOG"];
  if (rlog) {
    const log = (s: string) => void appendFile(rlog, s + "\n").catch(() => {});
    win.webContents.on("console-message", (_e, lvl, msg, line, src) =>
      log(`[console ${lvl}] ${msg} (${src}:${line})`),
    );
    win.webContents.on("render-process-gone", (_e, d) =>
      log(`[render-gone] ${JSON.stringify(d)}`),
    );
    win.webContents.on("did-fail-load", (_e, c, desc, url) =>
      log(`[did-fail-load] ${c} ${desc} ${url}`),
    );
    win.webContents.on("did-finish-load", () => log("[did-finish-load]"));
    win.on("ready-to-show", () => log("[ready-to-show]"));
  }

  win.on("closed", () => {
    windowFiles.delete(win.webContents.id);
    for (const [p, w] of docWindows) if (w === win) docWindows.delete(p);
    if (win === mainWindow) mainWindow = null;
  });
  loadRenderer(win);
  return win;
}

function openDocWindow(path: string): void {
  const existing = docWindows.get(path);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return;
  }
  // Cold start: reuse the empty main window for the first file (no stray window).
  if (mainWindow && !mainWindow.isDestroyed() && windowFiles.size === 0) {
    windowFiles.set(mainWindow.webContents.id, path);
    docWindows.set(path, mainWindow);
    mainWindow.webContents.send("open-file", path);
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  const w = createWindow(path);
  docWindows.set(path, w);
}

// macOS: file opened via Finder / "Open With" / double-click.
app.on("open-file", (event, path) => {
  event.preventDefault();
  if (app.isReady()) openDocWindow(path);
  else pendingOpen = path;
});

// Single instance — focus existing instead of launching a second copy.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const file = argv.find((a) => a.endsWith(".it"));
    if (file) openDocWindow(file);
    else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── IPC: generic command router (mirrors Tauri `invoke`) ─────────────────────
const handlers: Record<string, (args: any, win: BrowserWindow | null) => unknown | Promise<unknown>> = {
  // — filesystem —
  read_file: async ({ path }) => {
    if (!existsSync(path)) throw new Error(`File not found: ${path}`);
    return readFile(path, "utf8");
  },
  write_file: async ({ path, content }) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  },
  write_binary_file: async ({ path, contents }) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(contents as number[]));
  },
  read_binary_file: async ({ path }) => Array.from(await readFile(path)),
  list_files: async ({ dir }) => {
    const entries = await readdir(dir, { withFileTypes: true });
    const out: unknown[] = [];
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const isDir = e.isDirectory();
      if (!isDir && !e.name.endsWith(".it")) continue;
      const full = join(dir, e.name);
      let size = 0;
      let modified = 0;
      try {
        const s = await stat(full);
        size = s.size;
        modified = Math.floor(s.mtimeMs / 1000);
      } catch {
        /* ignore */
      }
      out.push({ name: e.name, path: full, is_dir: isDir, size, modified });
    }
    out.sort((a: any, b: any) =>
      a.is_dir === b.is_dir ? a.name.localeCompare(b.name) : a.is_dir ? -1 : 1,
    );
    return out;
  },
  file_metadata: async ({ path }) => {
    const s = await stat(path);
    return {
      size: s.size,
      modified: Math.floor(s.mtimeMs / 1000),
      is_readonly: !(s.mode & 0o200),
    };
  },
  delete_file: async ({ path }) => {
    await shell.trashItem(path).catch(async () => unlink(path));
  },
  rename_file: async ({ from, to }) => {
    if (existsSync(to)) throw new Error(`Destination already exists: ${to}`);
    await rename(from, to);
  },
  open_external: async ({ path }) => {
    const err = await shell.openPath(path);
    if (err) throw new Error(err);
  },

  // — workspace —
  // Recursive listing of a folder's .it documents + subdirectories. Returns a
  // flat array sorted parents-before-children (depth ascending) so the renderer's
  // buildTree() can attach each node to its parent. (The directory *picker* is a
  // separate dialog:open with directory:true — this only lists a known path.)
  open_folder: async ({ path: root }) => {
    const files: unknown[] = [];
    const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // unreadable dir (permissions, deleted) — skip, don't crash
      }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const isDir = e.isDirectory();
        if (!isDir && !e.name.endsWith(".it")) continue;
        const full = join(dir, e.name);
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        let size = 0;
        let modified = 0;
        try {
          const s = await stat(full);
          size = s.size;
          modified = Math.floor(s.mtimeMs / 1000);
        } catch {
          /* ignore */
        }
        files.push({
          name: e.name,
          path: full,
          relative_path: relPath,
          is_dir: isDir,
          depth,
          size,
          modified,
        });
        if (isDir) await walk(full, relPath, depth + 1);
      }
    };
    await walk(root, "", 0);
    files.sort((a: any, b: any) => a.depth - b.depth);
    return { name: basename(root), path: root, files };
  },

  // — settings (JSON in userData) —
  load_settings: async () => {
    try {
      return JSON.parse(await readFile(SETTINGS_PATH(), "utf8"));
    } catch {
      return {};
    }
  },
  save_settings: async ({ settings }) => {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await readFile(SETTINGS_PATH(), "utf8"));
    } catch {
      /* none yet */
    }
    const merged = { ...current, ...(settings as Record<string, unknown>) };
    await writeFile(SETTINGS_PATH(), JSON.stringify(merged, null, 2), "utf8");
  },

  // — signing identity (encrypted at rest with the OS via safeStorage) —
  identity_get: async () => {
    try {
      if (!existsSync(IDENTITY_PATH())) return null;
      const buf = await readFile(IDENTITY_PATH());
      return safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(buf)
        : buf.toString("utf8");
    } catch {
      return null;
    }
  },
  identity_set: async ({ value }) => {
    const data = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(value as string)
      : Buffer.from(value as string, "utf8");
    await writeFile(IDENTITY_PATH(), data);
  },
  identity_clear: async () => {
    if (existsSync(IDENTITY_PATH())) await unlink(IDENTITY_PATH());
  },

  // — windows / file-open —
  open_doc_window: ({ path }) => openDocWindow(path as string),
  window_file: (_args, win) => (win ? (windowFiles.get(win.webContents.id) ?? null) : null),
  take_pending_open: () => {
    const p = pendingOpen;
    pendingOpen = null;
    return p;
  },
  mark_ready: () => {},
};

ipcMain.handle("invoke", async (e, cmd: string, args: unknown) => {
  const h = handlers[cmd];
  if (!h) throw new Error(`Unknown command: ${cmd}`);
  const win = BrowserWindow.fromWebContents(e.sender);
  return h((args ?? {}) as any, win);
});

// ── IPC: dialogs (plugin-dialog) ─────────────────────────────────────────────
ipcMain.handle("dialog:open", async (_e, opts: any) => {
  const r = await dialog.showOpenDialog({
    properties: opts?.directory ? ["openDirectory"] : ["openFile"],
    filters: opts?.filters,
  });
  if (r.canceled) return null;
  return opts?.multiple ? r.filePaths : (r.filePaths[0] ?? null);
});
ipcMain.handle("dialog:save", async (_e, opts: any) => {
  const r = await dialog.showSaveDialog({ defaultPath: opts?.defaultPath, filters: opts?.filters });
  return r.canceled ? null : (r.filePath ?? null);
});
ipcMain.handle("dialog:message", async (_e, msg: string, opts: any) => {
  await dialog.showMessageBox({
    message: opts?.title ?? "Dotit",
    detail: msg,
    type: opts?.kind === "error" ? "error" : opts?.kind === "warning" ? "warning" : "info",
  });
});
// Confirm dialog (Tauri's `ask`) — returns true if the user accepted.
ipcMain.handle("dialog:ask", async (e, msg: string, opts: any) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
  const ok = opts?.okLabel ?? "OK";
  const cancel = opts?.cancelLabel ?? "Cancel";
  const r = await dialog.showMessageBox(win!, {
    message: opts?.title ?? "Dotit",
    detail: msg,
    type: opts?.kind === "error" ? "error" : opts?.kind === "warning" ? "warning" : "question",
    buttons: [ok, cancel],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  return r.response === 0;
});

// ── IPC: app / window ────────────────────────────────────────────────────────
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("path:temp", () => tmpdir());
ipcMain.on("win:setTitle", (e, title: string) => {
  BrowserWindow.fromWebContents(e.sender)?.setTitle(title);
});

// ── IPC: reliable print (Chromium) of ONLY the document ──────────────────────
// The renderer hands us the print-ready HTML; we render it in a hidden window and
// print THAT — so the print contains only the document, correctly paginated, never
// the app chrome (the WKWebView problem that drove this rewrite).
ipcMain.handle("print:html", async (_e, html: string) => {
  const tmp = join(tmpdir(), `dotit-print-${Date.now()}.html`);
  await writeFile(tmp, html, "utf8");
  const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await printWin.loadFile(tmp);
  await new Promise((r) => setTimeout(r, 250)); // let fonts/layout settle
  await new Promise<void>((resolve) => {
    printWin.webContents.print({ silent: false, printBackground: true }, () => resolve());
  });
  printWin.close();
  void unlink(tmp).catch(() => {});
});

// ── PAdES: export a signed PDF ───────────────────────────────────────────────
// Signing runs HERE (main process) — the renderer is a browser context without
// node:crypto. @dotit/pades is ESM; we load it at runtime by URL so electron-vite
// doesn't try to bundle its crypto deps.
type Pades = typeof import("@dotit/pades");
const importByUrl = new Function("u", "return import(u)") as (u: string) => Promise<Pades>;
async function loadPades(): Promise<Pades> {
  const { pathToFileURL } = await import("node:url");
  return importByUrl(pathToFileURL(require.resolve("@dotit/pades")).href);
}

/** Get the desktop's PAdES signing identity (ECDSA cert+key), creating it once. */
async function getPadesIdentity(): Promise<{ certPem: string; privateKeyPem: string }> {
  const path = PADES_IDENTITY_PATH();
  try {
    const buf = await readFile(path);
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString("utf8");
    return JSON.parse(json);
  } catch {
    const pades = await loadPades();
    const settings = await readFile(SETTINGS_PATH(), "utf8").then(JSON.parse).catch(() => ({}));
    const cn = (settings.identityName as string) || "Dotit User";
    const id = await pades.generateSelfSignedCert({ commonName: cn });
    const identity = { certPem: id.certPem, privateKeyPem: id.privateKeyPem };
    const data = JSON.stringify(identity);
    await writeFile(
      path,
      safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(data)
        : Buffer.from(data, "utf8"),
    );
    return identity;
  }
}

/** Render print-ready HTML to PDF bytes via a hidden window (Chromium printToPDF). */
async function renderPdfBuffer(html: string): Promise<Buffer> {
  const tmp = join(tmpdir(), `dotit-pdf-${Date.now()}.html`);
  await writeFile(tmp, html, "utf8");
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadFile(tmp);
    await new Promise((r) => setTimeout(r, 250)); // settle fonts/layout
    return await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  } finally {
    win.close();
    void unlink(tmp).catch(() => {});
  }
}

/** Render HTML → PDF → PAdES-sign with the desktop identity. Returns signed bytes. */
async function renderSignedPdf(
  html: string,
  opts: { name?: string; reason?: string; tsaUrl?: string },
): Promise<Uint8Array> {
  const [pdf, pades, identity] = await Promise.all([
    renderPdfBuffer(html),
    loadPades(),
    getPadesIdentity(),
  ]);
  return pades.signPdfWithPem(new Uint8Array(pdf), {
    certPem: identity.certPem,
    privateKeyPem: identity.privateKeyPem,
    name: opts.name,
    reason: opts.reason,
    tsaUrl: opts.tsaUrl,
  });
}

// Renderer hands us print HTML + a save path/name; we render, sign, and write.
ipcMain.handle(
  "export:signedPdf",
  async (
    _e,
    arg: { html: string; defaultName?: string; name?: string; reason?: string; tsaUrl?: string },
  ): Promise<{ ok: boolean; path?: string; error?: string }> => {
    try {
      const r = await dialog.showSaveDialog({
        defaultPath: `${arg.defaultName || "document"}-signed.pdf`,
        filters: [{ name: "Signed PDF", extensions: ["pdf"] }],
      });
      if (r.canceled || !r.filePath) return { ok: false };
      const signed = await renderSignedPdf(arg.html, {
        name: arg.name,
        reason: arg.reason,
        tsaUrl: arg.tsaUrl,
      });
      await writeFile(r.filePath, Buffer.from(signed));
      return { ok: true, path: r.filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
);

// ── Workspace folder watching ────────────────────────────────────────────────
const watchers = new Map<string, FSWatcher>();
function watch(path: string, sender: Electron.WebContents): void {
  if (watchers.has(path)) return;
  const w = chokidar.watch(path, {
    ignoreInitial: true,
    depth: 6,
    ignored: (p) => /(^|[\\/])\../.test(p), // dotfiles
  });
  const emit = (channel: string) => (changed: string) => {
    if (!sender.isDestroyed()) sender.send(channel, { folder: changed });
  };
  w.on("add", emit("file-created"))
    .on("addDir", emit("file-created"))
    .on("change", emit("file-modified"))
    .on("unlink", emit("file-deleted"))
    .on("unlinkDir", emit("file-deleted"));
  watchers.set(path, w);
}
handlers.watch_folder = ({ path }, win) => {
  if (win) watch(path as string, win.webContents);
};
handlers.watch_folders = ({ paths }, win) => {
  if (win) for (const p of paths as string[]) watch(p, win.webContents);
};
handlers.unwatch_folder = async ({ path }) => {
  const w = watchers.get(path as string);
  if (w) {
    await w.close();
    watchers.delete(path as string);
  }
};

// ── Native application menu ───────────────────────────────────────────────────
function buildMenu(): void {
  const isMac = process.platform === "darwin";
  const send = (action: string) => () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.webContents.send("menu-action", action);
  };
  const M = (label: string, action: string, accelerator?: string): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: send(action),
  });
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([{
          label: "Dotit",
          submenu: [
            { label: "About Dotit", click: send("about") },
            { type: "separator" },
            M("Preferences…", "preferences", "CmdOrCtrl+,"),
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        M("New Document", "new", "CmdOrCtrl+N"),
        M("Open…", "open", "CmdOrCtrl+O"),
        M("Import Word (.docx)…", "import"),
        M("Add Folder to Library…", "addFolder", "CmdOrCtrl+Shift+O"),
        { type: "separator" },
        M("Save", "save", "CmdOrCtrl+S"),
        M("Save As…", "saveAs", "CmdOrCtrl+Shift+S"),
        { type: "separator" },
        M("Compare Versions…", "compare"),
        { type: "separator" },
        M("Print / Save as PDF…", "print", "CmdOrCtrl+P"),
        M("Export as Signed PDF (PAdES)…", "exportSignedPdf"),
        M("Export as HTML…", "exportHTML"),
        M("Export as Word (.docx)…", "exportDOCX"),
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        M("Find Across Library", "find", "CmdOrCtrl+Shift+F"),
      ],
    },
    {
      label: "View",
      submenu: [
        M("Edit / View Document", "toggleEdit", "CmdOrCtrl+E"),
        M("Toggle Source View", "toggleSource", "CmdOrCtrl+Shift+E"),
        { type: "separator" },
        M("Toggle Sidebar", "toggleSidebar", "CmdOrCtrl+B"),
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(isDev ? ([{ role: "toggleDevTools" }] as Electron.MenuItemConstructorOptions[]) : []),
      ],
    },
    {
      label: "Trust",
      submenu: [
        M("Track Document", "trustTrack"),
        M("Add Approval…", "trustApprove"),
        M("Sign Document…", "trustSign", "CmdOrCtrl+Shift+G"),
        M("Seal Document…", "trustSeal", "CmdOrCtrl+Shift+L"),
        M("Unseal Document", "trustUnseal"),
        { type: "separator" },
        M("Verify Document", "trustVerify", "CmdOrCtrl+Shift+V"),
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        M("Keyboard Shortcuts", "shortcuts", "CmdOrCtrl+/"),
        ...(isMac
          ? []
          : ([
              { type: "separator" },
              M("Preferences…", "preferences", "CmdOrCtrl+,"),
              { label: "About Dotit", click: send("about") },
            ] as Electron.MenuItemConstructorOptions[])),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Windows/Linux: a .it path may arrive as an argv on cold start.
  const argFile = process.argv.find((a) => a.endsWith(".it"));
  if (argFile) pendingOpen = argFile;

  buildMenu();
  mainWindow = createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });

  // Dev/CI hook (DOTIT_SIGN_TEST=<.it> DOTIT_SIGN_OUT=<pdf> [DOTIT_SIGN_TSA=<url>]):
  // render + PAdES-sign the doc to the output path, then quit — exercises the same
  // printToPDF + sign path the export action uses, so it's verifiable headlessly.
  const signTest = process.env["DOTIT_SIGN_TEST"];
  const signOut = process.env["DOTIT_SIGN_OUT"];
  if (signTest && signOut) {
    void (async () => {
      try {
        const src = await readFile(signTest, "utf8");
        const core = (await import("@dotit/core")) as typeof import("@dotit/core");
        const html = core.renderPrint(core.parseIntentText(src), { theme: "corporate" });
        const signed = await renderSignedPdf(html, {
          name: "Dotit User",
          reason: "Signed export",
          tsaUrl: process.env["DOTIT_SIGN_TSA"],
        });
        await writeFile(signOut, Buffer.from(signed));
        console.log(`SIGNED_OK ${signOut} ${signed.byteLength}`);
      } catch (e) {
        console.log(`SIGNED_ERR ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        app.quit();
      }
    })();
  }

  // Dev capture (DOTIT_CAPTURE=path): snapshot the window every few seconds via
  // capturePage — reliable regardless of window focus/occlusion/display.
  const capturePath = process.env["DOTIT_CAPTURE"];
  if (capturePath) {
    setInterval(() => {
      const w = mainWindow ?? BrowserWindow.getAllWindows()[0];
      if (!w || w.isDestroyed()) return;
      void w.webContents
        .capturePage()
        .then((img) => {
          const png = img.toPNG();
          if (png.length) return writeFile(capturePath, png);
        })
        .catch(() => {});
    }, 4000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
