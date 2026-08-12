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
echo "Dashboard: binding HTTP on 0.0.0.0:80"
echo "Dashboard ready: http://0.0.0.0:80"

exec nginx -g "daemon off;"
