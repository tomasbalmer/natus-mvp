import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * The access control. Not CORS — see the note at the top of `cors.ts`.
 *
 * Every function begins here. The caller presents the JWT the browser holds,
 * and the user is derived from it rather than read from the request body: a
 * `user_id` in a payload is a claim the caller made about themselves, and this
 * whole migration exists so that somebody's clinical answers are not reachable
 * by asking nicely.
 *
 * Two clients come out of this, and the difference matters:
 *
 *   caller   acts as the person, subject to RLS. Anything read on their
 *            behalf goes through here, so the policies still apply
 *            server-side. A function that reads with the service role has
 *            silently opted out of every guarantee in
 *            `supabase/tests/rls.test.sql`.
 *
 *   elevated bypasses RLS. For the two things the person must not be able to
 *            write: the quota count and `claude_api_calls`. A ledger the
 *            subject can edit is not a ledger.
 */

export type Caller = {
  userId: string;
  /** Subject to RLS, acting as this person. Use for everything by default. */
  caller: SupabaseClient;
  /** Bypasses RLS. Use only where the person must not be able to write. */
  elevated: SupabaseClient;
};

export class Unauthorized extends Error {}

export async function authenticate(request: Request): Promise<Caller> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) throw new Unauthorized('No bearer token.');

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) throw new Error('The function is not configured.');

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verified against the auth server rather than decoded here. A JWT read
  // without checking its signature is a base64 string the caller wrote.
  const { data, error } = await caller.auth.getUser();
  if (error || !data.user) throw new Unauthorized('The token did not verify.');

  const elevated = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userId: data.user.id, caller, elevated };
}
