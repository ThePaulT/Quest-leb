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
  # Only the data directory itself may belong to postgres. Never chown its
  # parent: PGDATA normally lives under /tmp, and handing /tmp to postgres
  # breaks every other user on the box.
  mkdir -p "$PGDATA" 2>/dev/null || true
  chown postgres:postgres "$PGDATA" 2>/dev/null || true
  exec su postgres -c "QUEST_DB_REEXEC=1 PGBIN=$PGBIN PGDATA=$PGDATA PGPORT=${PGPORT:-54329} PGHOST=${PGHOST:-/tmp} DB=${DB:-quest_leb} bash $ROOT/scripts/local-db.sh ${*:-}"
fi
PGPORT="${PGPORT:-54329}"
PGHOST="${PGHOST:-/tmp}"
DB="${DB:-quest_leb}"
export PGHOST PGPORT

# A fresh container has no Postgres at all. Install it rather than failing with
# a bare "no such file", since this script exists precisely for machines that
# cannot run Docker.
if [[ ! -x "$PGBIN/initdb" ]]; then
  if [[ "$(id -u)" -eq 0 ]] && command -v apt-get >/dev/null 2>&1; then
    echo "PostgreSQL 16 + PostGIS not found at $PGBIN — installing..."
    apt-get update -qq >/dev/null
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      postgresql-16 postgresql-16-postgis-3 >/dev/null
    echo "installed."
  else
    echo "error: PostgreSQL 16 with PostGIS is not installed at $PGBIN." >&2
    echo "  Debian/Ubuntu: apt-get install -y postgresql-16 postgresql-16-postgis-3" >&2
    echo "  macOS:         brew install postgresql@16 postgis" >&2
    echo "  Or set PGBIN to an existing PostGIS-enabled Postgres 16 install." >&2
    exit 1
  fi
fi

# Stop whatever is serving our port, even when it no longer owns a readable
# PGDATA. pg_ctl cannot stop a postmaster whose data directory has been deleted
# out from under it, and that orphan keeps the socket lock — which makes every
# later start fail with "lock file already exists".
stop_cluster() {
  "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true

  local lock="$PGHOST/.s.PGSQL.$PGPORT.lock"
  if [[ -f "$lock" ]]; then
    local pid
    pid="$(head -n 1 "$lock" 2>/dev/null || true)"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null &&
       ps -o comm= -p "$pid" 2>/dev/null | grep -q postgres; then
      kill -TERM "$pid" 2>/dev/null || true
      for _ in $(seq 1 50); do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.1
      done
      kill -KILL "$pid" 2>/dev/null || true
    fi
    rm -f "$lock" "$PGHOST/.s.PGSQL.$PGPORT"
  fi
}

if [[ "${1:-}" == "--reset" ]]; then
  stop_cluster
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
