import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The one Supabase client.
 *
 * Both values below ship in the JavaScript bundle, and that is by design: the
 * publishable key is a public identifier, not a secret. It is safe only
 * because Row Level Security is enabled on every table — see
 * `supabase/migrations/*_rls_policies.sql` and the assertions in
 * `supabase/tests/rls.test.sql`. If RLS were ever disabled on a table, this
 * key would read it.
 *
 * The service-role key has no place in this file, in this repository, or in
 * any variable prefixed `VITE_`. Everything with that prefix is compiled into
 * the bundle and served to the world.
 */

const url = import.meta.env['VITE_SUPABASE_URL'];
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY'];

/**
 * Whether the backend is configured at all.
 *
 * A build without these is not broken — it is the fixture demo, which still
 * runs every screen offline. Callers branch on this rather than assuming a
 * client exists, so a paused project, a missing CI variable or a local
 * checkout with no `.env` degrades to the path that always worked.
 */
export const isBackendConfigured = Boolean(url && anonKey);

function create(): SupabaseClient | null {
  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: {
      // The session outlives the tab. Someone who answered eight onboarding
      // screens and closed the laptop has not withdrawn consent to be
      // remembered; PDR 5.1 gives the anonymous record seven days.
      persistSession: true,
      autoRefreshToken: true,
      // PKCE keeps the tokens out of the URL fragment. The code lands as a
      // query parameter and is exchanged against a verifier held in this
      // browser, so a copied link is not a session.
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  });
}

/**
 * Null when the backend is not configured. Deliberately not a throwing getter:
 * the fixture path is a supported way to run this application, not an error
 * state, and making every call site handle an exception would push that
 * decision into places that should not be making it.
 */
export const supabase: SupabaseClient | null = create();
