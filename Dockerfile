# syntax=docker/dockerfile:1
# API image for the Render free web service (R11, D77). Local development does not use it.
# Build: docker build -t notalah-api .   Run: docker run --env-file <prod env> -p 4000:4000 notalah-api

ARG VP_IMAGE=ghcr.io/voidzero-dev/vite-plus:1.3.0@sha256:61860c1b58bf35878605280802809973c668f1594675298c3be553a98ac06e59

# --- build: the Vite+ toolchain image builds @notalah/shared and the server ---
FROM ${VP_IMAGE} AS build
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY --chown=vp:vp shared/package.json shared/
COPY --chown=vp:vp server/package.json server/
COPY --chown=vp:vp client/package.json client/
# Root (toolchain) + server and its workspace deps only; scripts off because the root `prepare` needs the sources.
RUN vp install --frozen-lockfile --ignore-scripts --filter notalah --filter 'server...'
COPY --chown=vp:vp vite.config.ts ./
COPY --chown=vp:vp shared shared
COPY --chown=vp:vp server server
RUN vp run server#build && cp "$(vp env which node | head -1)" /tmp/node

# --- deps: a fresh production-only install, so no dev dependency (vite-plus, dbmate, tsx) reaches the runtime ---
FROM ${VP_IMAGE} AS deps
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml .node-version ./
COPY --chown=vp:vp shared/package.json shared/
COPY --chown=vp:vp server/package.json server/
COPY --chown=vp:vp client/package.json client/
RUN vp install --frozen-lockfile --prod --ignore-scripts --filter 'server...'

# --- runtime: slim Debian with the exact Node from .node-version, plus ffmpeg for the video worker (D67) ---
FROM debian:trixie-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /tmp/node /usr/local/bin/node
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/shared/package.json ./shared/
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
WORKDIR /app/server
ENV NODE_ENV=production PORT=4000
USER nobody
EXPOSE 4000
# Liveness only (D81): /api/health never queries Postgres.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
