#!/usr/bin/env bash
set -Eeuo pipefail

deployment_root="${LIVEPOLY_DEPLOYMENT_ROOT:-/opt/livepoly}"
current_release="${deployment_root}/current"
backup_dir="${deployment_root}/backups"
secret_id="${LIVEPOLY_SECRET_ID:-livepoly}"
aws_region="${AWS_REGION:-eu-west-1}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="livepoly-${timestamp}.dump"
backup_path="${backup_dir}/${backup_name}"

mkdir -p "$backup_dir"

secret_json="$(aws secretsmanager get-secret-value \
  --region "$aws_region" \
  --secret-id "$secret_id" \
  --query SecretString \
  --output text)"
backup_s3_uri="$(jq -er '.BACKUP_S3_URI' <<<"$secret_json")"

cd "$current_release"
compose=(docker compose --env-file .env -f deploy/docker-compose.production.yml)

"${compose[@]}" exec -T postgres sh -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > "$backup_path"

if [[ ! -s "$backup_path" ]]; then
  echo "PostgreSQL backup is empty" >&2
  exit 1
fi

aws s3 cp "$backup_path" "${backup_s3_uri%/}/${backup_name}" \
  --region "$aws_region" \
  --only-show-errors

s3_location="${backup_s3_uri#s3://}"
s3_bucket="${s3_location%%/*}"
s3_prefix="${s3_location#*/}"
if [[ "$s3_prefix" == "$s3_location" ]]; then
  s3_prefix=""
fi
s3_key="${s3_prefix:+${s3_prefix%/}/}${backup_name}"

aws s3api head-object \
  --region "$aws_region" \
  --bucket "$s3_bucket" \
  --key "$s3_key" >/dev/null

mapfile -t stale_local_backups < <(
  find "$backup_dir" -maxdepth 1 -type f -name 'livepoly-*.dump' -printf '%T@ %p\n' \
    | sort -rn \
    | tail -n +4 \
    | cut -d' ' -f2-
)
for stale_backup in "${stale_local_backups[@]}"; do
  rm -f -- "$stale_backup"
done

mapfile -t remote_keys < <(
  aws s3api list-objects-v2 \
    --region "$aws_region" \
    --bucket "$s3_bucket" \
    --prefix "${s3_prefix:+${s3_prefix%/}/}livepoly-" \
    --query 'reverse(sort_by(Contents, &LastModified))[].Key' \
    --output text \
    | tr '\t' '\n'
)

for stale_key in "${remote_keys[@]:3}"; do
  [[ -n "$stale_key" && "$stale_key" != "None" ]] || continue
  aws s3api delete-object \
    --region "$aws_region" \
    --bucket "$s3_bucket" \
    --key "$stale_key" >/dev/null
done

echo "Created and verified ${backup_name}"
