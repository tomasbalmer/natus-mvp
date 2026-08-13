-- PDR 4 — every model call, recorded.
--
-- This had no equivalent in the demo because there was no server to log from.
-- It arrives with the Edge Functions, and it is what makes the surviving half
-- of DECISIONS.md §3 answerable: "a spend-anything endpoint on a public URL"
-- is a risk you can only see if you are counting.
--
-- What is deliberately NOT in this table: the prompt, the completion, and
-- anything derived from `clinical_basics`. A log of what a person asked a
-- mental-health product is a second copy of the most sensitive data here,
-- kept somewhere nobody thought to protect. Counts, versions, latency and
-- outcome are enough to answer the operational questions — how much is this
-- costing, what is failing, is the quota holding — and none of them are a
-- transcript.

create table public.claude_api_calls (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  purpose        text not null
                   check (purpose in ('soul_map', 'match', 'chat', 'meditation', 'comparison')),
  prompt_version text not null,
  model          text not null,
  -- 'fixture' when no key is configured and the curated path answered. Logged
  -- rather than skipped: a week of fixture-only traffic is a fact worth being
  -- able to see, not an absence of events.
  mode           text not null check (mode in ('fixture', 'server')),
  outcome        text not null
                   check (outcome in ('ok', 'invalid_json', 'copy_violation', 'api_error',
                                      'timeout', 'refused_quota', 'refused_crisis')),
  input_tokens   integer,
  output_tokens  integer,
  latency_ms     integer not null default 0,
  -- The error class, never the payload.
  error_kind     text,
  created_at     timestamptz not null default now()
);

comment on table public.claude_api_calls is
  'PDR 4. Counts and outcomes, never prompts or completions.';

create index claude_api_calls_user_idx on public.claude_api_calls (user_id, created_at desc);
create index claude_api_calls_spend_idx on public.claude_api_calls (created_at desc)
  where mode = 'server';

alter table public.claude_api_calls enable row level security;

-- Read your own; write nothing.
--
-- Rows are inserted by Edge Functions under the service role, which bypasses
-- RLS. Granting insert to `authenticated` would let anyone with the anon key
-- write whatever they liked into the record that exists to detect abuse.
grant select on public.claude_api_calls to authenticated;

create policy "own api calls are readable"
  on public.claude_api_calls for select to authenticated
  using (auth.uid() = user_id);
