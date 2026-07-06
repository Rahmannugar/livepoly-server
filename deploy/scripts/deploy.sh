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
secret_id="${LIVEPOLY_SECRET_ID:-livepoly}"
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
new_relic_infra_enabled="$(
  awk -F= '$1=="NEW_RELIC_INFRA_ENABLED"{gsub(/^"|"$/,"",$2); print $2}' .env \
    | tail -n 1
)"
api_domain="$(
  awk -F= '$1=="API_DOMAIN"{gsub(/^"|"$/,"",$2); print $2}' .env \
    | tail -n 1
)"
api_domain="${api_domain:-api.livepoly.site}"

service_container_id() {
  "${compose[@]}" ps -q "$1" | tail -n 1
}

is_service_running() {
  local service="$1"
  local container_id

  container_id="$(service_container_id "$service")"
  if [[ -z "$container_id" ]]; then
    return 1
  fi

  [[ "$(docker inspect --format '{{.State.Running}}' "$container_id" 2>/dev/null)" == "true" ]]
}

wait_for_service_healthy() {
  local service="$1"
  local container_id
  local health_status

  echo "Waiting for ${service} to become healthy"

  for attempt in {1..40}; do
    container_id="$(service_container_id "$service")"
    if [[ -n "$container_id" ]]; then
      health_status="$(
        docker inspect \
          --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{if .State.Running}}running{{else}}stopped{{end}}{{end}}' \
          "$container_id" 2>/dev/null || true
      )"

      if [[ "$health_status" == "healthy" || "$health_status" == "running" ]]; then
        return 0
      fi
    fi

    if [[ "$attempt" -eq 40 ]]; then
      "${compose[@]}" ps
      "${compose[@]}" logs --tail=100 "$service"
      echo "Service ${service} did not become healthy" >&2
      exit 1
    fi

    sleep 3
  done
}

reload_nginx_if_running() {
  if is_service_running nginx; then
    echo "Reloading nginx"
    "${compose[@]}" exec -T nginx nginx -s reload
  fi
}

roll_api_service() {
  local service="$1"

  echo "Rolling ${service}"
  "${compose[@]}" up -d --no-deps --force-recreate "$service"
  wait_for_service_healthy "$service"
  reload_nginx_if_running
}

wait_for_public_readiness() {
  echo "Checking public readiness"

  for attempt in {1..20}; do
    if curl --fail --silent --show-error \
      --header "Host: ${api_domain}" \
      http://127.0.0.1/health/ready >/dev/null; then
      return 0
    fi

    if [[ "$attempt" -eq 20 ]]; then
      "${compose[@]}" ps
      "${compose[@]}" logs --tail=100 api-1 api-2 nginx
      echo "Deployment did not become ready" >&2
      exit 1
    fi

    sleep 3
  done
}

echo "Building production images"
"${compose[@]}" build api-1 pgbouncer

echo "Starting data services"
"${compose[@]}" up -d --remove-orphans postgres redis pgbouncer
wait_for_service_healthy postgres
wait_for_service_healthy redis
wait_for_service_healthy pgbouncer

echo "Running migrations"
"${compose[@]}" --profile tools run --rm migrate

roll_api_service api-1
roll_api_service api-2

echo "Ensuring nginx is running"
"${compose[@]}" up -d --no-deps nginx
wait_for_service_healthy nginx

echo "Restarting worker"
"${compose[@]}" up -d --no-deps --force-recreate worker
wait_for_service_healthy worker

if [[ "$new_relic_infra_enabled" == "true" ]]; then
  echo "Ensuring New Relic infrastructure agent is running"
  "${compose[@]}" --profile monitoring up -d --no-deps newrelic-infra
else
  echo "Stopping New Relic infrastructure agent because it is disabled"
  "${compose[@]}" --profile monitoring stop newrelic-infra >/dev/null 2>&1 || true
fi

wait_for_public_readiness
ln -sfn "$release_dir" "${deployment_root}/current"

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
