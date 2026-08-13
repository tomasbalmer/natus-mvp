-- The same omission as the first migration, for a different role.
--
-- `service_role` bypasses RLS *policies*. It does not bypass table *grants* —
-- those are the layer underneath, and Postgres checks them first. So the Edge
-- Functions could authenticate a caller, read nothing, and carry on: the quota
-- count came back null and was read as zero-used, which is the permissive
-- direction. A person at zero remaining questions was told they had three.
--
-- It failed silently because both call sites were written to fail silently on
-- purpose — `logCall` must never break the request a person is waiting on, and
-- `currentQuota` coalesces a null count. Neither was wrong to be quiet; what
-- was wrong was that nothing else was watching, and only
-- `scripts/verify-chat-function.mjs` asking "is the quota actually enforced"
-- surfaced it.
--
-- Granted narrowly, for the same reason as the first time. `service_role` gets
-- the three things the functions need and nothing else, so a key that leaks is
-- bounded by what was granted rather than by what the policies say — and the
-- policies say nothing to this role at all.

-- The quota count. Read-only: the functions never write a person's messages.
grant select on public.messages to service_role;

-- Whether the allowance applies.
grant select on public.subscriptions to service_role;

-- PDR 4. Insert only; a function has no reason to amend the ledger, and
-- `authenticated` was deliberately given no insert at all, so the subject
-- cannot write their own record.
grant select, insert on public.claude_api_calls to service_role;
