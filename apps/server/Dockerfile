FROM node:24-slim AS base
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
# Skip workspace lifecycle scripts (extension `wxt prepare` needs vite and is unused here)
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts

RUN chmod +x /app/apps/server/docker-entrypoint.sh

ENV SKIP_ENV_VALIDATION=
ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app/apps/server
# Entrypoint pushes Drizzle schema (creates tables) then starts the API
CMD ["/app/apps/server/docker-entrypoint.sh"]
