-- The chat quota, counted from the ledger rather than from messages.
--
-- `currentQuota` counted `messages where counted`, under the service role, on
-- the reasoning that the person could not touch the count. They could: the
-- browser writes those rows and "own messages" grants it every verb, so
-- deleting your own messages gave the three free questions back. The query
-- ran with elevated privileges over data the caller wrote.
--
-- `claude_api_calls` is written only by the functions, and `authenticated`
-- holds select on it and nothing else. Whether a turn spent a question is
-- decided where the model answered, so it is recorded there.

alter table public.claude_api_calls
  add column charged boolean not null default false;

comment on column public.claude_api_calls.charged is
  'Whether this call spent one of the free chat questions. Set by the chat '
  'function from isChargeable(response.type); a crisis turn is never charged.';

-- Turns answered before this column existed. The response type was never
-- recorded, so a model-classified crisis turn among them is counted; the
-- error is at most one question, against the person, once.
update public.claude_api_calls
  set charged = true
  where purpose = 'chat' and outcome = 'ok' and mode = 'server';

create index claude_api_calls_quota_idx
  on public.claude_api_calls (user_id)
  where purpose = 'chat' and charged;

-- Nothing on the server reads messages any more. A grant nobody uses is a
-- grant somebody eventually uses by mistake.
revoke select on public.messages from service_role;
