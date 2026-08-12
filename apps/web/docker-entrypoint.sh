#!/bin/sh
set -eu

html_root=/usr/share/nginx/html

echo "Dashboard: verifying Vite static build in ${html_root}"
if [ ! -f "${html_root}/index.html" ]; then
  echo "Dashboard: ERROR — index.html missing. The web image did not receive a Vite build."
  ls -la "${html_root}" || true
  exit 1
fi

file_count="$(find "${html_root}" -type f | wc -l | tr -d ' ')"
echo "Dashboard: static files ready (${file_count} files)"
echo "Dashboard: nginx listening inside the container on port 80"
echo "Dashboard: reachable only via Docker networks (dokploy-network) — no host port bind"
echo "Dashboard ready on container port 80"

exec nginx -g "daemon off;"
