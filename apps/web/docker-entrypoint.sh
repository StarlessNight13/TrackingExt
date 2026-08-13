#!/bin/sh
set -eu

html_root=/usr/share/nginx/html

echo "Dashboard: verifying Vite static build in ${html_root}"
if [ ! -f "${html_root}/index.html" ]; then
  echo "Dashboard: ERROR — index.html missing. The web image did not receive a Vite build."
  ls -la "${html_root}" || true
  exit 1
fi

for zip in trackingext-chromium.zip trackingext-firefox.zip; do
  if [ ! -f "${html_root}/downloads/${zip}" ]; then
    echo "Dashboard: ERROR — missing extension package /downloads/${zip}"
    ls -la "${html_root}/downloads" || true
    exit 1
  fi
done

if [ ! -f "${html_root}/downloads/extension-version.json" ]; then
  echo "Dashboard: ERROR — missing /downloads/extension-version.json"
  ls -la "${html_root}/downloads" || true
  exit 1
fi

file_count="$(find "${html_root}" -type f | wc -l | tr -d ' ')"
echo "Dashboard: static files ready (${file_count} files)"
echo "Dashboard: extension packages ready under /downloads/"
echo "Dashboard: package version $(cat "${html_root}/downloads/extension-version.json")"
echo "Dashboard: nginx listening inside the container on port 80"
echo "Dashboard: reachable only via Docker networks (dokploy-network) — no host port bind"
echo "Dashboard ready on container port 80"

exec nginx -g "daemon off;"
