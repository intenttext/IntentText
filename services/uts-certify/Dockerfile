# syntax=docker/dockerfile:1
#
# UTS certification service — production image (backend for api.uts.qa).
#
# This service depends on the PUBLISHED @dotit/sign + @dotit/core (see
# package.json: "^1.2.0" / "^1.2.4"), NOT on workspace:* — so the image builds
# standalone from this directory alone, without copying the whole monorepo.
# Build context = services/uts-certify.
#
#   docker build -t uts-certify .
#   docker run --env-file .env -p 8787:8787 uts-certify
#
# Multi-stage: a full-deps build stage compiles TypeScript → dist/, then a lean
# runtime stage ships only production deps + dist, running as a non-root user.

# ── 1. Build stage ────────────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# pnpm via corepack (matches the repo's packageManager pin).
RUN corepack enable

# Install ALL deps (incl. devDeps: typescript) against the published @dotit/*.
# No lockfile is copied (this service has none of its own outside the workspace),
# so resolve fresh from the registry.
COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Compile src → dist.
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Prune to production-only deps for the runtime image.
RUN pnpm prune --prod

# ── 2. Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Drop privileges — the bundled "node" user (uid 1000) owns nothing it can write.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node

# Documented port; the service reads PORT from the env (default 8787).
EXPOSE 8787

# Simple health probe against the built-in /health route.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
