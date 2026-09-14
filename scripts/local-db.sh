#!/usr/bin/env bash
# Apply supabase/migrations/ to a throwaway local PostGIS cluster.
#
# Use `supabase start` when Docker is available — it gives you the real stack
# (PostgREST, GoTrue, Storage). This script is the fallback for Docker-less
# environments: it only gives you the database, plus the shim in supabase/dev/.
#
#   ./scripts/local-db.sh            # create cluster, apply everything
#   ./scripts/local-db.sh --reset    # tear the cluster down first
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-${TMPDIR:-/tmp}/quest-leb-pgdata}"

# Postgres refuses to run as root. In root containers (CI, agent sandboxes) hop
# to the `postgres` system user that the server package creates.
if [[ "$(id -u)" -eq 0 && "${QUEST_DB_REEXEC:-}" != "1" ]]; then
  install -d -o postgres -g postgres "$(dirname "$PGDATA")" 2>/dev/null || true
  exec su postgres -c "QUEST_DB_REEXEC=1 PGBIN=$PGBIN PGDATA=$PGDATA PGPORT=${PGPORT:-54329} PGHOST=${PGHOST:-/tmp} DB=${DB:-quest_leb} bash $ROOT/scripts/local-db.sh ${*:-}"
fi
PGPORT="${PGPORT:-54329}"
PGHOST="${PGHOST:-/tmp}"
DB="${DB:-quest_leb}"
export PGHOST PGPORT

if [[ "${1:-}" == "--reset" ]]; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$PGDATA"
fi

if [[ ! -d "$PGDATA" ]]; then
  "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust >/dev/null
fi

if ! "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PGPORT -k $PGHOST -c listen_addresses=''" -w start >/dev/null
fi

psql -U postgres -d postgres -qtAc "drop database if exists $DB" >/dev/null
psql -U postgres -d postgres -qtAc "create database $DB" >/dev/null

psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/dev/00_supabase_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"
done

URL="postgresql://postgres@localhost/$DB?host=$PGHOST&port=$PGPORT"
echo
echo "ready: psql -h $PGHOST -p $PGPORT -U postgres -d $DB"
echo
echo "export DATABASE_URL='$URL'"
