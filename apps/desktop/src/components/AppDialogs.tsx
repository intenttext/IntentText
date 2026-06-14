// AppDialogs — the shell's non-trust dialogs: Preferences, About, and the
// Keyboard Shortcuts cheat sheet. They reuse the existing .dialog chrome from
// app.css so they match the trust sheets visually.

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Info, Keyboard, Settings, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "../lib/backend";
import type {
  PageSizePref,
  SettingsApi,
  ThemePref,
} from "../hooks/useSettings";

// Shared shell so each dialog matches the trust sheets (backdrop + Esc-to-close).
function Sheet(props: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className="dialog-backdrop" onMouseDown={props.onClose}>
      <div
        className="dialog"
        style={props.width ? { width: props.width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="dialog-head">
          <span className="dialog-title">
            {props.icon}
            {props.title}
          </span>
          <button className="icon-btn" onClick={props.onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>
        <div className="dialog-body">{props.children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const PAGE_SIZES: PageSizePref[] = ["A4", "A3", "A2", "A1", "Letter"];

export function PreferencesDialog(props: {
  api: SettingsApi;
  onClose: () => void;
}) {
  const { settings, update } = props.api;

  const pickFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose default folder",
    });
    if (typeof selected === "string") update({ defaultFolder: selected });
  };

  return (
    <Sheet
      title="Preferences"
      icon={<Settings size={16} />}
      onClose={props.onClose}
      width={460}
    >
      <label className="field">
        <span>Appearance</span>
        <div className="segmented" role="radiogroup" aria-label="Appearance">
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={settings.theme === o.value}
              className={`seg${settings.theme === o.value ? " active" : ""}`}
              onClick={() => update({ theme: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>Default page size</span>
        <div className="segmented" role="radiogroup" aria-label="Default page size">
          {PAGE_SIZES.map((sz) => (
            <button
              key={sz}
              type="button"
              role="radio"
              aria-checked={settings.defaultPageSize === sz}
              className={`seg${settings.defaultPageSize === sz ? " active" : ""}`}
              onClick={() => update({ defaultPageSize: sz })}
            >
              {sz}
            </button>
          ))}
        </div>
      </label>

      <label className="field row-field">
        <span>Autosave</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.autosave}
          className={`toggle${settings.autosave ? " on" : ""}`}
          onClick={() => update({ autosave: !settings.autosave })}
        >
          <span className="toggle-knob" />
        </button>
      </label>
      <p className="dialog-note" style={{ marginTop: -4 }}>
        Saved documents write to disk automatically while you edit. Turn this off
        to save only with ⌘S.
      </p>

      <label className="field">
        <span>Default folder</span>
        <div className="folder-field">
          <input
            readOnly
            value={settings.defaultFolder || "Not set"}
            className={settings.defaultFolder ? "" : "muted"}
          />
          <button className="btn small" type="button" onClick={() => void pickFolder()}>
            Choose…
          </button>
          {settings.defaultFolder && (
            <button
              className="btn small"
              type="button"
              onClick={() => update({ defaultFolder: "" })}
            >
              Clear
            </button>
          )}
        </div>
      </label>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

const SITE_URL = "https://dotit.qa";
const DOCS_URL = "https://dotit.qa/docs";

export function AboutDialog(props: { onClose: () => void }) {
  const [version, setVersion] = useState<string>("");
  useEffect(() => {
    if (!isTauri) return;
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  return (
    <Sheet
      title="About Dotit"
      icon={<Info size={16} />}
      onClose={props.onClose}
      width={380}
    >
      <div className="about">
        <div className="empty-brand about-brand">.it</div>
        <h2 className="about-name">Dotit</h2>
        {version && <div className="about-version">Version {version}</div>}
        <p className="about-tagline">
          Plain-text documents you can read, edit, and prove.
        </p>
        <div className="about-links">
          <a href={SITE_URL} target="_blank" rel="noreferrer">
            Website
          </a>
          <span className="about-dot">·</span>
          <a href={DOCS_URL} target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts cheat sheet
// ---------------------------------------------------------------------------

// Kept in sync with the keymap in App.tsx (and the native menu accelerators).
const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘S", label: "Save" },
  { keys: "⌘P", label: "Print / Save as PDF" },
  { keys: "⌘F", label: "Find in document" },
  { keys: "⌘⇧F", label: "Find across library" },
  { keys: "⌘K", label: "Quick Open" },
  { keys: "⌘E", label: "Edit / View document" },
  { keys: "⌘⇧E", label: "Toggle source view" },
  { keys: "⌘B", label: "Toggle sidebar" },
  { keys: "⌘N", label: "New document" },
  { keys: "⌘O", label: "Open file" },
  { keys: "⌘,", label: "Preferences" },
  { keys: "⌘/", label: "Keyboard shortcuts" },
];

export function ShortcutsDialog(props: { onClose: () => void }) {
  return (
    <Sheet
      title="Keyboard Shortcuts"
      icon={<Keyboard size={16} />}
      onClose={props.onClose}
      width={420}
    >
      <div className="shortcut-list">
        {SHORTCUTS.map((s) => (
          <div className="shortcut-row" key={s.keys}>
            <span className="shortcut-label">{s.label}</span>
            <kbd className="shortcut-keys">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
