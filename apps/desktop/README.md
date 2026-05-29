# Dotit Desktop

Native desktop editor for `.it` documents, powered by the IntentText core.

Canonical language and API documentation lives in `intenttext-docs` (published at `https://itdocs.vercel.app`).

Built with [Tauri](https://tauri.app/) v2, React, and Monaco Editor. Opens `.it` files natively on macOS, Windows, and Linux.

## Development

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

Produces native installers for each platform.
