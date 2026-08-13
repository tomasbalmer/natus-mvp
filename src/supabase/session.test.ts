import { describe as classify } from './session';
import type { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The classifier is pure and tested directly. The concurrency guard is tested
 * against a mocked client, because what it protects against is a race and a
 * race does not need a real Postgres to reproduce.
 *
 * What is NOT here: anonymous sign-in and the email upgrade against a live
 * stack. Those need Docker, and making `pnpm test` depend on it would break CI
 * on a machine that only wants to typecheck. They are verified against the
 * local stack instead and the result is recorded under Phase 2 of
 * specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md.
 */

function user(overrides: Partial<User>): User {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-13T00:00:00Z',
    ...overrides,
  } as User;
}

describe('describe', () => {
  it('reports none when there is no user', () => {
    expect(classify(null)).toEqual({ kind: 'none' });
  });

  it('reports anonymous for a user with no email', () => {
    const u = user({ is_anonymous: true });
    expect(classify(u)).toEqual({ kind: 'anonymous', user: u });
  });

  it('reports identified once an email is attached', () => {
    const u = user({ email: 'alguien@ejemplo.com', is_anonymous: false });
    expect(classify(u)).toEqual({
      kind: 'identified',
      user: u,
      email: 'alguien@ejemplo.com',
    });
  });

  it('trusts the email over a stale is_anonymous claim', () => {
    // The state between requesting an upgrade and following the link: the
    // claim still says anonymous, the address is already on the row. Calling
    // this person anonymous would offer them the signup screen again.
    const u = user({ email: 'alguien@ejemplo.com', is_anonymous: true });
    expect(classify(u).kind).toBe('identified');
  });

  it('does not treat an empty email as an identity', () => {
    const u = user({ email: '', is_anonymous: true });
    expect(classify(u).kind).toBe('anonymous');
  });
});

describe('currentSession', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./client');
    vi.resetModules();
  });

  it('never creates a session', async () => {
    // The regression this replaces a concurrency guard with. That guard
    // existed because this function used to sign in anonymously, and two
    // StrictMode invocations created two users eight microseconds apart.
    // DECISIONS.md section 13 put a door in front of the product, so an
    // identity must arrive only by walking through it — creating one here
    // would be a second way in, past the allow-list.
    const signInAnonymously = vi.fn();
    const client = {
      auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously },
    };
    vi.doMock('./client', () => ({ supabase: client, isBackendConfigured: true }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('returns the session there is', async () => {
    const session = { user: { id: 'u1' } };
    vi.doMock('./client', () => ({
      supabase: { auth: { getSession: async () => ({ data: { session } }) } },
      isBackendConfigured: true,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBe(session);
  });

  it('resolves to null rather than throwing when there is no backend', async () => {
    vi.doMock('./client', () => ({ supabase: null, isBackendConfigured: false }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBeNull();
  });

  it('resolves to null rather than throwing when the call fails', async () => {
    // A paused project. The demo degrades to fixtures; it does not end.
    vi.doMock('./client', () => ({
      supabase: {
        auth: {
          getSession: async () => {
            throw new Error('network');
          },
        },
      },
      isBackendConfigured: true,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBeNull();
  });
});
