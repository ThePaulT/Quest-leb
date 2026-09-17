#!/bin/bash
#
# Brings the whole prototype up so a session starts on a working app:
# dependencies installed, PostGIS running with the migrations applied, the ten
# quests seeded, and `next dev` serving on http://localhost:3000.
#
# Written for Claude Code on the web, where each new container starts empty and
# any previously running server is gone. It exits immediately outside that
# environment so it never hijacks a laptop, where you run `npm run dev`
# yourself.
#
# Idempotent by design: every step checks before it acts, so re-running it will
# not recreate a healthy database or start a second server.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(dirname "${BASH_SOURCE[0]}")/../..}" || exit 0

# Laptops opt out: this is for the disposable cloud container only.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "session-start: not a remote container, skipping"
  exit 0
fi

DB_NAME="quest_leb"
DB_PORT="54329"
DB_HOST="/tmp"
DATABASE_URL="postgresql://postgres@localhost/${DB_NAME}?host=${DB_HOST}&port=${DB_PORT}"
DEV_PORT="3000"
LOG_DIR="/tmp/quest-leb-logs"
mkdir -p "$LOG_DIR"

say() { echo "session-start: $*"; }

# 1. Dependencies. `npm install` rather than `ci` so the cached container image
#    can skip the work when nothing changed.
# Compare a hash of the lockfile rather than timestamps: a fresh clone or a
# restored cache can leave package-lock.json newer than node_modules without
# anything having actually changed, which would reinstall on every start.
LOCK_STAMP="node_modules/.quest-leb-lock.sha256"
lock_hash="$(sha256sum package-lock.json 2>/dev/null | cut -d" " -f1)"
if [ ! -d node_modules ] || [ "$(cat "$LOCK_STAMP" 2>/dev/null)" != "$lock_hash" ]; then
  say "installing dependencies"
  if npm install --no-audit --no-fund >"$LOG_DIR/npm-install.log" 2>&1; then
    printf '%s' "$lock_hash" > "$LOCK_STAMP"
  else
    say "npm install FAILED — see $LOG_DIR/npm-install.log"
    exit 0
  fi
else
  say "dependencies already installed"
fi

# 2. Database. scripts/local-db.sh installs PostgreSQL + PostGIS when missing,
#    starts a throwaway cluster and applies every migration. It DROPS and
#    recreates the database, so only call it when there is nothing healthy to
#    keep.
db_healthy() {
  pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 || return 1
  su postgres -c "psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -tAc 'select 1 from quests limit 1'" \
    >/dev/null 2>&1
}

if db_healthy; then
  say "database already up with schema applied"
else
  say "starting database and applying migrations"
  ./scripts/local-db.sh >"$LOG_DIR/db.log" 2>&1 \
    || { say "database setup FAILED — see $LOG_DIR/db.log"; exit 0; }
fi

# 3. Local settings. .env.local is gitignored, so a fresh container has none.
#    ENABLE_INACTIVE_TOGGLE is what makes the ten seeded quests visible: they
#    are all is_active = false until their safety notes are confirmed, and the
#    map would otherwise look empty.
if [ ! -f .env.local ] || ! grep -q "^DATABASE_URL=." .env.local 2>/dev/null; then
  say "writing .env.local"
  [ -f .env.example ] && cp .env.example .env.local || touch .env.local
  {
    echo ""
    echo "# Written by .claude/hooks/session-start.sh for this container."
    echo "DATABASE_URL=${DATABASE_URL}"
    echo "SUPABASE_JWT_SECRET=local-dev-only-not-a-real-secret"
    echo "ENABLE_INACTIVE_TOGGLE=1"
  } >> .env.local
fi

export DATABASE_URL
export ENABLE_INACTIVE_TOGGLE=1

# Also expose it to the session itself, so ad-hoc npm commands just work.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo "export DATABASE_URL='${DATABASE_URL}'"
    echo "export ENABLE_INACTIVE_TOGGLE=1"
  } >> "$CLAUDE_ENV_FILE"
fi

# 4. Seed, but only into an empty table — never clobber work already there.
quest_count=$(su postgres -c "psql -h $DB_HOST -p $DB_PORT -U postgres -d $DB_NAME -tAc 'select count(*) from quests'" 2>/dev/null | tr -d '[:space:]')
if [ "${quest_count:-0}" = "0" ]; then
  say "seeding quests"
  npm run seed >"$LOG_DIR/seed.log" 2>&1 || say "seed FAILED — see $LOG_DIR/seed.log"
else
  say "database already holds ${quest_count} quests"
fi

# 5. Dev server, detached so it outlives this hook.
if curl -sf -o /dev/null -m 2 "http://127.0.0.1:${DEV_PORT}/" 2>/dev/null; then
  say "dev server already serving on ${DEV_PORT}"
else
  say "starting dev server"
  setsid nohup npm run dev >"$LOG_DIR/dev.log" 2>&1 < /dev/null &
  disown 2>/dev/null || true
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null -m 2 "http://127.0.0.1:${DEV_PORT}/" 2>/dev/null && break
    sleep 1
  done
fi

if curl -sf -o /dev/null -m 3 "http://127.0.0.1:${DEV_PORT}/" 2>/dev/null; then
  say "ready — open http://localhost:${DEV_PORT}"
else
  say "dev server did not answer yet — see $LOG_DIR/dev.log"
fi

exit 0
