alter table public.claude_api_calls
  drop constraint claude_api_calls_outcome_check,
  add constraint claude_api_calls_outcome_check
    check (outcome in ('ok', 'invalid_json', 'copy_violation', 'api_error',
                       'timeout', 'refused_quota', 'refused_crisis', 'pending'));

grant update (outcome, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
              latency_ms, error_kind, charged)
  on public.claude_api_calls to service_role;

create function public.reserve_chat_turn(
  p_user           uuid,
  p_limit          integer,
  p_since          timestamptz,
  p_prompt_version text,
  p_model          text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  used     integer;
  reserved uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  select count(*) into used
  from public.claude_api_calls c
  where c.user_id = p_user
    and c.purpose = 'chat'
    and c.charged
    and (p_since is null or c.created_at >= p_since);

  if used >= p_limit then
    return null;
  end if;

  insert into public.claude_api_calls
    (user_id, purpose, prompt_version, model, mode, outcome, charged)
  values
    (p_user, 'chat', p_prompt_version, p_model, 'server', 'pending', true)
  returning id into reserved;

  return reserved;
end
$$;

revoke execute on function public.reserve_chat_turn(uuid, integer, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_chat_turn(uuid, integer, timestamptz, text, text)
  to service_role;
