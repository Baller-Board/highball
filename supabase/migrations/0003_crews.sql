-- ============================================================
-- Highball — 0003: crews and crew verification
-- Run after 0002_hardening.sql.
--
-- How it fits together:
--   1. Anyone signed in can register a crew. It starts as "pending" and
--      stays off the public crew list until a Highball admin approves it.
--      That approval is the trust anchor: it's how "Brinkman" on the board
--      means the real company and not someone's mate.
--   2. Planters ask to join a crew. The crew's owner or checkers accept.
--   3. Owners and checkers go through their members' logged days and mark
--      each one verified or disputed. Planters can't set those marks
--      themselves, and editing a verified day wipes its mark.
--   4. The board shows each planter's verified share, and a planter whose
--      days are mostly crew-verified gets the "Crew verified" badge.
--
-- Make yourself an admin by running this once in the SQL editor, with
-- the email you sign in with:
--   insert into site_admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ============================================================

-- ---------- site admins ----------
create table if not exists site_admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table site_admins enable row level security;

drop policy if exists "admins can see themselves" on site_admins;
create policy "admins can see themselves"
  on site_admins for select
  using (user_id = auth.uid());
-- No write policies: admins are added from the SQL editor only.

create or replace function is_site_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from site_admins where user_id = auth.uid());
$$;

-- ---------- crews ----------
create table if not exists crews (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  name        text not null,
  base        text,
  country     text,
  website     text,
  about       text,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected')),
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint crew_slug_shape   check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  constraint crew_name_length  check (char_length(name) between 2 and 50 and name = btrim(name)),
  constraint crew_base_length  check (base is null or char_length(base) <= 40),
  constraint crew_country_length check (country is null or char_length(country) <= 30),
  constraint crew_website_shape check (website is null or (website ~ '^https?://' and char_length(website) <= 120)),
  constraint crew_about_length check (about is null or char_length(about) <= 280)
);
create unique index if not exists crews_slug_key on crews (slug);
create unique index if not exists crews_name_key on crews (lower(name));

-- Who can verify for a crew. The person who registers it is the owner;
-- the owner can add checkers (foremen, crew bosses, checkers).
create table if not exists crew_staff (
  crew_id  uuid not null references crews(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     text not null check (role in ('owner', 'checker')),
  added_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index if not exists crew_staff_user_idx on crew_staff (user_id);

-- Planters on a crew. A planter can belong to more than one over a career.
create table if not exists crew_members (
  id           uuid primary key default gen_random_uuid(),
  crew_id      uuid not null references crews(id) on delete cascade,
  planter_id   uuid not null references planters(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'declined', 'left')),
  requested_at timestamptz not null default now(),
  decided_at   timestamptz,
  constraint one_membership_per_crew unique (crew_id, planter_id)
);
create index if not exists crew_members_planter_idx on crew_members (planter_id);

create or replace function is_crew_staff(p_crew uuid, p_owner_only boolean default false)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from crew_staff
    where crew_id = p_crew
      and user_id = auth.uid()
      and (not p_owner_only or role = 'owner')
  );
$$;

