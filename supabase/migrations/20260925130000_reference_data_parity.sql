-- Reference data brought back in line with data/*.json, and constraints that
-- outlived the code they described.
--
-- `remote.integration.test.ts` now compares every reference table with the
-- JSON it was generated from. On its first run only one disagreed.

-- ── Crisis resources ─────────────────────────────────────────────────────────
--
-- The seed said it was "keyed on (country, name, contact)" and ended in a
-- bare `on conflict do nothing`. No such key existed, so there was no
-- conflict to detect and a second run would have shown every number twice.
create unique index crisis_resources_natural_key
  on public.crisis_resources (country, name, contact);

-- The JSON carries 2026-08-19 on all sixteen; the table carried null. The
-- date records the product owner accepting the numbers as transcribed from
-- the PDR — not a call placed to each line. data/crisis-resources.json says
-- so at length, and this column now says it too.
update public.crisis_resources set verified_at = '2026-08-19';

comment on column public.crisis_resources.verified_at is
  'When these numbers were last accepted. 2026-08-19 is the product owner '
  'accepting them as transcribed from the PDR, NOT a call placed to each line; '
  'the telephone verification PDR 6.4 requires is still owed. Mirror of '
  'data/crisis-resources.json, which is what the application reads.';

-- ── Modalities ───────────────────────────────────────────────────────────────
--
-- The column comment in the initial schema said the clinical filter would
-- run server-side "from Phase 3". It does not: the browser applies it and the
-- match function trusts the candidate slugs it is sent. Written down where
-- the next reader of this column will look.
comment on column public.modalities.requires_clinical_support is
  'PDR 7.2 clinical exclusion. Applied by the hard filter in the browser '
  '(src/lib/matching.ts), which is the only place clinical_basics is read. '
  'The match function does not re-apply it to the slugs it receives.';

-- ── The BYOK mode ────────────────────────────────────────────────────────────
--
-- 'byok' was the pasted-key path, removed from the application. The
-- constraints still admitted it. `not valid` because rows written while it
-- existed are a true record of how they were made, and rewriting history to
-- satisfy a constraint would make them lie; new rows are held to it.
alter table public.soul_map_syntheses drop constraint soul_map_syntheses_mode_check;
alter table public.soul_map_syntheses add constraint soul_map_syntheses_mode_check
  check (mode in ('fixture', 'server')) not valid;

alter table public.meditations drop constraint meditations_mode_check;
alter table public.meditations add constraint meditations_mode_check
  check (mode in ('fixture', 'server')) not valid;

alter table public.chart_comparisons drop constraint chart_comparisons_mode_check;
alter table public.chart_comparisons add constraint chart_comparisons_mode_check
  check (mode in ('fixture', 'server')) not valid;
