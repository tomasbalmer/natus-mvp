import { read, write } from './db';
import { claimSession, emptyDraft, getSession, type OnboardingDraft } from './session';

/**
 * The `clients` row of PDR 5.2, and the conversion moment of PDR section 3.
 *
 * There is no authentication here and nothing to authenticate against: a
 * static page cannot verify an email or hold a password. What the demo does
 * implement is the part that carries product risk — the claim. Everything was
 * answered anonymously, and signing up has to move that record onto the
 * account without losing it and without letting it be claimed twice.
 *
 * PDR 5.2 keeps the birth data, the presenting need, the openness list and
 * `clinical_basics` as columns on `clients`. The anonymous session held them
 * in the meantime, so the claim is a copy, not a foreign key.
 */

export type Client = {
  id: string;
  email: string;
  created_at: number;
  profile: OnboardingDraft;
  soul_map_id: string | null;
  /** Which anonymous record this account grew out of. */
  claimed_session_id: string | null;
};

/**
 * Whose answers the rest of the app should read.
 *
 * Before signup that is the anonymous session; after signup the session is
 * claimed and stops serving reads, so every caller that used to reach for
 * `getSession()` has to come through here or it goes blank the moment someone
 * creates an account.
 */
export type ActiveProfile = {
  clientId: string | null;
  draft: OnboardingDraft;
  soulMapId: string | null;
};

export class SignupError extends Error {}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Math.trunc(performance.now())}`;
}

/** A shape check, not a validation. Nothing is ever sent to this address. */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function getClient(): Client | null {
  return read<Client | null>('client', null);
}

export function isSignedIn(): boolean {
  return getClient() !== null;
}

/**
 * PDR US-1.1 CA4. Idempotent: a second call with an account already present
 * returns the existing one rather than orphaning the first.
 */
export function signUp(input: { email: string; now?: number }): Client {
  const existing = getClient();
  if (existing) return existing;

  const email = input.email.trim();
  if (!isPlausibleEmail(email)) {
    throw new SignupError('That does not look like an email address.');
  }

  const now = input.now ?? Date.now();
  const session = getSession(now);

  const client: Client = {
    id: newId(),
    email,
    created_at: now,
    profile: session?.draft ?? emptyDraft(),
    soul_map_id: session?.soul_map_id ?? null,
    claimed_session_id: session?.id ?? null,
  };

  // Write the client first. If the claim were to run first and the write then
  // failed, the answers would be stranded in a session that no longer reads.
  write('client', client);
  claimSession(client.id, now);
  return client;
}

export function activeProfile(now = Date.now()): ActiveProfile | null {
  const client = getClient();
  if (client) {
    return {
      clientId: client.id,
      draft: client.profile,
      soulMapId: client.soul_map_id,
    };
  }

  const session = getSession(now);
  if (!session) return null;
  return { clientId: null, draft: session.draft, soulMapId: session.soul_map_id };
}

/** Keeps the account row in step when a Soul Map is generated after signup. */
export function attachSoulMapToClient(soulMapId: string): Client | null {
  const client = getClient();
  if (!client) return null;
  const next: Client = { ...client, soul_map_id: soulMapId };
  write('client', next);
  return next;
}