-- The registering user becomes owner automatically.
create or replace function crews_add_owner()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into crew_staff (crew_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists crews_owner on crews;
create trigger crews_owner
  after insert on crews
  for each row execute function crews_add_owner();

-- Renaming an approved crew sends it back for review, so an approved
-- crew can't be renamed into some other company after the fact.
create or replace function crews_guard_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name is distinct from old.name or new.slug is distinct from old.slug then
    new.status := 'pending';
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists crews_rename on crews;
create trigger crews_rename
  before update on crews
  for each row execute function crews_guard_rename();

-- ---------- crew rules ----------
alter table crews        enable row level security;
alter table crew_staff   enable row level security;
alter table crew_members enable row level security;

drop policy if exists "approved crews are public" on crews;
create policy "approved crews are public"
  on crews for select
  using (status = 'approved' or is_crew_staff(id) or is_site_admin());

drop policy if exists "register a crew" on crews;
create policy "register a crew"
  on crews for insert
  with check (auth.uid() is not null and created_by = auth.uid() and status = 'pending');

drop policy if exists "owners edit their crew" on crews;
create policy "owners edit their crew"
  on crews for update
  using (is_crew_staff(id, true))
  with check (is_crew_staff(id, true));

drop policy if exists "owners delete their crew" on crews;
create policy "owners delete their crew"
  on crews for delete
  using (is_crew_staff(id, true));

-- Owners can only change the descriptive columns. Status is set by an
-- admin through review_crew(); created_by never changes.
revoke insert, update on crews from anon, authenticated;
grant insert (slug, name, base, country, website, about) on crews to authenticated;
grant update (slug, name, base, country, website, about) on crews to authenticated;

drop policy if exists "staff lists are public" on crew_staff;
create policy "staff lists are public"
  on crew_staff for select
  using (true);
-- crew_staff is written only by the functions below.
revoke insert, update, delete on crew_staff from anon, authenticated;

drop policy if exists "rosters are public" on crew_members;
create policy "rosters are public"
  on crew_members for select
  using (
    status = 'active'
    or is_crew_staff(crew_id)
    or exists (select 1 from planters p where p.id = planter_id and p.user_id = auth.uid())
  );
-- crew_members is written only by the functions below.
revoke insert, update, delete on crew_members from anon, authenticated;

-- ---------- verification marks on days ----------
alter table days add column if not exists verdict      text;
alter table days add column if not exists verdict_crew uuid references crews(id) on delete set null;
alter table days add column if not exists verdict_by   uuid references auth.users(id) on delete set null;
alter table days add column if not exists verdict_at   timestamptz;
alter table days add column if not exists verdict_note text;

alter table days drop constraint if exists verdict_kind;
alter table days add constraint verdict_kind
  check (verdict is null or verdict in ('verified', 'disputed'));
alter table days drop constraint if exists verdict_note_length;
alter table days add constraint verdict_note_length
  check (verdict_note is null or char_length(verdict_note) <= 90);

-- Planters write their own days, but never the verdict columns.
revoke insert, update on days from anon, authenticated;
grant insert (planter_id, date, trees, terrain, block, notes) on days to authenticated;
grant update (date, trees, terrain, block, notes) on days to authenticated;

-- Changing the numbers on a checked day clears the check.
create or replace function days_clear_verdict()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.date, new.trees, new.terrain, new.planter_id)
     is distinct from (old.date, old.trees, old.terrain, old.planter_id) then
    new.verdict := null;
    new.verdict_crew := null;
    new.verdict_by := null;
    new.verdict_at := null;
    new.verdict_note := null;
  end if;
  return new;
end;
$$;

drop trigger if exists days_verdict_reset on days;
create trigger days_verdict_reset
  before update on days
  for each row execute function days_clear_verdict();

-- ---------- actions ----------
-- Everything that changes membership, staff or verdicts goes through
-- these functions, so the rules live in one place.

