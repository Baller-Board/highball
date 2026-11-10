-- Checks the database rules by acting as different users.
-- Runs against plain Postgres with supabase_stub.sql loaded first:
--   npm run test:db
-- Every check raises an exception on failure, so the run stops at the
-- first broken rule.

\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Helpers -------------------------------------------------------------
create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  if p_user is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- Runs a statement that must fail. Passes only if it raises.
create or replace function pg_temp.must_fail(p_label text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok   % (refused: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL % — statement was allowed: %', p_label, p_sql;
end $$;

create or replace function pg_temp.check(p_label text, p_ok boolean) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FAIL %', p_label; end if;
  raise notice 'ok   %', p_label;
end $$;

set client_min_messages = notice;

-- Cast of characters (as superuser) ------------------------------------
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'boss@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'planter@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'admin@example.com');
insert into site_admins (user_id) values ('00000000-0000-0000-0000-00000000000d');

-- Anonymous visitors ----------------------------------------------------
select pg_temp.act_as(null);
select pg_temp.must_fail('anon cannot create a profile',
  $$insert into planters (user_id, handle, base, seasons) values ('00000000-0000-0000-0000-00000000000b', 'Ghost', 'Nowhere', 1)$$);

-- Planter B signs on -----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
insert into planters (user_id, handle, base, seasons, prior_trees)
  values ('00000000-0000-0000-0000-00000000000b', 'Ditchpig', 'Prince George, BC', 4, 100000);
select pg_temp.must_fail('cannot make a second profile',
  $$insert into planters (user_id, handle, base, seasons) values ('00000000-0000-0000-0000-00000000000b', 'Ditchpig2', 'X', 1)$$);
select pg_temp.must_fail('cannot make a profile for someone else',
  $$insert into planters (user_id, handle, base, seasons) values ('00000000-0000-0000-0000-00000000000c', 'Imposter', 'X', 1)$$);
select pg_temp.must_fail('base length capped',
  $$update planters set base = repeat('x', 500) where handle = 'Ditchpig'$$);
select pg_temp.must_fail('handle cannot contain a slash',
  $$update planters set handle = 'ditch/pig' where handle = 'Ditchpig'$$);
select pg_temp.must_fail('handle cannot have trailing spaces',
  $$update planters set handle = 'Ditchpig ' where handle = 'Ditchpig'$$);

insert into days (planter_id, date, trees, terrain)
  select id, current_date - 3, 3000, 'burn' from planters where handle = 'Ditchpig';
insert into days (planter_id, date, trees, terrain)
  select id, current_date - 2, 2800, 'block' from planters where handle = 'Ditchpig';
insert into days (planter_id, date, trees, terrain)
  select id, current_date - 1, 2600, 'cream' from planters where handle = 'Ditchpig';

select pg_temp.must_fail('cannot log a day in 1950',
  $$insert into days (planter_id, date, trees, terrain) select id, '1950-06-01', 3000, 'cream' from planters where handle = 'Ditchpig'$$);
select pg_temp.must_fail('cannot verify own day on insert',
  $$insert into days (planter_id, date, trees, terrain, verdict) select id, current_date - 10, 3000, 'cream', 'verified' from planters where handle = 'Ditchpig'$$);
select pg_temp.must_fail('cannot verify own day by update',
  $$update days set verdict = 'verified'$$);

-- Boss A registers a crew -----------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into planters (user_id, handle, base, seasons)
  values ('00000000-0000-0000-0000-00000000000a', 'Foreman Phil', 'Smithers, BC', 12);
insert into days (planter_id, date, trees, terrain)
  select id, current_date - 1, 2000, 'alpine' from planters where handle = 'Foreman Phil';

select pg_temp.must_fail('cannot register a crew as already approved',
  $$insert into crews (slug, name, status) values ('fake', 'Fake Co', 'approved')$$);
insert into crews (slug, name, base, country) values ('nechako', 'Nechako Planting', 'Vanderhoof, BC', 'Canada');
select pg_temp.check('registering makes you owner',
  exists (select 1 from crew_staff where role = 'owner' and user_id = '00000000-0000-0000-0000-00000000000a'));
select pg_temp.check('new crew is pending', (select status from crews where slug = 'nechako') = 'pending');
select pg_temp.must_fail('owner cannot approve own crew',
  $$update crews set status = 'approved' where slug = 'nechako'$$);
select pg_temp.must_fail('owner cannot call admin review',
  $$select review_crew((select id from crews where slug = 'nechako'), 'approved')$$);
select pg_temp.must_fail('owner cannot add themselves as staff directly',
  $$insert into crew_staff (crew_id, user_id, role) select id, '00000000-0000-0000-0000-00000000000c', 'owner' from crews$$);

-- Pending crews are hidden from the public
select pg_temp.act_as(null);
select pg_temp.check('anon cannot see a pending crew', not exists (select 1 from crews where slug = 'nechako'));

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check('other planters cannot see a pending crew', not exists (select 1 from crews where slug = 'nechako'));

-- Admin approves ---------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select pg_temp.check('admin sees pending crew', exists (select 1 from crews where slug = 'nechako'));
select review_crew((select id from crews where slug = 'nechako'), 'approved');

select pg_temp.act_as(null);
select pg_temp.check('anon sees approved crew', exists (select 1 from crews where slug = 'nechako'));

-- Planter B joins ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select request_to_join((select id from crews where slug = 'nechako'));
select pg_temp.must_fail('planter cannot accept themselves',
  $$select decide_member((select id from crew_members limit 1), 'active')$$);
select pg_temp.must_fail('planter cannot write membership directly',
  $$update crew_members set status = 'active'$$);

select pg_temp.act_as(null);
select pg_temp.check('pending requests are not public', not exists (select 1 from crew_members));

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check('owner sees the request', (select count(*) from crew_members where status = 'pending') = 1);
select decide_member((select id from crew_members where status = 'pending'), 'active');

-- Boss joins own crew too, then tries to verify own days
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select request_to_join((select id from crews where slug = 'nechako'));
select decide_member(
  (select m.id from crew_members m join planters p on p.id = m.planter_id where p.handle = 'Foreman Phil'), 'active');
select pg_temp.check('boss cannot verify own days',
  judge_days((select id from crews where slug = 'nechako'),
             array(select d.id from days d join planters p on p.id = d.planter_id where p.handle = 'Foreman Phil'),
             'verified') = 0);

-- Verify B's days
select pg_temp.check('boss verifies member days',
  judge_days((select id from crews where slug = 'nechako'),
             array(select d.id from days d join planters p on p.id = d.planter_id where p.handle = 'Ditchpig'),
             'verified') = 3);
select pg_temp.must_fail('dispute needs a reason',
  $$select judge_days((select id from crews where slug = 'nechako'), array(select id from days limit 1), 'disputed')$$);

select pg_temp.act_as(null);
select pg_temp.check('board shows Ditchpig as crew verified',
  (select crew_verified and verified_pct = 100 and crew = 'Nechako Planting' and crew_slug = 'nechako'
     from board where handle = 'Ditchpig'));
select pg_temp.check('board shows Phil as not verified',
  (select not crew_verified from board where handle = 'Foreman Phil'));

-- Stranger C can't verify
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.must_fail('non-staff cannot verify',
  $$select judge_days((select id from crews where slug = 'nechako'), array(select id from days), 'verified')$$);

-- C runs a rival crew and tries to override Nechako's verdicts
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
insert into planters (user_id, handle, base, seasons) values ('00000000-0000-0000-0000-00000000000c', 'Rival', 'Prince George', 2);
insert into crews (slug, name) values ('rival', 'Rival Reforestation');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
select review_crew((select id from crews where slug = 'rival'), 'approved');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select request_to_join((select id from crews where slug = 'rival'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select decide_member((select m.id from crew_members m join crews c on c.id = m.crew_id where c.slug = 'rival'), 'active');
select pg_temp.check('another crew cannot overwrite a verdict',
  judge_days((select id from crews where slug = 'rival'),
             array(select d.id from days d join planters p on p.id = d.planter_id where p.handle = 'Ditchpig'),
             'disputed', 'nope') = 0);

-- B edits a verified day: the mark clears
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update days set notes = 'wet' where date = current_date - 1 and planter_id = (select id from planters where handle = 'Ditchpig');
select pg_temp.check('editing notes keeps the mark',
  (select verdict from days where date = current_date - 1 and planter_id = (select id from planters where handle = 'Ditchpig')) = 'verified');
update days set trees = 4600 where date = current_date - 1 and planter_id = (select id from planters where handle = 'Ditchpig');
select pg_temp.check('editing the count clears the mark',
  (select verdict from days where date = current_date - 1 and planter_id = (select id from planters where handle = 'Ditchpig')) is null);
select pg_temp.check('B drops below the 80% line',
  (select not crew_verified and verified_pct = 56 from board where handle = 'Ditchpig'));

-- Boss disputes it
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.check('boss disputes the edited day',
  judge_days((select id from crews where slug = 'nechako'),
             array(select d.id from days d join planters p on p.id = d.planter_id where p.handle = 'Ditchpig' and d.verdict is null),
             'disputed', 'Tally sheet says 2,600') = 1);
select pg_temp.act_as(null);
select pg_temp.check('dispute shows on the board', (select disputed_days = 1 from board where handle = 'Ditchpig'));

-- Renaming an approved crew sends it back for review
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update crews set name = 'Brinkman & Associates' where slug = 'nechako';
reset role;
select pg_temp.check('rename sends crew back to pending', (select status from crews where slug = 'nechako') = 'pending');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select pg_temp.must_fail('pending crew cannot verify',
  $$select judge_days((select id from crews where slug = 'nechako'), array(select id from days), 'verified')$$);

-- Leaving a crew
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select leave_crew((select id from crews where slug = 'rival'));
select pg_temp.check('planter can leave a crew',
  (select m.status from crew_members m join crews c on c.id = m.crew_id where c.slug = 'rival') = 'left');

-- Owner adds and removes a checker
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select add_checker((select id from crews where slug = 'rival'), 'ditchpig');
select pg_temp.check('owner adds checker by camp name',
  exists (select 1 from crew_staff where role = 'checker' and user_id = '00000000-0000-0000-0000-00000000000b'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.must_fail('checker cannot add more checkers',
  $$select add_checker((select id from crews where slug = 'rival'), 'Foreman Phil')$$);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select remove_checker((select id from crews where slug = 'rival'), '00000000-0000-0000-0000-00000000000b');
select pg_temp.check('owner removes checker',
  not exists (select 1 from crew_staff where role = 'checker'));

reset role;
\echo 'All rule checks passed.'
