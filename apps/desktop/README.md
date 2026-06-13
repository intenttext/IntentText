# Dotit Desktop

> **Experimental** — not part of the supported IntentText v4 release surface. The canonical implementation is `@dotit/core`. This app builds against the core but carries no stability or support promise.

Enterprise document manager for `.it` files, built with [Tauri](https://tauri.app/) v2 + React. The editing surface is the embeddable [`@dotit/editor`](../../packages/editor) WYSIWYG (ribbon, Word-like pages, trust banner); the desktop shell adds everything a document manager needs around it.

## Features

- **Document library** — choose a workspace folder; the sidebar shows a live tree of `.it` files (filesystem watcher keeps it fresh) with create / rename / delete (to trash) and recent files. The last workspace is restored on launch.
- **Workspace search** — a search panel over the whole workspace powered by the core query engine: structured filters (`type=task status=open owner:contains=sara due<2026-07-01 field?`) mixed with free text; grouped results open the file on click.
- **Trust operations** — Track / Approve / Sign / **Seal** / **Verify** from the native Trust menu, the editor ribbon, or shortcuts. Sealing uses `@dotit/core`'s cryptographic seal; sealed documents become read-only. Library rows show lifecycle badges (tracked / approved / signed / sealed), computed lazily and cached by mtime.
- **WYSIWYG editing** — `<IntentTextEditor>` with autosave to disk (debounced) and a dirty indicator; `⌘E` toggles a plain-text source view. WYSIWYG PDF / HTML export via the File menu.
- **Native feel** — real OS menu bar (File / Edit / View / Trust / Window) wired to the same actions, window title shows `• filename`, `.it` file association, window-state restore, and dark mode follows the OS.

### Keyboard shortcuts

`⌘N` new · `⌘O` open · `⇧⌘O` open workspace · `⌘S` save · `⇧⌘S` save as · `⌘P` export PDF · `⌘B` toggle library · `⇧⌘F` search workspace · `⌘E` source view · `⇧⌘G` sign · `⇧⌘L` seal · `⇧⌘V` verify

## Development

```bash
pnpm install            # from the repo root
pnpm --filter @dotit/editor build   # build the editor package once
pnpm --filter intenttext-desktop tauri:dev
```

`pnpm --filter intenttext-desktop dev` runs the web layer alone (no file access without the Tauri shell).

## Build

```bash
pnpm --filter intenttext-desktop build        # typecheck + vite build (web layer)
pnpm --filter intenttext-desktop tauri:build  # native installers
```

## Architecture notes

- All filesystem access goes through small std-only Rust commands (`src-tauri/src/commands/{fs,workspace}.rs`): read/write/rename/trash, recursive workspace listing, and a `notify`-based watcher that emits `file-created/modified/deleted` events.
- Parsing, querying, sealing and verification run in the webview via `@dotit/core` — the Rust side has no parser dependency.
- The former in-app Monaco/tiptap editor copies were removed in 2.0; the visual editor is consumed from `@dotit/editor`.