-- Admin: approve or reject a crew.
create or replace function review_crew(p_crew uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_site_admin() then
    raise exception 'Only Highball admins can review crews' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  update crews set status = p_status, reviewed_at = now() where id = p_crew;
end;
$$;

-- Planter: ask to join an approved crew.
create or replace function request_to_join(p_crew uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_planter uuid;
begin
  select id into v_planter from planters where user_id = auth.uid();
  if v_planter is null then
    raise exception 'Make a profile before joining a crew' using errcode = '42501';
  end if;
  if not exists (select 1 from crews where id = p_crew and status = 'approved') then
    raise exception 'That crew is not open for members yet' using errcode = '42501';
  end if;
  insert into crew_members (crew_id, planter_id)
  values (p_crew, v_planter)
  on conflict (crew_id, planter_id) do update
    set status = 'pending', requested_at = now(), decided_at = null
    where crew_members.status in ('declined', 'left');
end;
$$;

-- Planter: leave a crew, or withdraw a request. Verdicts already given stay.
create or replace function leave_crew(p_crew uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update crew_members m set status = 'left', decided_at = now()
  from planters p
  where m.planter_id = p.id and p.user_id = auth.uid() and m.crew_id = p_crew;
end;
$$;

-- Owner or checker: accept or decline a request, or remove a member.
create or replace function decide_member(p_member uuid, p_status text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_crew uuid;
begin
  if p_status not in ('active', 'declined') then
    raise exception 'Unknown status %', p_status using errcode = '22023';
  end if;
  select crew_id into v_crew from crew_members where id = p_member;
  if v_crew is null or not is_crew_staff(v_crew) then
    raise exception 'Only this crew''s owner or checkers can do that' using errcode = '42501';
  end if;
  update crew_members set status = p_status, decided_at = now() where id = p_member;
end;
$$;

-- Owner: add a checker by their camp name.
create or replace function add_checker(p_crew uuid, p_handle text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not is_crew_staff(p_crew, true) then
    raise exception 'Only the crew owner can add checkers' using errcode = '42501';
  end if;
  select user_id into v_user from planters where lower(handle) = lower(btrim(p_handle));
  if v_user is null then
    raise exception 'No planter goes by that camp name' using errcode = 'P0002';
  end if;
  insert into crew_staff (crew_id, user_id, role)
  values (p_crew, v_user, 'checker')
  on conflict do nothing;
end;
$$;

-- Owner: remove a checker. Owners can't be removed this way.
create or replace function remove_checker(p_crew uuid, p_user uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not is_crew_staff(p_crew, true) then
    raise exception 'Only the crew owner can remove checkers' using errcode = '42501';
  end if;
  delete from crew_staff where crew_id = p_crew and user_id = p_user and role = 'checker';
end;
$$;

-- Owner or checker: mark days verified or disputed, or clear the mark
-- (p_verdict = null). Returns how many days were changed. Days are
-- skipped, not errored, when they don't qualify:
--   - the planter isn't an active member of this crew
--   - the day belongs to the person doing the checking
--   - another crew already gave the day a verdict
create or replace function judge_days(
  p_crew uuid,
  p_days uuid[],
  p_verdict text,
  p_note text default null
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not is_crew_staff(p_crew) then
    raise exception 'Only this crew''s owner or checkers can verify days' using errcode = '42501';
  end if;
  if not exists (select 1 from crews where id = p_crew and status = 'approved') then
    raise exception 'This crew needs admin approval before it can verify days' using errcode = '42501';
  end if;
  if p_verdict is not null and p_verdict not in ('verified', 'disputed') then
    raise exception 'Unknown verdict %', p_verdict using errcode = '22023';
  end if;
  if p_verdict = 'disputed' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Say why the day is disputed' using errcode = '22023';
  end if;

  update days d set
    verdict      = p_verdict,
    verdict_crew = case when p_verdict is null then null else p_crew end,
    verdict_by   = case when p_verdict is null then null else auth.uid() end,
    verdict_at   = case when p_verdict is null then null else now() end,
    verdict_note = case when p_verdict = 'disputed' then left(btrim(p_note), 90) else null end
  from planters p
  where d.id = any(p_days)
    and p.id = d.planter_id
    and p.user_id is distinct from auth.uid()
    and (d.verdict_crew is null or d.verdict_crew = p_crew)
    and exists (
      select 1 from crew_members m
      where m.crew_id = p_crew and m.planter_id = d.planter_id and m.status = 'active'
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Only signed-in users can call the actions (they all check auth.uid()).
revoke execute on function review_crew(uuid, text)                  from public, anon;
revoke execute on function request_to_join(uuid)                    from public, anon;
revoke execute on function leave_crew(uuid)                         from public, anon;
revoke execute on function decide_member(uuid, text)                from public, anon;
revoke execute on function add_checker(uuid, text)                  from public, anon;
revoke execute on function remove_checker(uuid, uuid)               from public, anon;
revoke execute on function judge_days(uuid, uuid[], text, text)     from public, anon;
grant execute on function review_crew(uuid, text)                   to authenticated;
grant execute on function request_to_join(uuid)                     to authenticated;
grant execute on function leave_crew(uuid)                          to authenticated;
grant execute on function decide_member(uuid, text)                 to authenticated;
grant execute on function add_checker(uuid, text)                   to authenticated;
grant execute on function remove_checker(uuid, uuid)                to authenticated;
grant execute on function judge_days(uuid, uuid[], text, text)      to authenticated;
-- Trigger functions aren't meant to be called directly.
revoke execute on function crews_add_owner()    from public, anon, authenticated;
revoke execute on function crews_guard_rename() from public, anon, authenticated;
revoke execute on function days_clear_verdict() from public, anon, authenticated;

-- ---------- the board, now with verification ----------
-- A planter is "crew verified" when at least 80% of their logged trees
-- carry a crew's verified mark and none of their days are disputed.
-- Carry-over trees from before joining can't be verified and don't count
-- either way.
drop view if exists board;
create view board with (security_invoker = on) as
select
  p.id,
  p.user_id,
  p.handle,
  p.base,
  p.country,
  coalesce(c.name, p.crew)                             as crew,
  c.slug                                               as crew_slug,
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
  coalesce(d.verified_trees, 0)                        as verified_trees,
  coalesce(d.verified_days, 0)                         as verified_days,
  coalesce(d.disputed_days, 0)                         as disputed_days,
  case when coalesce(d.logged, 0) = 0 then 0
       else round(100.0 * coalesce(d.verified_trees, 0) / d.logged)::int
  end                                                  as verified_pct,
  (coalesce(d.logged, 0) > 0
    and coalesce(d.disputed_days, 0) = 0
    and coalesce(d.verified_trees, 0) * 5 >= d.logged * 4) as crew_verified,
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
      / nullif(sum(trees), 0)                                    as ground_factor,
    sum(trees) filter (where verdict = 'verified')               as verified_trees,
    count(*)   filter (where verdict = 'verified')               as verified_days,
    count(*)   filter (where verdict = 'disputed')               as disputed_days
  from days
  group by planter_id
) d on d.planter_id = p.id
-- The crew shown on the board is the planter's most recent active crew.
left join lateral (
  select cr.name, cr.slug
  from crew_members m
  join crews cr on cr.id = m.crew_id and cr.status = 'approved'
  where m.planter_id = p.id and m.status = 'active'
  order by m.decided_at desc nulls last
  limit 1
) c on true;

-- Supabase's default grants don't reach a view recreated after the fact
-- in every setup, so grant read access explicitly.
grant select on board to anon, authenticated;
