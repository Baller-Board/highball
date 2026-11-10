-- ============================================================
-- Highball — 0002: tighten the rules the database enforces
-- Run after 0001_init.sql. Safe to run on a live board: new
-- constraints are added NOT VALID, so existing rows are left alone
-- and only new writes are checked.
-- ============================================================

-- ---------- text limits ----------
-- The form caps these, but anyone can call the API directly. Without a
-- database limit a single profile could hold megabytes of text.
alter table planters drop constraint if exists base_length;
alter table planters add constraint base_length
  check (char_length(base) between 1 and 40) not valid;

alter table planters drop constraint if exists country_length;
alter table planters add constraint country_length
  check (country is null or char_length(country) <= 30) not valid;

alter table planters drop constraint if exists crew_length;
alter table planters add constraint crew_length
  check (crew is null or char_length(crew) <= 40) not valid;

-- Camp names end up in URLs (/p/<handle>). No leading or trailing spaces,
-- no control characters, nothing that breaks or confuses a link.
alter table planters drop constraint if exists handle_clean;
alter table planters add constraint handle_clean
  check (handle = btrim(handle) and handle !~ '[[:cntrl:]/\\%?#]') not valid;

-- ---------- dates ----------
-- Without a floor, someone could log a 12,000 day for every date back to
-- 1900 and post a fake career of hundreds of millions of trees.
alter table days drop constraint if exists not_ancient;
alter table days add constraint not_ancient
  check (date >= date '1990-01-01') not valid;

-- ---------- functions ----------
-- Pin search_path so the functions can't be redirected to look-alike
-- objects in another schema (Supabase's security advisor flags this).
alter function terrain_factor(text) set search_path = public;
alter function touch_updated_at() set search_path = public;
