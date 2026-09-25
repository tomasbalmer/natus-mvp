-- What the deployment has spent, summed where the rows are.
--
-- `overDeploymentBudget` selected every server row of the last thirty days
-- and added them up in the function. PostgREST returns at most `max_rows`
-- (1,000) per request, so past a thousand calls the ceiling saw a thousand,
-- and fired late by exactly the amount it exists to stop.
--
-- Token totals rather than dollars: prices live in src/lib/budget.ts, beside
-- the tests that pin them, and cost is linear in each count.

create function public.deployment_token_totals(since timestamptz)
returns table (
  input_tokens       bigint,
  output_tokens      bigint,
  cache_write_tokens bigint,
  cache_read_tokens  bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(c.input_tokens), 0)::bigint,
    coalesce(sum(c.output_tokens), 0)::bigint,
    coalesce(sum(c.cache_write_tokens), 0)::bigint,
    coalesce(sum(c.cache_read_tokens), 0)::bigint
  from public.claude_api_calls c
  where c.mode = 'server' and c.created_at >= since
$$;

-- The functions ask; nobody else does. Postgres grants execute to PUBLIC
-- by default, and Supabase's default privileges extend it to anon and
-- authenticated.
revoke execute on function public.deployment_token_totals(timestamptz)
  from public, anon, authenticated;
grant execute on function public.deployment_token_totals(timestamptz) to service_role;
