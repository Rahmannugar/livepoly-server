#!/usr/bin/env bash
set -Eeuo pipefail

deployment_root="${LIVEPOLY_DEPLOYMENT_ROOT:-/opt/livepoly}"
current_release="${deployment_root}/current"

if [[ ! -d "$current_release" ]]; then
  echo "Current LivePoly release does not exist" >&2
  exit 1
fi

cd "$current_release"
compose=(docker compose --env-file .env -f deploy/docker-compose.production.yml)

certificate_mtime() {
  "${compose[@]}" exec -T nginx sh -c \
    'stat -L -c %Y "/etc/letsencrypt/live/${API_DOMAIN}/fullchain.pem"'
}

before_mtime="$(certificate_mtime)"

"${compose[@]}" --profile tools run --rm certbot renew \
  --no-random-sleep-on-renew

after_mtime="$(certificate_mtime)"

if [[ "$before_mtime" == "$after_mtime" ]]; then
  echo "No LivePoly certificate was due for renewal"
  exit 0
fi

"${compose[@]}" exec -T nginx nginx -s reload
echo "Renewed the LivePoly certificate and reloaded Nginx"
