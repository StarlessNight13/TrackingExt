FROM node:24-slim AS base
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
# Skip workspace lifecycle scripts (extension `wxt prepare` needs vite and is unused here)
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts

ENV SKIP_ENV_VALIDATION=
ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app/apps/server
# Run from source: the tsdown bundle cannot resolve libsql native bindings under Bun's linker
CMD ["bun", "run", "src/index.ts"]
