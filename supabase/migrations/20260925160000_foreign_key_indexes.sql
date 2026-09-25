-- Indexes for every foreign key that had none, found by query rather than by
-- reading: a single-column foreign key whose column leads no full index.
--
-- Two jobs. Every read in src/store/remote.ts is `where user_id = … order by
-- created_at` (consents order by requested_at), so those lead with user_id
-- and carry the sort. And every cascade — deleting an account, a profile, a
-- consent — scans the child table for the parent's key; without an index
-- that is a sequential scan per parent row, inside the transaction that
-- delete-account depends on.

create index modality_matches_user_idx    on public.modality_matches (user_id, created_at);
create index modality_matches_synthesis_idx on public.modality_matches (synthesis_id);

create index match_reactions_modality_idx on public.match_reactions (modality_slug);

create index conversations_synthesis_idx  on public.conversations (synthesis_id);

-- The existing messages index is partial (counted rows, for the old quota),
-- so it serves neither the load nor the cascade.
create index messages_user_idx            on public.messages (user_id, created_at);

create index external_profiles_user_idx   on public.external_profiles (user_id, created_at);

create index comparison_consents_user_idx on public.comparison_consents (user_id, requested_at);

create index chart_comparisons_user_idx    on public.chart_comparisons (user_id, created_at);
create index chart_comparisons_consent_idx on public.chart_comparisons (consent_id);
create index chart_comparisons_profile_idx on public.chart_comparisons (external_profile_id);

-- Served the quota when it counted messages. It counts the ledger now
-- (20260925120000_quota_from_ledger.sql), and an index nothing reads is a
-- write cost with no return.
drop index public.messages_quota_idx;
