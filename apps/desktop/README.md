# Dotit Desktop

> IntentText's native document manager — the product that makes a `.it` file feel like a PDF: click it, and it opens as a clean, read-only paper page you can trust. An **Edit** button switches to the embeddable [`@dotit/editor`](../../packages/editor) WYSIWYG (ribbon, Word-like pages, trust banner) when you want to change it. Built with [Tauri](https://tauri.app/) v2 + React on top of [`@dotit/core`](../../packages/core).

## Features

- **Multi-vault registry (DEVONthink-style)** — your `.it` files live in many places (`~/Documents/contracts`, `~/Dropbox/invoices`, `~/Projects/…`). Register each folder once (**Add Folder** dialog, multi-select supported). The Finder-style left rail shows **All Files** (every vault) plus each registered folder by label, with a live doc count. The registry is persisted to disk by the Rust backend (`settings.json` in the OS app-config dir), so it survives a webview cache wipe. Each vault loads its own tree and all roots are watched for live updates. Right-click a folder to rename its label, refresh, or remove it.
- **Federated search** — the Search panel runs the core query engine across **every** vault at once (or just the active one when scoped), parsing/querying in memory and merging results. Mix structured filters with free text, e.g. `type=invoice status=Unpaid`, `owner:contains=sara due<2026-07-01 sort:due:asc limit:20`, `field?`. Results group by document and are tagged with the **vault** they came from, the document **type**, and a 🔒 **sealed** badge; click to open.
- **Viewer / Edit split — "opens like a PDF"** — clicking a file opens the **read-only Document Viewer** by default: the doc is rendered through core's `renderPrint` (the same engine the PDF export uses) into a sandboxed iframe, so it looks exactly like the printed page — clean, paginated, themed. Press **Edit** (or `⌘E`) to switch to the WYSIWYG editor; press again to return to the viewer. New blank documents open straight into editing. Sealed documents stay read-only.
- **Trust operations** — Track / Approve / Sign / **Seal** / **Unseal** / **Verify** from the native Trust menu, the document toolbar, the editor ribbon, or shortcuts. Uses `@dotit/core` 1.2.0's idempotent crypto APIs (`sealDocument` / `signDocument` / `unsealDocument` / `verifyDocument` / `isSealed`). Sealed docs are read-only and show a 🔒 pill. The vault file list and search results show lifecycle glyphs (tracked / approved / signed / sealed), computed lazily and cached by mtime across all vaults.
- **Native feel** — real OS menu bar (Dotit / File / Edit / View / Trust / Window) wired to the same actions; window title shows `• filename`; `.it` file association opens straight into the viewer; window-state restore; autosave to disk (debounced) with a clear dirty / saved indicator; dark mode follows the OS; the official charcoal `.it` mark is the app icon.

### Keyboard shortcuts

`⌘N` new · `⌘O` open file · `⇧⌘O` add folder · `⌘S` save · `⇧⌘S` save as · `⌘P` export PDF · `⌘B` toggle sidebar · `⇧⌘F` search · `⌘E` view ⇄ edit · `⇧⌘E` source view · `⇧⌘G` sign · `⇧⌘L` seal · `⇧⌘V` verify

## Development

```bash
pnpm install                          # from the repo root
pnpm --filter @dotit/core build       # build core (provides renderPrint, query, trust, index)
pnpm --filter @dotit/editor build     # build the editor package once
pnpm --filter intenttext-desktop tauri:dev
```

`pnpm --filter intenttext-desktop dev` runs the web layer alone (no filesystem / vault registry without the Tauri shell).

## Build

```bash
pnpm --filter intenttext-desktop build        # tsc + vite build (web layer)
pnpm --filter intenttext-desktop tauri:build  # native installers (syncs icons first)
```

## Architecture notes

- **Filesystem access is all custom std-only Rust commands** (`src-tauri/src/commands/{fs,workspace,settings}.rs`): read / write / rename / trash, recursive folder listing, a `notify`-based watcher (`watch_folders` watches every registered vault root and emits `file-created/modified/deleted`), and an atomic JSON settings store (`load_settings` / `save_settings`). Because access goes through these commands rather than the fs plugin's scoped allowlist, the app can read `.it` files in **arbitrary** registered folders anywhere on the machine — which is exactly what the multi-vault feature needs. The `default.json` capability grants `core:*`, `dialog:*` (open/save/ask) and `window-state` only; no fs-scope gymnastics required.
- **Parsing, querying, rendering, sealing and verification run in the webview** via `@dotit/core` — the Rust side has no parser dependency. The viewer uses `renderPrint`; search uses `parseIntentText` + `parseQuery` + `queryBlocks` + `isSealed`; trust uses the seal/sign/unseal/verify APIs.
- Frontend: `useVaults` (the registry + per-vault trees + federated file set), `useOpenDocument` (open/save/autosave/dirty), `useTrustBadges` (lifecycle glyphs across all vaults); components `VaultSidebar`, `DocumentViewer`, `SearchPanel`, `TrustDialogs`, `StatusBar`.
