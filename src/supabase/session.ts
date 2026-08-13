import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

/**
 * Identity, from the first page load.
 *
 * This is the Supabase-side counterpart of `store/session.ts`'s
 * `getOrCreateSession`, and it exists for one reason: `auth.uid()` has to
 * return something before any Row Level Security policy means anything. An
 * anonymous sign-in gives a real `auth.users` row to somebody who has typed
 * nothing and agreed to nothing, which is exactly the state PDR 5.1
 * describes — the account is asked for after the Soul Map, never before.
 *
 * The upgrade path is why the model is anonymous-then-email rather than a
 * mandatory login. `updateUser({ email })` attaches an identity to the row
 * that already exists, so the eight onboarding answers underneath it are not
 * migrated, re-parented or re-asked. Signing up moves no data.
 */

export type AuthState =
  | { kind: 'none' }
  | { kind: 'anonymous'; user: User }
  | { kind: 'identified'; user: User; email: string };

export class AuthError extends Error {}

/**
 * In-flight guard. Without it, two concurrent callers both observe "no
 * session" before either has finished signing in, and both create one.
 *
 * This is not hypothetical: the first browser run of this phase produced two
 * anonymous users eight microseconds apart, because StrictMode invokes the
 * mount effect twice in development. Production would not have shown it, and
 * the consequence only becomes visible in Phase 4 — data keyed to a user_id
 * that a second sign-in has already replaced, written to an identity nobody
 * is holding any more.
 *
 * Deliberately not reset on failure to a value that would let a retry storm
 * through: a failed attempt resolves to null and is cleared, so the next
 * deliberate call may try again, but simultaneous callers still share one
 * attempt.
 */
let inFlight: Promise<Session | null> | null = null;

/**
 * Ensure a session exists, creating an anonymous one if it does not.
 *
 * Returns null when the backend is unconfigured or unreachable rather than
 * throwing. A paused free-tier project must degrade the demo to fixtures, not
 * end it — the same reasoning that already governs `store/db.ts`'s swallowed
 * reads. The caller decides what to do with the absence.
 */
export function ensureSession(): Promise<Session | null> {
  if (!supabase) return Promise.resolve(null);
  inFlight ??= acquire().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function acquire(): Promise<Session | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return created.session;
  } catch {
    // Network failure, DNS, a project mid-restore. Not a crash.
    return null;
  }
}

/**
 * Classify a user. Pure on its argument — no client, no network, no
 * environment — so it is testable without a running stack, which is the whole
 * reason it takes the user rather than fetching one.
 *
 * The email is the discriminator rather than the `is_anonymous` claim.
 * `is_anonymous` stays true on the session that requested an upgrade until the
 * confirmation link is followed, so trusting it would call somebody anonymous
 * after they had given an address, and trusting it the other way would call
 * them identified before they had confirmed one. The email is the observable
 * consequence of an upgrade having actually completed.
 */
export function describe(user: User | null): AuthState {
  if (!user) return { kind: 'none' };
  return user.email
    ? { kind: 'identified', user, email: user.email }
    : { kind: 'anonymous', user };
}

export async function currentUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Attach an email to the anonymous row that already exists.
 *
 * Sends a confirmation link; the row keeps its id, so everything already
 * keyed to `auth.uid()` stays keyed to it. Nothing here writes the profile —
 * that is the store's job, and in this phase the store is still local.
 *
 * `emailRedirectTo` points at the application root rather than a nested
 * route. Under GitHub Pages a nested path returns HTTP 404 with the app as
 * its body — the SPA fallback working correctly — and sending an auth
 * callback through it makes every future failure ambiguous.
 */
export async function upgradeToEmail(email: string): Promise<void> {
  if (!supabase) throw new AuthError('There is no backend configured.');

  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString() },
  );

  if (error) throw new AuthError(error.message);
}

export function onAuthChange(handler: (user: User | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    handler(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}
