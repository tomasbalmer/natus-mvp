create function public.reserve_model_call(
  p_user           uuid,
  p_purpose        text,
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
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_purpose, 0));

  select count(*) into used
  from public.claude_api_calls c
  where c.user_id = p_user
    and c.purpose = p_purpose
    and c.mode = 'server'
    and (c.output_tokens is not null or c.outcome = 'pending')
    and c.created_at >= p_since;

  if used >= p_limit then
    return null;
  end if;

  insert into public.claude_api_calls
    (user_id, purpose, prompt_version, model, mode, outcome)
  values
    (p_user, p_purpose, p_prompt_version, p_model, 'server', 'pending')
  returning id into reserved;

  return reserved;
end
$$;

revoke execute on function public.reserve_model_call(uuid, text, integer, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.reserve_model_call(uuid, text, integer, timestamptz, text, text)
  to service_role;
