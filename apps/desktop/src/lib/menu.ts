// menu.ts — native OS menu bar (Tauri menu API).
//
// The menu is built once; every item dispatches through a getter so handlers
// always see the latest React state (the host keeps them in a ref).

import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { isTauri } from "./backend";

export interface MenuActions {
  newDocument: () => void;
  openFile: () => void;
  openRecent: (path: string) => void;
  /** Snapshot of recent file paths, read fresh each time the menu rebuilds. */
  recentFiles: string[];
  clearRecent: () => void;
  addFolder: () => void;
  save: () => void;
  saveAs: () => void;
  printDocument: () => void;
  exportHTML: () => void;
  exportDOCX: () => void;
  importDOCX: () => void;
  toggleSidebar: () => void;
  toggleEdit: () => void;
  toggleSourceView: () => void;
  focusSearch: () => void;
  openPreferences: () => void;
  showAbout: () => void;
  showShortcuts: () => void;
  trustSeal: () => void;
  trustSign: () => void;
  trustApprove: () => void;
  trustTrack: () => void;
  trustUnseal: () => void;
  trustVerify: () => void;
}

export async function installAppMenu(
  getActions: () => MenuActions,
): Promise<void> {
  if (!isTauri) return;

  const item = (
    text: string,
    accelerator: string | undefined,
    run: (a: MenuActions) => void,
  ) =>
    MenuItem.new({
      text,
      accelerator,
      action: () => run(getActions()),
    });
  const sep = () => PredefinedMenuItem.new({ item: "Separator" });

  const isMac = navigator.userAgent.includes("Mac");
  const basename = (p: string) => p.split(/[\\/]/).pop() ?? p;

  const appMenu = isMac
    ? await Submenu.new({
        text: "Dotit",
        items: [
          await item("About Dotit", undefined, (a) => a.showAbout()),
          await sep(),
          await item("Preferences…", "CmdOrCtrl+,", (a) =>
            a.openPreferences(),
          ),
          await sep(),
          await PredefinedMenuItem.new({ item: "Services" }),
          await sep(),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await sep(),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ],
      })
    : null;

  // "Open Recent" — populated from the recents snapshot the host passes in.
  // The menu is rebuilt whenever recents change (see installAppMenu caller), so
  // these items always reflect the current list.
  const recents = getActions().recentFiles.slice(0, 12);
  const recentItems = recents.length
    ? [
        ...(await Promise.all(
          recents.map((path) =>
            item(basename(path), undefined, (a) => a.openRecent(path)),
          ),
        )),
        await sep(),
        await item("Clear Recent", undefined, (a) => a.clearRecent()),
      ]
    : [
        await MenuItem.new({
          text: "No Recent Documents",
          enabled: false,
        }),
      ];
  const openRecentMenu = await Submenu.new({
    text: "Open Recent",
    items: recentItems,
  });

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      await item("New Document", "CmdOrCtrl+N", (a) => a.newDocument()),
      await item("Open…", "CmdOrCtrl+O", (a) => a.openFile()),
      openRecentMenu,
      await item("Import Word (.docx)…", undefined, (a) => a.importDOCX()),
      await item("Add Folder to Library…", "CmdOrCtrl+Shift+O", (a) =>
        a.addFolder(),
      ),
      await sep(),
      await item("Save", "CmdOrCtrl+S", (a) => a.save()),
      await item("Save As…", "CmdOrCtrl+Shift+S", (a) => a.saveAs()),
      await sep(),
      await item("Print / Save as PDF…", "CmdOrCtrl+P", (a) =>
        a.printDocument(),
      ),
      await item("Export as HTML…", undefined, (a) => a.exportHTML()),
      await item("Export as Word (.docx)…", undefined, (a) => a.exportDOCX()),
      await sep(),
      await PredefinedMenuItem.new({ item: "CloseWindow" }),
    ],
  });

  const editMenu = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await sep(),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
      await sep(),
      await item("Find Across Library", "CmdOrCtrl+Shift+F", (a) =>
        a.focusSearch(),
      ),
    ],
  });

  const viewMenu = await Submenu.new({
    text: "View",
    items: [
      await item("Edit / View Document", "CmdOrCtrl+E", (a) => a.toggleEdit()),
      await item("Toggle Source View", "CmdOrCtrl+Shift+E", (a) =>
        a.toggleSourceView(),
      ),
      await sep(),
      await item("Toggle Sidebar", "CmdOrCtrl+B", (a) => a.toggleSidebar()),
      await sep(),
      await PredefinedMenuItem.new({ item: "Fullscreen" }),
    ],
  });

  const trustMenu = await Submenu.new({
    text: "Trust",
    items: [
      await item("Track Document", undefined, (a) => a.trustTrack()),
      await item("Add Approval…", undefined, (a) => a.trustApprove()),
      await item("Sign Document…", "CmdOrCtrl+Shift+G", (a) => a.trustSign()),
      await item("Seal Document…", "CmdOrCtrl+Shift+L", (a) => a.trustSeal()),
      await item("Unseal Document", undefined, (a) => a.trustUnseal()),
      await sep(),
      await item("Verify Document", "CmdOrCtrl+Shift+V", (a) =>
        a.trustVerify(),
      ),
    ],
  });

  const windowMenu = await Submenu.new({
    text: "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "Maximize" }),
      ...(isMac
        ? [await PredefinedMenuItem.new({ item: "Fullscreen" })]
        : []),
    ],
  });

  // Help — Keyboard Shortcuts always; About + Preferences here too on non-mac
  // (where there's no application menu to host them).
  const helpMenu = await Submenu.new({
    text: "Help",
    items: [
      await item("Keyboard Shortcuts", "CmdOrCtrl+/", (a) =>
        a.showShortcuts(),
      ),
      ...(isMac
        ? []
        : [
            await sep(),
            await item("Preferences…", "CmdOrCtrl+,", (a) =>
              a.openPreferences(),
            ),
            await item("About Dotit", undefined, (a) => a.showAbout()),
          ]),
    ],
  });

  const menu = await Menu.new({
    items: [
      ...(appMenu ? [appMenu] : []),
      fileMenu,
      editMenu,
      viewMenu,
      trustMenu,
      windowMenu,
      helpMenu,
    ],
  });

  await menu.setAsAppMenu();
}
