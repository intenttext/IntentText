// menu.ts — native OS menu bar (Tauri menu API).
//
// The menu is built once; every item dispatches through a getter so handlers
// always see the latest React state (the host keeps them in a ref).

import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { isTauri } from "./backend";

export interface MenuActions {
  newDocument: () => void;
  openFile: () => void;
  openWorkspace: () => void;
  save: () => void;
  saveAs: () => void;
  exportPDF: () => void;
  exportHTML: () => void;
  toggleSidebar: () => void;
  toggleSourceView: () => void;
  focusSearch: () => void;
  trustSeal: () => void;
  trustSign: () => void;
  trustApprove: () => void;
  trustTrack: () => void;
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

  const appMenu = isMac
    ? await Submenu.new({
        text: "Dotit",
        items: [
          await PredefinedMenuItem.new({ item: { About: null } }),
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

  const fileMenu = await Submenu.new({
    text: "File",
    items: [
      await item("New Document", "CmdOrCtrl+N", (a) => a.newDocument()),
      await item("Open…", "CmdOrCtrl+O", (a) => a.openFile()),
      await item("Open Workspace…", "CmdOrCtrl+Shift+O", (a) =>
        a.openWorkspace(),
      ),
      await sep(),
      await item("Save", "CmdOrCtrl+S", (a) => a.save()),
      await item("Save As…", "CmdOrCtrl+Shift+S", (a) => a.saveAs()),
      await sep(),
      await item("Export as PDF…", "CmdOrCtrl+P", (a) => a.exportPDF()),
      await item("Export as HTML…", undefined, (a) => a.exportHTML()),
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
      await item("Find in Workspace", "CmdOrCtrl+Shift+F", (a) =>
        a.focusSearch(),
      ),
    ],
  });

  const viewMenu = await Submenu.new({
    text: "View",
    items: [
      await item("Toggle Library", "CmdOrCtrl+B", (a) => a.toggleSidebar()),
      await item("Toggle Source View", "CmdOrCtrl+E", (a) =>
        a.toggleSourceView(),
      ),
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
        ? [await PredefinedMenuItem.new({ item: "BringAllToFront" })]
        : []),
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
    ],
  });

  await menu.setAsAppMenu();
}
