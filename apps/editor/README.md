# Dotit Web

Dotit Web is the browser editor experience for `.it` documents, built on `@intenttext/core`.

Canonical language and API documentation lives in `intenttext-docs` (published at `https://itdocs.vercel.app`).

The app includes:

- Source mode (Monaco) for precise text editing
- Visual mode (TipTap) for document-style authoring
- Live document parsing, stats, trust actions, and print/export helpers

## Core Alignment

This editor is aligned with the core `3.1.x` direction:

- Rust-first core runtime
- Frozen canonical keyword contract (insert UX driven by core registry)
- Canonical-first behavior in status/help and visual insertion flows

## Run Locally

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Tech Stack

- React + TypeScript + Vite
- Monaco Editor
- TipTap visual editing surface
- `@intenttext/core`

## Desktop Direction

This app is being prepared as a showcase-grade UI foundation for a future Tauri desktop packaging flow.

## License

MIT
