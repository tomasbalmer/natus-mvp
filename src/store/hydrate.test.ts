import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_NAMESPACES } from './namespaces.ts';

/**
 * The delete path, where it reaches Postgres.
 *
 * `clearAll` in `db.ts` empties the mirror and `localStorage` without going
 * through `write`, so for a while "delete everything" emptied the browser and
 * left every row in place. The first fix handed each adapter `null`, and a
 * test here recorded those calls and passed — while all but two adapters read
 * `null` as data and the second one threw. What the delete does in Postgres
 * is proven in `remote.integration.test.ts`; this file proves only the
 * contract with the caller: one call, confirmed, or an error and the identity
 * kept.
 */

type Invoked = { fn: string };

function mockRemote(invoked: Invoked[], answer: { data: unknown; error: unknown }) {
  const ADAPTERS = Object.fromEntries(
    REMOTE_NAMESPACES.map((ns) => [ns, { load: async () => null, save: async () => {} }]),
  );
  vi.doMock('./remote.ts', () => ({ ADAPTERS }));
  vi.doMock('@/supabase/client.ts', () => ({
    supabase: {
      from: () => ({}),
      functions: {
        invoke: async (fn: string) => {
          invoked.push({ fn });
          return answer;
        },
      },
    },
  }));
  vi.doMock('@/supabase/session.ts', () => ({
    currentSession: async () => ({ user: { id: 'u1' } }),
  }));
}

const CONFIRMED = { data: { deleted: true }, error: null };

describe('purgeRemote', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./remote.ts');
    vi.doUnmock('@/supabase/client.ts');
    vi.doUnmock('@/supabase/session.ts');
    vi.resetModules();
  });

  it('does nothing when there is no signed-in identity', async () => {
    const invoked: Invoked[] = [];
    mockRemote(invoked, CONFIRMED);

    const { purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');

    // No hydration has happened, so there is no Postgres side to delete from.
    // The fixture path must reach the rest of the delete rather than throw.
    expect(hasRemoteIdentity()).toBe(false);
    await expect(purgeRemote()).resolves.toBeUndefined();
    expect(invoked).toEqual([]);
  });

  it('deletes the account in one call and lets go of the identity', async () => {
    const invoked: Invoked[] = [];
    mockRemote(invoked, CONFIRMED);

    const { hydrate, purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');
    await hydrate();
    expect(hasRemoteIdentity()).toBe(true);

    await purgeRemote();

    expect(invoked).toEqual([{ fn: 'delete-account' }]);
    expect(hasRemoteIdentity()).toBe(false);
  });

  it.each([
    ['the function fails', { data: null, error: new Error('500') }],
    ['the function answers without confirming', { data: {}, error: null }],
  ])('throws and keeps the identity when %s', async (_label, answer) => {
    const invoked: Invoked[] = [];
    mockRemote(invoked, answer);

    const { hydrate, purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');
    await hydrate();

    await expect(purgeRemote()).rejects.toThrow('delete-account');

    // The caller shows a failure and touches nothing local. Keeping the
    // identity is what lets somebody press the button again; clearing it
    // would leave an account that can no longer be deleted from this screen.
    expect(hasRemoteIdentity()).toBe(true);
  });
});

describe('hydrate', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('./remote.ts');
    vi.doUnmock('@/supabase/client.ts');
    vi.doUnmock('@/supabase/session.ts');
    vi.resetModules();
  });

  function mockLoads(failures: number) {
    let calls = 0;
    const ADAPTERS = Object.fromEntries(
      REMOTE_NAMESPACES.map((ns, i) => [
        ns,
        {
          load: async () => {
            // The first namespace is the one that goes out first, which is
            // the one PostgREST refuses with PGRST303 "JWT issued at future"
            // when the token was minted a moment ago in the same second.
            if (i === 0 && calls++ < failures) throw new Error('JWT issued at future');
            return null;
          },
          save: async () => {},
        },
      ]),
    );
    vi.doMock('./remote.ts', () => ({ ADAPTERS }));
    vi.doMock('@/supabase/client.ts', () => ({ supabase: { from: () => ({}) } }));
    vi.doMock('@/supabase/session.ts', () => ({
      currentSession: async () => ({ user: { id: 'u1' } }),
    }));
  }

  it('survives one refused load, which is what a freshly refreshed token gets', async () => {
    mockLoads(1);
    const { hydrate, hasRemoteIdentity } = await import('./hydrate.ts');

    const result = hydrate();
    await vi.runAllTimersAsync();

    expect(await result).toMatchObject({ kind: 'remote' });
    // The identity is what lets a write reach Postgres and "borrar todo"
    // reach the server. Without it the whole visit is local-only.
    expect(hasRemoteIdentity()).toBe(true);
  });

  it('still gives up, whole, when the retry fails too', async () => {
    mockLoads(2);
    const { hydrate, hasRemoteIdentity } = await import('./hydrate.ts');

    const result = hydrate();
    await vi.runAllTimersAsync();

    expect(await result).toEqual({ kind: 'local', reason: 'failed' });
    expect(hasRemoteIdentity()).toBe(false);
  });
});
