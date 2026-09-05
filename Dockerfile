# syntax=docker/dockerfile:1

# osu!dz — one image, one origin, one process.
#
# WHY ONE IMAGE. src/api/client.ts:397 calls the API at the relative path '/api' and
# server/src/session.ts:72 marks the session cookie sameSite 'lax', which a browser will not
# send on a cross-site fetch. A client and an API on two hostnames would log a player in and
# then 401 every request they made. So the bundle and the API ship together and answer on one
# origin, which server/src/index.ts arranges by serving ./public.
#
# WHY ONE PROCESS, AND NEVER TWO. Do not scale this image past a single instance, and do not
# port it to a serverless runtime. server/src/middleware/rateLimit.ts:5 says so itself — the
# limiter is a Map in memory — and repo/allowedCountries.ts:36 and repo/siteSettings.ts hold
# module-level caches dropped only by the process that did the write. On two instances an
# administrator enabling a country on one leaves the other refusing it until restart.
#
# node:22-slim everywhere rather than alpine: the client build pulls native optional
# dependencies (lightningcss, esbuild) and this lockfile was written on Windows, so resolving
# musl variants from it is a gamble the runtime saving does not pay for. The runtime deps
# (express, cors, dotenv, pg) are pure JavaScript.
#
# NOTHING IS COPIED WHOLESALE. Every COPY below names its source, so server/.env cannot enter
# the image even if .dockerignore were lost.

ARG NODE_IMAGE=node:22-slim
ARG PNPM_VERSION=11.24.0

# ── Stage 1 — the client bundle ──────────────────────────────────────────────
FROM ${NODE_IMAGE} AS client
ARG PNPM_VERSION
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# .figma/make/site.json is not decoration — vite.config.ts imports it at config load and the
# build fails without it. .gitignore carries the same warning.
COPY tsconfig.json vite.config.ts index.html ./
COPY .figma ./.figma
COPY src ./src
RUN pnpm run build

# ── Stage 2 — compile the server ─────────────────────────────────────────────
FROM ${NODE_IMAGE} AS server
ARG PNPM_VERSION
WORKDIR /build
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# pnpm-workspace.yaml carries allowBuilds for esbuild, which tsx depends on. Copied so this
# install resolves exactly as it does locally.
COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# THIS BUILD DEPENDS ON .dockerignore EXCLUDING **/*.test.ts, AND WILL FAIL WITHOUT IT.
# server/tsconfig.json includes all of src, the five *.test.ts files there import 'vitest',
# and vitest is a devDependency of the ROOT package, not this one. Locally tsc resolves it by
# walking up to the repo's node_modules; this stage has no parent to walk up to, so the test
# files must not arrive. Verified by building from exactly this file set: with them, five
# TS2307 errors and exit 2; without them, exit 0.
COPY server/tsconfig.json ./
COPY server/src ./src
RUN pnpm run build

# ── Stage 3 — runtime ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ARG PNPM_VERSION
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY server/package.json server/pnpm-lock.yaml server/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# dist/index.js resolves ../public for the bundle, so this layout is what index.ts expects.
# Override with CLIENT_DIST if it ever needs to live elsewhere.
COPY --from=server /build/dist ./dist
COPY --from=client /build/dist ./public

# The migration runner and its SQL, so `docker run ... pnpm run migrate` can bring a fresh
# database up without a second image. Applying them is still deliberate and still the owner's
# call — nothing here runs on boot.
COPY server/migrations ./migrations

# Runs unprivileged. Safe because nothing in server/src writes to disk — no writeFile, no
# mkdir, no createWriteStream anywhere in the tree.
USER node

# Documentation only; the real port comes from PORT or API_PORT at runtime, and a host that
# injects PORT is honoured without changing this line.
EXPOSE 3001

# /api/health is defined at server/src/index.ts:25 and needs no session, so it is a truthful
# liveness signal rather than one that passes while auth is broken. Node 22 has global fetch,
# so this costs no curl in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.API_PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
