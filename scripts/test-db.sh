#!/usr/bin/env bash
# Applies every migration to a scratch database and runs the rule checks.
# Needs a local Postgres you can connect to as a superuser. Point it with
# the usual PG* variables, e.g. PGHOST=/tmp PGPORT=5432 PGUSER=postgres.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="highball_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -c 'set client_min_messages = warning' -f "$f" >/dev/null
done
# The new migrations must survive being run twice (someone always does).
for f in supabase/migrations/000[23]*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -c 'set client_min_messages = warning' -f "$f" >/dev/null
done
psql -q -t -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rules_test.sql 2>&1 | grep -E "ok |FAIL|ERROR|passed" | sed "s/^psql:[^ ]* NOTICE:  //"
