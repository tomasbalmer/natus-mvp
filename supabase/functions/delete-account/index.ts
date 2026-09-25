import { json, preflight } from '../_shared/cors.ts';
import { authenticate, Unauthorized } from '../_shared/auth.ts';

/**
 * PDR 11.3: delete your data. All of it, and the account it hangs from.
 *
 * One call, because the schema already knows how. Every table a person owns
 * references `auth.users` with `on delete cascade`, so removing the auth user
 * removes every row in one transaction Postgres guarantees — not fourteen
 * sequential deletes from a browser, which is what this replaces and which
 * threw on its second table without anybody seeing it.
 *
 * `claude_api_calls` is the exception by design: `on delete set null`. The
 * ledger keeps what was spent and loses whose it was.
 *
 * Needs the service role, which is why this is a function at all: a browser
 * cannot delete an auth user, and should not be able to delete anybody's but
 * its own. The user is the one the token names, never one named in a body.
 */
Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

  let auth;
  try {
    auth = await authenticate(request);
  } catch (error) {
    if (error instanceof Unauthorized) return json(request, { error: 'unauthorized' }, 401);
    return json(request, { error: 'misconfigured' }, 500);
  }

  const { error } = await auth.elevated.auth.admin.deleteUser(auth.userId);
  if (error) return json(request, { error: 'delete_failed' }, 500);

  return json(request, { deleted: true });
});
