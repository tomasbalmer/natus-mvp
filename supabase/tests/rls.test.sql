-- Natus MVP — Row Level Security, adversarially
--
-- Every assertion here is a negative one: something a hostile holder of the
-- anon key must not be able to do. A policy test that only proves the owner
-- can read their own row proves nothing about the policy — it would pass
-- against a table with RLS switched off entirely.
--
-- So each negative carries a control: the same read, by the person entitled
-- to it, which must succeed. If a control ever fails the negative beside it
-- has stopped meaning anything. Phase 2 of the 001 plan learned this the hard
-- way, with suppression tests that passed while exercising nothing.
--
-- Run: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- ═══════════════════════════════════════════════════════════════════════════
-- Two people who have never met
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function pg_temp.act_as(uid uuid) returns void as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$ language plpgsql;

create or replace function pg_temp.act_as_anon() returns void as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$ language plpgsql;

create or replace function pg_temp.act_as_owner() returns void as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$ language plpgsql;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@example.test'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@example.test');

-- Alice has answered the clinical question in the way that matters most.
insert into public.clients (user_id, email, legal_birth_name, clinical_ideation_6m,
                            clinical_in_treatment, clinical_psychiatric_medication)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@example.test', 'Alice',
        'plan_o_intencion', true, true);

insert into public.clients (user_id, email, legal_birth_name, clinical_ideation_6m)
values ('bbbbbbbb-0000-4000-8000-000000000002', 'bob@example.test', 'Bob', 'no');

insert into public.anonymous_sessions (user_id, legal_birth_name, clinical_ideation_6m)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Alice', 'plan_o_intencion');

insert into public.soul_map_syntheses (user_id, prompt_version, synthesis, mode)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'v1-reconstructed', '{}'::jsonb, 'fixture');

insert into public.conversations (user_id, synthesis_id)
select 'aaaaaaaa-0000-4000-8000-000000000001', id from public.soul_map_syntheses limit 1;

insert into public.messages (user_id, conversation_id, role, text, counted)
select 'aaaaaaaa-0000-4000-8000-000000000001', id, 'user', 'algo muy privado', false
from public.conversations limit 1;

insert into public.crisis_events (user_id, severity, category, source_surface, excerpt)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'high', 'ideacion', 'chat',
        'texto sensible que disparó la detección');

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Clinical answers do not cross between people
-- ═══════════════════════════════════════════════════════════════════════════

select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.clients),
  1,
  'CONTROL: Alice sees exactly one client row, her own'
);

-- Aggregated rather than a bare scalar subquery. Under a broken ownership
-- policy this returns more than one row, and a scalar subquery would abort
-- the transaction — taking the eighteen assertions after it down unrun, which
-- is precisely when they are most needed. Every assertion in this file must
-- be able to fail on its own.
select is(
  (select max(clinical_ideation_6m) from public.clients
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'plan_o_intencion',
  'CONTROL: Alice can read her own clinical answer — the negatives below are not vacuous'
);

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from public.clients),
  1,
  'Bob sees exactly one client row, and it is not Alice''s'
);

select is(
  (select count(*)::int from public.clients
   where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0,
  'Bob naming Alice''s user_id explicitly still reads nothing'
);

select is(
  (select count(*)::int from public.clients where clinical_ideation_6m = 'plan_o_intencion'),
  0,
  'Bob cannot find anyone by their clinical answer'
);

select is(
  (select count(*)::int from public.anonymous_sessions),
  0,
  'The draft carries the same answers before signup, and is equally unreachable'
);

-- A join is the route docs/MIGRATION.md calls out by name.
select is(
  (select count(*)::int
   from public.clients c
   join public.soul_map_syntheses s on s.user_id = c.user_id),
  0,
  'Joining through the soul map does not surface Alice''s row either'
);

select is(
  (select count(*)::int from public.messages),
  0,
  'Bob cannot read Alice''s messages'
);

select is(
  (select count(*)::int from public.crisis_events),
  0,
  'Bob cannot read Alice''s crisis events, excerpt included'
);

select throws_ok(
  $$insert into public.clients (user_id, legal_birth_name)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'not Alice')$$,
  '42501',
  null,
  'Bob cannot write a row owned by Alice'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. The consent gate
-- ═══════════════════════════════════════════════════════════════════════════

select pg_temp.act_as_owner();

insert into public.external_profiles (id, user_id, display_name, legal_birth_name)
values ('cccccccc-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000001', 'Someone', 'Someone Else');

insert into public.comparison_consents (id, user_id, external_profile_id, scope, status)
values ('dddddddd-0000-4000-8000-000000000004',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000003', 'basic', 'granted');

insert into public.chart_comparisons (id, user_id, external_profile_id, consent_id,
                                      prompt_version, result, mode)
values ('eeeeeeee-0000-4000-8000-000000000005',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000003',
        'dddddddd-0000-4000-8000-000000000004',
        'v1-reconstructed', '{}'::jsonb, 'fixture');

select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.chart_comparisons),
  1,
  'CONTROL: under a granted, unexpired consent Alice reads her comparison'
);

select pg_temp.act_as_owner();
update public.comparison_consents set status = 'revoked'
where id = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.chart_comparisons),
  0,
  'Revoking closes the read immediately, for a row Alice still owns'
);

select pg_temp.act_as_owner();
update public.comparison_consents set status = 'granted'
where id = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.chart_comparisons),
  1,
  'CONTROL: re-granting reopens it — the previous assertion tested the status, not a typo'
);

select pg_temp.act_as_owner();
update public.comparison_consents set expires_at = now() - interval '1 day'
where id = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select is(
  (select count(*)::int from public.chart_comparisons),
  0,
  'An expired consent closes the read even while its status still says granted'
);

-- PDR 8.2: the owner may delete the other person's data at any time, and a
-- lapsed consent must not strand the rows it produced.
select lives_ok(
  $$delete from public.chart_comparisons
    where id = 'eeeeeeee-0000-4000-8000-000000000005'$$,
  'Deleting own comparison still works once the consent has lapsed'
);

select pg_temp.act_as_owner();
update public.comparison_consents
  set status = 'pending', expires_at = now() + interval '14 days'
where id = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001');

select throws_ok(
  $$insert into public.chart_comparisons (user_id, external_profile_id, consent_id,
                                          prompt_version, result, mode)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'cccccccc-0000-4000-8000-000000000003',
            'dddddddd-0000-4000-8000-000000000004',
            'v1', '{}'::jsonb, 'fixture')$$,
  '42501',
  null,
  'A comparison cannot be generated against a consent that was never granted'
);

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select is(
  (select count(*)::int from public.comparison_consents),
  0,
  'Bob cannot see that Alice ever asked anyone for consent'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Reference data, and the one thing that must survive a failed sign-in
-- ═══════════════════════════════════════════════════════════════════════════

select pg_temp.act_as_anon();

-- Denied at the grant layer rather than filtered to zero rows by a policy,
-- which is the stronger of the two failures: anon was never given the verb,
-- so no policy edit can make this readable by accident.
select throws_ok(
  'select count(*) from public.modalities',
  '42501',
  null,
  'Without a session the recommendation pool is not reachable at all'
);

select cmp_ok(
  (select count(*)::int from public.crisis_resources),
  '>',
  0,
  'Crisis resources ARE readable without a session — PDR 6.4, there is always somewhere to call'
);

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002');

select cmp_ok(
  (select count(*)::int from public.modalities),
  '>',
  0,
  'CONTROL: with a session the pool is readable, so the anon assertion tested the role'
);

select * from finish();

rollback;
