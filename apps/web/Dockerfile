FROM node:24 AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
# Skip workspace lifecycle scripts (extension `wxt prepare` needs vite and is unused here)
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts

# Public origin baked into the SPA at build time (e.g. https://track.staradox.com)
ARG VITE_SERVER_URL=http://localhost:3000
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN cd apps/web && bun run build \
  && test -f apps/web/dist/index.html \
  && echo "Vite build OK: $(find apps/web/dist -type f | wc -l) files"

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint-dashboard.sh
RUN chmod +x /docker-entrypoint-dashboard.sh \
  && test -f /usr/share/nginx/html/index.html

EXPOSE 80
# Serves the Vite static build and reverse-proxies /api + /rpc to the server service
CMD ["/docker-entrypoint-dashboard.sh"]
