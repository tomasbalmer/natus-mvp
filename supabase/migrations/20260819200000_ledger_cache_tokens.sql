-- The two token counts the ledger was throwing away.
--
-- Anthropic returns four numbers on every call: input_tokens,
-- output_tokens, cache_creation_input_tokens and cache_read_input_tokens.
-- Only the first two were being read. Writing to the prompt cache is billed
-- at 1.25x the input rate and reading from it at 0.1x, so every row recorded
-- less than the call actually cost — and the deployment budget derived from
-- these rows would have fired later than it was set to.
--
-- `cache_read_input_tokens` is also the measurement that decides whether the
-- caching is worth doing at all. The marker has a five-minute window, and two
-- people generating a Soul Map are rarely five minutes apart; if this column
-- stays at zero on that surface, the cache is a surcharge buying nothing.
alter table public.claude_api_calls
  add column if not exists cache_write_tokens integer,
  add column if not exists cache_read_tokens integer;

comment on column public.claude_api_calls.cache_write_tokens is
  'cache_creation_input_tokens. Billed at 1.25x the input rate.';
comment on column public.claude_api_calls.cache_read_tokens is
  'cache_read_input_tokens. Billed at 0.1x. Zero means the cache was cold.';
