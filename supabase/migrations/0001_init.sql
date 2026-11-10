-- ============================================================
-- Highball — the global tree planters' board
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---------- terrain multipliers ----------
-- Kept as a function so the Gnar view and any future report agree
-- on one set of numbers. Mirrored in src/lib/gnar.js for labels.
create or replace function terrain_factor(code text)
returns numeric
language sql
immutable
as $$
  select case code
    when 'cream'  then 1.00
    when 'block'  then 1.25
    when 'slash'  then 1.50
    when 'burn'   then 1.75
    when 'alpine' then 2.00
    else 1.00
  end;
$$;

-- ---------- planters ----------
create table if not exists planters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  handle      text not null,
  base        text not null,
  country     text,
  crew        text,
  seasons     int  not null default 0 check (seasons >= 0 and seasons <= 60),
  prior_trees bigint not null default 0 check (prior_trees >= 0 and prior_trees <= 20000000),
  tagline     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint one_profile_per_person unique (user_id),
  constraint handle_length check (char_length(handle) between 2 and 24),
  constraint tagline_length check (tagline is null or char_length(tagline) <= 90)
);

-- Camp names are unique regardless of casing: no second "Ditchpig".
create unique index if not exists planters_handle_key on planters (lower(handle));
create index if not exists planters_user_idx on planters (user_id);

-- ---------- days ----------
create table if not exists days (
  id         uuid primary key default gen_random_uuid(),
  planter_id uuid not null references planters(id) on delete cascade,
  date       date not null,
  trees      int  not null check (trees > 0 and trees <= 12000),
  terrain    text not null check (terrain in ('cream','block','slash','burn','alpine')),
  block      text,
  notes      text,
  created_at timestamptz not null default now(),
  constraint one_entry_per_day unique (planter_id, date),
  constraint not_in_the_future check (date <= (now() at time zone 'utc')::date + 1),
  constraint block_length check (block is null or char_length(block) <= 40),
  constraint notes_length check (notes is null or char_length(notes) <= 90)
);

create index if not exists days_planter_idx on days (planter_id, date desc);

-- ---------- the board ----------
-- Gnar is computed here so sorting happens in Postgres, not the browser.
create or replace view board with (security_invoker = on) as
select
  p.id,
  p.user_id,
  p.handle,
  p.base,
  p.country,
  p.crew,
  p.seasons,
  p.prior_trees,
  p.tagline,
  p.created_at,
  coalesce(d.logged, 0)                                as logged_trees,
  p.prior_trees + coalesce(d.logged, 0)                as career_trees,
  coalesce(d.season_trees, 0)                          as season_trees,
  coalesce(d.best_day, 0)                              as best_day,
  round(coalesce(d.avg_day, 0))::int                   as avg_day,
  coalesce(d.day_count, 0)                             as day_count,
  round(coalesce(d.ground_factor, 1), 2)               as ground_factor,
  greatest(0, round(
      coalesce(d.best_day, 0) / 50.0
    + sqrt((p.prior_trees + coalesce(d.logged, 0)) / 1000.0) * 3
    + p.seasons * 6
    + (coalesce(d.ground_factor, 1) - 1) * 60
    + coalesce(d.avg_day, 0) / 60.0
  ))::int                                              as gnar
from planters p
left join (
  select
    planter_id,
    sum(trees)                                                   as logged,
    sum(trees) filter (
      where extract(year from date) = extract(year from current_date)
    )                                                            as season_trees,
    max(trees)                                                   as best_day,
    avg(trees)                                                   as avg_day,
    count(*)                                                     as day_count,
    sum(trees * terrain_factor(terrain))
      / nullif(sum(trees), 0)                                    as ground_factor
  from days
  group by planter_id
) d on d.planter_id = p.id;

-- ---------- row level security ----------
-- The board is public to read. Writing is limited to your own row,
-- enforced by the database rather than by the interface.
alter table planters enable row level security;
alter table days     enable row level security;

drop policy if exists "planters are public" on planters;
create policy "planters are public"
  on planters for select
  using (true);

drop policy if exists "insert own planter" on planters;
create policy "insert own planter"
  on planters for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own planter" on planters;
create policy "update own planter"
  on planters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own planter" on planters;
create policy "delete own planter"
  on planters for delete
  using (auth.uid() = user_id);

drop policy if exists "days are public" on days;
create policy "days are public"
  on days for select
  using (true);

drop policy if exists "insert own days" on days;
create policy "insert own days"
  on days for insert
  with check (
    exists (select 1 from planters p where p.id = planter_id and p.user_id = auth.uid())
  );

drop policy if exists "update own days" on days;
create policy "update own days"
  on days for update
  using (
    exists (select 1 from planters p where p.id = planter_id and p.user_id = auth.uid())
  );

drop policy if exists "delete own days" on days;
create policy "delete own days"
  on days for delete
  using (
    exists (select 1 from planters p where p.id = planter_id and p.user_id = auth.uid())
  );

-- ---------- housekeeping ----------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planters_touch on planters;
create trigger planters_touch
  before update on planters
  for each row execute function touch_updated_at();
