import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REMOTE_NAMESPACES } from './namespaces.ts';

/**
 * The delete path, where it reaches Postgres.
 *
 * This is the half nobody could see. `clearAll` in `db.ts` empties the mirror
 * and `localStorage` without going through `write`, so it never touched the
 * persister — the browser emptied, every row stayed, and the next hydration
 * brought all of it back. The screen said "no hay copia en ningún lado" the
 * whole time.
 *
 * Tested against recorded adapters rather than a live Postgres because what
 * broke was not SQL. Every adapter already deletes correctly when handed
 * `null`; the defect was that nothing ever handed them one.
 */

type Saved = { ns: string; value: unknown };

function mockRemote(saves: Saved[], failOn?: string) {
  const ADAPTERS = Object.fromEntries(
    REMOTE_NAMESPACES.map((ns) => [
      ns,
      {
        load: async () => null,
        save: async (_c: unknown, _u: string, value: unknown) => {
          if (ns === failOn) throw new Error(`${ns}: nope`);
          saves.push({ ns, value });
        },
      },
    ]),
  );
  vi.doMock('./remote.ts', () => ({ ADAPTERS }));
  vi.doMock('@/supabase/client.ts', () => ({ supabase: { from: () => ({}) } }));
  vi.doMock('@/supabase/session.ts', () => ({
    currentSession: async () => ({ user: { id: 'u1' } }),
  }));
}

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
    const saves: Saved[] = [];
    mockRemote(saves);

    const { purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');

    // No hydration has happened, so there is no Postgres side to delete from.
    // The fixture path must reach the rest of the delete rather than throw.
    expect(hasRemoteIdentity()).toBe(false);
    await expect(purgeRemote()).resolves.toBeUndefined();
    expect(saves).toEqual([]);
  });

  it('deletes every remote namespace after hydrating', async () => {
    const saves: Saved[] = [];
    mockRemote(saves);

    const { hydrate, purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');
    await hydrate();
    expect(hasRemoteIdentity()).toBe(true);

    await purgeRemote();

    // Every one of them, and every one with `null` — the value each adapter
    // reads as "delete the rows for this user".
    expect(saves.map((s) => s.ns).sort()).toEqual([...REMOTE_NAMESPACES].sort());
    expect(saves.every((s) => s.value === null)).toBe(true);
  });

  it('deletes children before the rows they point at', async () => {
    const saves: Saved[] = [];
    mockRemote(saves);

    const { hydrate, purgeRemote } = await import('./hydrate.ts');
    await hydrate();
    await purgeRemote();

    const order = saves.map((s) => s.ns);
    const before = (a: string, b: string) => order.indexOf(a) < order.indexOf(b);

    // The schema cascades, so most of this would survive the wrong order by
    // accident. Asserting it makes the delete correct because of what the
    // function does rather than because of how the tables happen to be wired.
    expect(before('messages', 'conversations')).toBe(true);
    expect(before('chart_comparisons', 'comparison_consents')).toBe(true);
    expect(before('comparison_consents', 'external_profiles')).toBe(true);
    expect(before('soul_map_synthesis', 'client')).toBe(true);
  });

  it('stops at the first failure and keeps the identity', async () => {
    const saves: Saved[] = [];
    mockRemote(saves, 'conversations');

    const { hydrate, purgeRemote, hasRemoteIdentity } = await import('./hydrate.ts');
    await hydrate();

    await expect(purgeRemote()).rejects.toThrow('conversations');

    // The caller shows a failure and touches nothing local. Keeping the
    // identity is what lets somebody press the button again; clearing it
    // would leave an account that can no longer be deleted from this screen.
    expect(hasRemoteIdentity()).toBe(true);
    expect(saves.some((s) => s.ns === 'conversations')).toBe(false);
  });
});
