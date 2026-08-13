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

describe('ensureSession', () => {
  // Before, not only after. The static import at the top of this file has
  // already loaded ./session against the real ./client, so without a reset
  // here the dynamic import below returns that cached module and the mock
  // never takes effect — which fails silently as "signInAnonymously was
  // called 0 times", a message that looks like a bug in the guard.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./client');
    vi.resetModules();
  });

  /** A client whose sign-in never resolves until released, so both callers are
   *  genuinely in flight at the same time rather than merely appearing to be. */
  function mockClient() {
    let release: (() => void) | null = null;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    const signInAnonymously = vi.fn(async () => {
      await pending;
      return { data: { session: { user: { id: 'u1' } } }, error: null };
    });
    return {
      client: { auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously } },
      signInAnonymously,
      release: () => release?.(),
    };
  }

  it('creates exactly one session when called concurrently', async () => {
    // The regression this exists for: StrictMode invokes the mount effect
    // twice, both calls saw no session before either resolved, and the first
    // browser run of this phase produced two anonymous users eight
    // microseconds apart. In Phase 4 that means rows keyed to an identity the
    // second sign-in has already replaced.
    const { client, signInAnonymously, release } = mockClient();
    vi.doMock('./client', () => ({ supabase: client, isBackendConfigured: true }));

    const { ensureSession } = await import('./session');
    const both = Promise.all([ensureSession(), ensureSession()]);
    release();
    const [a, b] = await both;

    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('allows a later call to try again once the first has settled', async () => {
    const { client, signInAnonymously, release } = mockClient();
    vi.doMock('./client', () => ({ supabase: client, isBackendConfigured: true }));

    const { ensureSession } = await import('./session');
    release();
    await ensureSession();
    await ensureSession();

    // Twice, not once: the guard deduplicates simultaneous callers, it does
    // not cache the result forever. A session that expires must be
    // recoverable without a page reload.
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
  });

  it('resolves to null rather than throwing when there is no backend', async () => {
    vi.doMock('./client', () => ({ supabase: null, isBackendConfigured: false }));

    const { ensureSession } = await import('./session');
    await expect(ensureSession()).resolves.toBeNull();
  });
});
