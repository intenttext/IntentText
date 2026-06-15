// menu.ts — wires the native application menu (built in the Electron MAIN process)
// to the renderer's action handlers. Main sends a "menu-action" event with an
// action key; we dispatch it to the current MenuActions. The action handlers are
// read fresh on each event so they always see the latest React state.

export interface MenuActions {
  newDocument: () => void;
  openFile: () => void;
  openRecent: (path: string) => void;
  recentFiles: string[];
  clearRecent: () => void;
  addFolder: () => void;
  save: () => void;
  saveAs: () => void;
  printDocument: () => void;
  exportSignedPdf: () => void;
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

// Menu-action key (sent by main) → MenuActions method.
const MAP: Record<string, keyof MenuActions> = {
  new: "newDocument",
  open: "openFile",
  import: "importDOCX",
  addFolder: "addFolder",
  save: "save",
  saveAs: "saveAs",
  print: "printDocument",
  exportSignedPdf: "exportSignedPdf",
  exportHTML: "exportHTML",
  exportDOCX: "exportDOCX",
  find: "focusSearch",
  toggleEdit: "toggleEdit",
  toggleSource: "toggleSourceView",
  toggleSidebar: "toggleSidebar",
  preferences: "openPreferences",
  about: "showAbout",
  shortcuts: "showShortcuts",
  trustTrack: "trustTrack",
  trustApprove: "trustApprove",
  trustSign: "trustSign",
  trustSeal: "trustSeal",
  trustUnseal: "trustUnseal",
  trustVerify: "trustVerify",
};

let unsubscribe: (() => void) | null = null;

export async function installAppMenu(
  getActions: () => MenuActions,
): Promise<void> {
  const api = window.electronAPI;
  if (!api) return;
  unsubscribe?.();
  unsubscribe = api.on("menu-action", (payload) => {
    const action = String(payload);
    const key = MAP[action];
    if (!key) return;
    const fn = getActions()[key];
    if (typeof fn === "function") (fn as () => void)();
  });
}
