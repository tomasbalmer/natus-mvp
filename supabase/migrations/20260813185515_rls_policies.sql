-- Natus MVP — Row Level Security policies
--
-- The anon key ships in the JavaScript bundle. That is by design and it is
-- safe only because of this file. Everything below assumes the reader is
-- hostile and holds that key.
--
-- Two policies carry product promises rather than mere ownership, and
-- docs/MIGRATION.md names them both:
--
--   1. Nobody reads a chart_comparisons row without a granted, unexpired
--      consent for that pair. The demo re-checked this in readableComparison
--      on every read; here it is a policy, because a helper is only as good
--      as the call site that remembers to use it.
--
--   2. Nobody reads another client's clinical answers. Not through a join,
--      not through a view, not through a comparison.
--
-- Both have negative tests in supabase/tests/rls.test.sql. A policy without a
-- test that tries to break it is a comment.

-- ═══════════════════════════════════════════════════════════════════════════
-- Grants — the coarse layer, underneath the policies
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Access here is two layers and both are load-bearing. A grant says whether a
-- role may touch a table at all; a policy says which of its rows. Postgres
-- checks the grant first, so a table with perfect policies and no grant is
-- unreachable — which is how the first run of supabase/tests/rls.test.sql
-- failed, and a useful reminder that the layers are independent.
--
-- Granted narrowly on purpose. If a policy is ever written wrong, the missing
-- privilege is what is left standing: no role can delete a modality however
-- badly the policies are edited, because no role was ever given the verb.

grant select on
  public.modalities,
  public.topics,
  public.bed_tracks
to authenticated;

-- The one table anon reaches. See the policy note below for why.
grant select on public.crisis_resources to anon, authenticated;

grant select, insert, update, delete on
  public.anonymous_sessions,
  public.clients,
  public.preferences,
  public.subscriptions,
  public.soul_map_syntheses,
  public.modality_matches,
  public.match_reactions,
  public.recommendation_checkins,
  public.conversations,
  public.messages,
  public.meditations,
  public.external_profiles,
  public.comparison_consents,
  public.chart_comparisons,
  public.crisis_events
to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Reference data — readable by everyone signed in, writable by nobody
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Anonymous sign-in gives the `authenticated` role with an is_anonymous
-- claim, so a first-time visitor who has typed nothing still reads these.
--
-- No insert, update or delete policy exists for any of them. Reference data
-- changes by migration, which is reviewable; the seed for a wrong hotline
-- number should not be a row anyone can write over the wire.

create policy "modalities are readable when active"
  on public.modalities for select to authenticated
  using (is_active);

create policy "topics are readable"
  on public.topics for select to authenticated
  using (true);

create policy "crisis resources are readable when active"
  on public.crisis_resources for select to authenticated
  using (is_active);

-- Deliberately readable by anon as well as authenticated. If the anonymous
-- sign-in itself fails, the one screen that must still work is the crisis
-- screen. PDR 6.4: there is always somewhere to call.
create policy "crisis resources are readable without a session"
  on public.crisis_resources for select to anon
  using (is_active);

create policy "bed tracks are readable when active"
  on public.bed_tracks for select to authenticated
  using (is_active);

-- ═══════════════════════════════════════════════════════════════════════════
-- Ownership — the uniform case
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `for all` with both using and with check: using governs what the row must
-- look like to be read, updated or deleted; with check governs what it must
-- look like after an insert or update. Omitting with check would let someone
-- insert a row owned by another user, which they could not then read but
-- which would sit in that person's data.

create policy "own anonymous session"
  on public.anonymous_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Carries clinical_ideation_6m and its neighbours. This single predicate is
-- what stands between one person's clinical answers and every other holder of
-- the anon key. See the negative tests.
create policy "own client row"
  on public.clients for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own preferences"
  on public.preferences for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own subscription"
  on public.subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own syntheses"
  on public.soul_map_syntheses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own matches"
  on public.modality_matches for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own reactions"
  on public.match_reactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own check-ins"
  on public.recommendation_checkins for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own conversations"
  on public.conversations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages"
  on public.messages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own meditations"
  on public.meditations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own external profiles"
  on public.external_profiles for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own consents"
  on public.comparison_consents for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own crisis events"
  on public.crisis_events for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- The consent gate — PDR 8.2, and the reason this feature exists at all
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ownership is necessary and not sufficient. The account holder owns the
-- comparison row; the other person consented to it. Revoking that consent has
-- to close the read immediately, for a row the reader still owns.
--
-- Evaluated per statement against current state, so a revoke or an expiry
-- takes effect on the next read with no cached result surviving it. That is
-- the property the demo was verified on and it survives the move.

create policy "comparisons are readable only under live consent"
  on public.chart_comparisons for select to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.comparison_consents c
      where c.id = chart_comparisons.consent_id
        and c.status = 'granted'
        and c.expires_at > now()
    )
  );

-- Writing one is gated the same way: a comparison must not be generated
-- against a consent that was never granted, or that has since lapsed. The
-- check is here rather than only in the Edge Function because the function is
-- one call site and this is the table.
create policy "comparisons are writable only under live consent"
  on public.chart_comparisons for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.comparison_consents c
      where c.id = chart_comparisons.consent_id
        and c.status = 'granted'
        and c.expires_at > now()
    )
  );

-- PDR 8.2 gives the owner the right to delete the other person's data at any
-- time, and that must not depend on the consent still being live — a revoked
-- consent would otherwise strand the rows it produced, unreadable and
-- undeletable. Ownership alone governs removal.
create policy "own comparisons may always be deleted"
  on public.chart_comparisons for delete to authenticated
  using (auth.uid() = user_id);
