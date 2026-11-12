#!/usr/bin/env bash
# Rebuilds supabase/setup_all.sql from the migrations, for one-paste setup.
set -euo pipefail
cd "$(dirname "$0")/.."
{ echo "-- Highball: complete database setup. Paste all of this into Supabase's SQL editor and Run."
  echo "-- Generated from supabase/migrations/ by scripts/build-setup.sh. Edit those files, not this one."
  for f in supabase/migrations/*.sql; do echo; echo "-- >>> $f"; cat "$f"; done
} > supabase/setup_all.sql
