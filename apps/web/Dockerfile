FROM node:24 AS builder
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
# Skip workspace lifecycle scripts during install; run wxt prepare explicitly below
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts

# Public origin baked into the SPA at build time (e.g. https://track.staradox.com)
ARG VITE_SERVER_URL=http://localhost:3000
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production

# Dashboard SPA
RUN cd apps/web && bun run build \
  && test -f dist/index.html \
  && echo "Vite build OK: $(find dist -type f | wc -l) files"

# Pack Chromium + Firefox extensions for /downloads/*
# Channel is baked into the content-script bridge so the dashboard can tell
# self-hosted zips apart from store / local-dev installs.
ENV VITE_EXTENSION_CHANNEL=self-hosted
RUN cd apps/extension \
  && bun x wxt prepare \
  && bun run zip \
  && bun run zip:firefox \
  && mkdir -p /app/apps/web/dist/downloads \
  && cp .output/*-chrome.zip /app/apps/web/dist/downloads/trackingext-chromium.zip \
  && cp .output/*-firefox.zip /app/apps/web/dist/downloads/trackingext-firefox.zip \
  && bun -e 'const {version}=require("./package.json"); const fs=require("fs"); fs.writeFileSync("/app/apps/web/dist/downloads/extension-version.json", JSON.stringify({version, channel:"self-hosted", builtAt:new Date().toISOString()}, null, 2));' \
  && test -f /app/apps/web/dist/downloads/trackingext-chromium.zip \
  && test -f /app/apps/web/dist/downloads/trackingext-firefox.zip \
  && test -f /app/apps/web/dist/downloads/extension-version.json \
  && ls -lh /app/apps/web/dist/downloads

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker-entrypoint.sh /docker-entrypoint-dashboard.sh
RUN chmod +x /docker-entrypoint-dashboard.sh \
  && test -f /usr/share/nginx/html/index.html \
  && test -f /usr/share/nginx/html/downloads/trackingext-chromium.zip \
  && test -f /usr/share/nginx/html/downloads/trackingext-firefox.zip \
  && test -f /usr/share/nginx/html/downloads/extension-version.json

EXPOSE 80
# Serves SPA + extension zips; reverse-proxies /api + /rpc to the server service
CMD ["/docker-entrypoint-dashboard.sh"]
