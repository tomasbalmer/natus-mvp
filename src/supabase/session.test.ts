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
 * on a machine that only wants to typecheck. They are verified by hand
 * against the local stack instead.
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

  it('creates nothing while the door is closed', async () => {
    // The property that matters most here. With VITE_REQUIRE_INVITE on, an
    // identity must arrive by walking through Google; creating one silently
    // would be a second way in, past the allow-list.
    const signInAnonymously = vi.fn();
    vi.doMock('./client', () => ({
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously },
      },
      isBackendConfigured: true,
      requiresInvite: true,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously once the door is open', async () => {
    const session = { user: { id: 'u1' } };
    const signInAnonymously = vi.fn(async () => ({ data: { session }, error: null }));
    vi.doMock('./client', () => ({
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously },
      },
      isBackendConfigured: true,
      requiresInvite: false,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBe(session);
  });

  it('creates one identity, not two, when called concurrently', async () => {
    // StrictMode invokes the mount effect twice. Without the in-flight guard
    // both calls observe "no session" before either resolves and both sign
    // in — which produced two anonymous users eight microseconds apart the
    // first time this ran in a browser, and against Postgres would mean rows
    // keyed to a user_id the second sign-in had already replaced.
    let release = () => {};
    const pending = new Promise<void>((r) => {
      release = r;
    });
    const signInAnonymously = vi.fn(async () => {
      await pending;
      return { data: { session: { user: { id: 'u1' } } }, error: null };
    });
    vi.doMock('./client', () => ({
      supabase: {
        auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously },
      },
      isBackendConfigured: true,
      requiresInvite: false,
    }));

    const { currentSession } = await import('./session');
    const both = Promise.all([currentSession(), currentSession()]);
    release();
    const [a, b] = await both;

    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('returns the session there is', async () => {
    const session = { user: { id: 'u1' } };
    vi.doMock('./client', () => ({
      supabase: { auth: { getSession: async () => ({ data: { session } }) } },
      isBackendConfigured: true,
      requiresInvite: true,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBe(session);
  });

  it('resolves to null rather than throwing when there is no backend', async () => {
    vi.doMock('./client', () => ({ supabase: null, isBackendConfigured: false, requiresInvite: true }));

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
      requiresInvite: true,
    }));

    const { currentSession } = await import('./session');
    await expect(currentSession()).resolves.toBeNull();
  });
});
