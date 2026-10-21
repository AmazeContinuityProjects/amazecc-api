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

# GET /api/docs builds the OpenAPI document on the fly: swagger-jsdoc globs
# ./src/app/api/**\/*.ts relative to the working directory and parses the JSDoc
# blocks it finds. Without src/ present that glob matches nothing and the docs
# page renders with zero endpoints, so the source has to ship in the image.
COPY --chown=node:node --from=builder /app/src ./src

# The platform injects the port via the PORT environment variable. The default
# below only applies to a local `docker run` without `-e PORT`; the platform's
# value always takes precedence at runtime because the CMD expands $PORT via
# the shell (exec-form CMD cannot expand variables, so implicit reliance on
# `next start`'s PORT handling is replaced with an explicit `-p` flag).
ENV PORT=3000

# Puts `next` on PATH so the platform's Start Command can be `next start`
# (or `npm start`, which resolves the same binary via package.json).
# NOTE: do NOT use `pnpm start` as the Start Command -- this stage
# deliberately ships without pnpm (see above).
ENV PATH="/app/node_modules/.bin:${PATH}"

USER node

EXPOSE 3000

# Keep this in sync with the platform's Start Command setting: either leave
# the platform Start Command empty (this CMD runs) or set it to `npm start`
# / `next start`. Shell form is required so $PORT expands; `exec` preserves
# signal handling for graceful shutdown.
CMD ["sh", "-c", "echo \"Starting Next.js on 0.0.0.0:${PORT:-3000}\" && exec /app/node_modules/.bin/next start -H 0.0.0.0 -p \"${PORT:-3000}\""]