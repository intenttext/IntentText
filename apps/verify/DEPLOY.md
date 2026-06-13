# Deploying verify.uts.qa

This is a 100% static, client-side app (no backend, no env vars). It verifies
`.it` documents entirely in the browser.

## Vercel

In the Vercel project settings:
- **Root Directory:** `apps/verify`
- **Framework Preset:** Vite
- Install/Build are taken from `vercel.json` here (they `cd` to the monorepo root
  and build `@dotit/core` + `@dotit/sign` first, then this app, via
  `pnpm --filter @dotit/verify-portal... build`). Output is `apps/verify/dist`.

Alternatively (Root Directory = repo root): build `pnpm --filter
@dotit/verify-portal... build`, output `apps/verify/dist`.

## Any static host / CDN

```bash
pnpm --filter @dotit/verify-portal... build   # from repo root
# serve apps/verify/dist/ — it's plain HTML/CSS/JS, single route
```

The app makes **no network calls** — point a catch-all to `index.html` and you're
done. The dropped/pasted `.it` file never leaves the browser.
