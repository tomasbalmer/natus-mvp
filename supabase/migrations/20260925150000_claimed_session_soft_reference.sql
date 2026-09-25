-- clients.claimed_session_id becomes a record, not a constraint.
--
-- It pointed at anonymous_sessions with `on delete set null`. The session is
-- disposable by design: claimSession expires it at signup, the next read of
-- an expired session deletes it, and returning to onboarding replaces it.
-- Postgres cleared the pointer when that happened; the store's mirror did
-- not, so the next write of the account — a Soul Map generated after signup
-- is enough — sent the old id back and violated the foreign key. Reproduced
-- in remote.integration.test.ts before this migration existed.
--
-- The column records which anonymous session an account came from. That is
-- still true after the session is gone, the same way soul_map_id is a soft
-- reference beside it.
alter table public.clients drop constraint clients_claimed_session_id_fkey;

comment on column public.clients.claimed_session_id is
  'The anonymous session this account was claimed from, at signup. A soft '
  'reference: the session is disposable and may no longer exist.';
