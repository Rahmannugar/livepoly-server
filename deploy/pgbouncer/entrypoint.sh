#!/bin/sh
set -eu

: "${POSTGRES_HOST:?POSTGRES_HOST is required}"
: "${POSTGRES_PORT:?POSTGRES_PORT is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

escaped_user=$(printf '%s' "$POSTGRES_USER" | sed 's/\\/\\\\/g; s/"/\\"/g')
escaped_password=$(printf '%s' "$POSTGRES_PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')

printf '"%s" "%s"\n' "$escaped_user" "$escaped_password" > /etc/pgbouncer/userlist.txt
envsubst < /etc/pgbouncer/pgbouncer.ini.template > /etc/pgbouncer/pgbouncer.ini

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
