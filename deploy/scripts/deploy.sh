#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <git-commit-sha>" >&2
  exit 64
fi

commit_sha="$1"
deployment_root="${LIVEPOLY_DEPLOYMENT_ROOT:-/opt/livepoly}"
repository_dir="${LIVEPOLY_REPOSITORY_DIR:-${deployment_root}/repository}"
releases_dir="${deployment_root}/releases"
release_dir="${releases_dir}/${commit_sha}"
secret_id="${LIVEPOLY_SECRET_ID:-livepoly/server}"
aws_region="${AWS_REGION:-eu-west-1}"

mkdir -p "$releases_dir"

if ! git -C "$repository_dir" cat-file -e "${commit_sha}^{commit}"; then
  echo "Commit ${commit_sha} is not present in ${repository_dir}" >&2
  exit 1
fi

if [[ ! -d "$release_dir" ]]; then
  temporary_release="$(mktemp -d "${releases_dir}/.${commit_sha}.XXXXXX")"
  trap 'rm -rf "${temporary_release:-}"' EXIT

  git -C "$repository_dir" archive "$commit_sha" | tar -x -C "$temporary_release"

  secret_json="$(aws secretsmanager get-secret-value \
    --region "$aws_region" \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text)"

  if ! jq -e 'type == "object"' >/dev/null <<<"$secret_json"; then
    echo "Secret ${secret_id} must contain a JSON object" >&2
    exit 1
  fi

  if ! jq -e 'all(.[]; (tostring | contains("\n") | not))' >/dev/null <<<"$secret_json"; then
    echo "Secret values cannot contain newline characters" >&2
    exit 1
  fi

  jq -r 'to_entries[] | "\(.key)=\(.value | tostring | @json)"' \
    <<<"$secret_json" > "${temporary_release}/.env"
  chmod 600 "${temporary_release}/.env"

  mv "$temporary_release" "$release_dir"
  trap - EXIT
fi

cd "$release_dir"
export IMAGE_TAG="$commit_sha"

compose=(docker compose --env-file .env -f deploy/docker-compose.production.yml)

"${compose[@]}" build api-1 pgbouncer
"${compose[@]}" up -d postgres redis pgbouncer
"${compose[@]}" --profile tools run --rm migrate
"${compose[@]}" up -d --remove-orphans api-1 api-2 worker nginx

for attempt in {1..20}; do
  if curl --fail --silent --show-error \
    --header 'Host: api.livepoly.site' \
    http://127.0.0.1/api/health/ready >/dev/null; then
    ln -sfn "$release_dir" "${deployment_root}/current"
    break
  fi

  if [[ "$attempt" -eq 20 ]]; then
    "${compose[@]}" ps
    "${compose[@]}" logs --tail=100 api-1 api-2 nginx
    echo "Deployment did not become ready" >&2
    exit 1
  fi

  sleep 3
done

mapfile -t stale_releases < <(
  find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -rn \
    | tail -n +4 \
    | cut -d' ' -f2-
)

for stale_release in "${stale_releases[@]}"; do
  rm -rf -- "$stale_release"
done

docker image prune --force --filter 'until=168h' >/dev/null
echo "Deployed ${commit_sha}"
