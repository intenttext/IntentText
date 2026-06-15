// useSettings — durable, app-wide UI preferences (Preferences dialog state).
//
// Two-tier persistence, on purpose:
//   • localStorage — read synchronously on first paint (so the theme is correct
//     before the Tauri settings round-trip resolves, and so prefs work in plain
//     `vite dev` where the Rust store is absent).
//   • save_settings({ ui }) — the durable copy on disk, merged into the shared
//     settings.json alongside the vault registry (the Rust side merges by
//     top-level key, so `ui` and `vaults` never clobber each other).
//
// The theme is APPLIED here (data-theme on <html>) so a single source of truth
// drives the CSS override; "system" clears the attribute and falls back to the
// prefers-color-scheme media query in app.css.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri, loadSettings, saveSettings } from "../lib/backend";

export type ThemePref = "system" | "light" | "dark";
export type PageSizePref = "A4" | "A3" | "A2" | "A1" | "Letter";

export interface UiSettings {
  theme: ThemePref;
  /** Page size baked into freshly created documents. */
  defaultPageSize: PageSizePref;
  /** Whether on-disk documents autosave on a debounce. */
  autosave: boolean;
  /** Folder pre-selected in Save-As / New dialogs (empty = none). */
  defaultFolder: string;
}

export const DEFAULT_SETTINGS: UiSettings = {
  theme: "system",
  defaultPageSize: "A4",
  autosave: true,
  defaultFolder: "",
};

const LS_KEY = "dotit.ui.settings";

const PAGE_SIZES: PageSizePref[] = ["A4", "A3", "A2", "A1", "Letter"];
const THEMES: ThemePref[] = ["system", "light", "dark"];

function coerce(raw: Partial<UiSettings> | null | undefined): UiSettings {
  const s = raw ?? {};
  return {
    theme: THEMES.includes(s.theme as ThemePref)
      ? (s.theme as ThemePref)
      : DEFAULT_SETTINGS.theme,
    defaultPageSize: PAGE_SIZES.includes(s.defaultPageSize as PageSizePref)
      ? (s.defaultPageSize as PageSizePref)
      : DEFAULT_SETTINGS.defaultPageSize,
    autosave: typeof s.autosave === "boolean" ? s.autosave : DEFAULT_SETTINGS.autosave,
    defaultFolder:
      typeof s.defaultFolder === "string"
        ? s.defaultFolder
        : DEFAULT_SETTINGS.defaultFolder,
  };
}

function loadLocal(): UiSettings {
  try {
    return coerce(JSON.parse(localStorage.getItem(LS_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Apply the explicit-theme override to <html>; "system" clears it. */
function applyTheme(theme: ThemePref): void {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

interface PersistedSettings {
  ui?: Partial<UiSettings>;
}

export interface SettingsApi {
  settings: UiSettings;
  /** Patch one or more fields; persists + (for theme) applies immediately. */
  update: (patch: Partial<UiSettings>) => void;
}

export function useSettings(): SettingsApi {
  // Seed synchronously from localStorage so the first paint is themed correctly.
  const [settings, setSettings] = useState<UiSettings>(loadLocal);

  // Apply the seeded theme before paint.
  const appliedOnce = useRef(false);
  if (!appliedOnce.current) {
    appliedOnce.current = true;
    applyTheme(settings.theme);
  }

  // Reconcile with the durable on-disk copy once (Tauri only). The disk copy is
  // authoritative across machines / cache wipes; localStorage is the fast cache.
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    (async () => {
      try {
        const persisted = await loadSettings<PersistedSettings>();
        if (cancelled || !persisted?.ui) return;
        const merged = coerce(persisted.ui);
        setSettings(merged);
        applyTheme(merged.theme);
        localStorage.setItem(LS_KEY, JSON.stringify(merged));
      } catch (err) {
        console.warn("Failed to load UI settings:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to OS theme changes only while in "system" mode (so the live preview
  // tracks the OS); the explicit override is handled by data-theme + CSS.
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [settings.theme]);

  const update = useCallback((patch: Partial<UiSettings>) => {
    setSettings((prev) => {
      const next = coerce({ ...prev, ...patch });
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      if (next.theme !== prev.theme) applyTheme(next.theme);
      if (isTauri) {
        saveSettings({ ui: next }).catch((err) =>
          console.warn("Failed to persist UI settings:", err),
        );
      }
      return next;
    });
  }, []);

  return useMemo(() => ({ settings, update }), [settings, update]);
}
