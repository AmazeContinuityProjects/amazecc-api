# syntax=docker/dockerfile:1

# Riven builds a repo Dockerfile as-is (it takes precedence over the generated
# Dockerfile.riven), which is what we need here: `canvas` only publishes glibc
# prebuilds, so the generated node:20-alpine (musl) image cannot install it.
# These are the same system libraries CI installs on Ubuntu.

ARG NODE_VERSION=22-bookworm-slim

# ----------------------------------------------------------------- base ------
# pnpm lives here so both build stages can run the package.json scripts.
# Version is pinned to match CI and the `packageManager` field.
FROM node:${NODE_VERSION} AS base
RUN npm install -g pnpm@11.24.0

# ----------------------------------------------------------------- deps ------
FROM base AS deps
WORKDIR /app

# `canvas` is a native module (cairo/pango) and must be compiled from source
# on Linux, so it needs a toolchain plus the cairo/pango headers.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        python3 \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# pnpm-workspace.yaml must be copied here too: it carries the pnpm 11
# `allowBuilds` map that permits canvas's install script to run.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# -------------------------------------------------------------- builder ------
FROM base AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# --------------------------------------------------------------- runner ------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Runtime shared libraries for canvas. The -dev packages above are build-only.
# NB: Debian names the librsvg runtime `librsvg2-2`; `librsvg2-6` is Ubuntu's
# name and does not exist in bookworm.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcairo2 \
        libpango-1.0-0 \
        libjpeg62-turbo \
        libgif7 \
        librsvg2-2 \
        fontconfig \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# No package manager in the runtime image, deliberately. pnpm verifies
# node_modules against the storeDir recorded at install time before every
# `pnpm run`; that install ran as root (/root/.local/share/pnpm) while this
# stage runs as `node` (/home/node/...), so the check fails and pnpm tries to
# purge node_modules -- which aborts on a container with no TTY. Invoking the
# Next binary directly sidesteps that entirely.

# --chown on COPY instead of a recursive `chown -R /app`, which took 151s over
# the pnpm store.
COPY --chown=node:node --from=deps    /app/node_modules   ./node_modules
COPY --chown=node:node --from=builder /app/.next          ./.next
COPY --chown=node:node --from=builder /app/public         ./public
COPY --chown=node:node --from=builder /app/next.config.ts ./next.config.ts
COPY --chown=node:node --from=builder /app/package.json   ./package.json

# `next start` already binds 0.0.0.0 by default and reads the port from the
# PORT environment variable, which is where the platform supplies it. No PORT
# is baked in here on purpose -- hardcoding one would shadow it.

USER node

EXPOSE 3000

# Keep this in sync with the platform's Start Command setting.
CMD ["/app/node_modules/.bin/next", "start"]