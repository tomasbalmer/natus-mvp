import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import type { TypedClient } from '@/supabase/client.ts';
import type { Database } from '@/supabase/database.types.ts';
import { ADAPTERS } from './remote.ts';
import type { ComparisonConsent, ExternalProfile, StoredComparison } from './comparison.ts';

/**
 * The adapters, against a real Postgres.
 *
 * `hydrate.test.ts` records adapter calls and `rls.test.sql` reads rows as a
 * hostile stranger; neither ever wrote the same table twice through the code
 * the application ships. The defects below lived exactly there, and every
 * other test passed over them.
 *
 * Needs a local stack: `supabase start`, then `pnpm test:db`, which also
 * serves the functions. Skipped when the
 * variables are absent, so `pnpm test` and CI are unchanged.
 */

const URL = process.env['SUPABASE_TEST_URL'];
const ANON = process.env['SUPABASE_TEST_ANON_KEY'];
const SERVICE = process.env['SUPABASE_TEST_SERVICE_KEY'];
const DB_CONTAINER = process.env['SUPABASE_TEST_DB_CONTAINER'];
const configured = Boolean(URL && ANON && SERVICE && DB_CONTAINER);

const OWNED_TABLES = [
  'anonymous_sessions',
  'clients',
  'preferences',
  'subscriptions',
  'soul_map_syntheses',
  'modality_matches',
  'match_reactions',
  'recommendation_checkins',
  'conversations',
  'messages',
  'meditations',
  'external_profiles',
  'comparison_consents',
  'chart_comparisons',
  'crisis_events',
] as const satisfies ReadonlyArray<keyof Database['public']['Tables']>;

type Person = { client: TypedClient; userId: string };

async function signIn(): Promise<Person> {
  const client = createClient<Database>(URL!, ANON!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw new Error(`sign-in: ${error?.message}`);
  return { client, userId: data.user.id };
}

/** Auth administration only: the service role is granted almost no table. */
function admin() {
  return createClient<Database>(URL!, SERVICE!, { auth: { persistSession: false } });
}

/**
 * Counted as the database owner, past every policy and grant, so a row a
 * policy hides from its owner still counts as left behind.
 */
function rowsOwnedBy(userId: string): Record<string, number> {
  const sql = OWNED_TABLES.map(
    (t) => `select '${t}', count(*) from public.${t} where user_id = '${userId}'`,
  ).join(' union all ');
  const out = execFileSync(
    'docker',
    ['exec', DB_CONTAINER!, 'psql', '-U', 'postgres', '-tAF', ',', '-c', sql],
    { encoding: 'utf8' },
  );
  const counts: Record<string, number> = {};
  for (const line of out.trim().split('\n')) {
    const [table, count] = line.split(',');
    if (table && Number(count) > 0) counts[table] = Number(count);
  }
  return counts;
}

/**
 * The functions' own quota and ledger code, run from Node. Loaded by a
 * computed path so `tsc` does not follow it into `jsr:` imports it cannot
 * resolve — the Edge runtime checks those, and `pnpm test:db` exercises them.
 */
async function edgeShared(): Promise<{
  currentQuota: (client: unknown, userId: string) => Promise<{ used: number }>;
  logCall: (client: unknown, record: Record<string, unknown>) => Promise<void>;
}> {
  const base = '../../supabase/functions/_shared';
  const [quota, log] = await Promise.all([
    import(/* @vite-ignore */ `${base}/quota.ts`),
    import(/* @vite-ignore */ `${base}/log.ts`),
  ]);
  return { currentQuota: quota.currentQuota, logCall: log.logCall };
}

const NOW = Date.now();

function profile(): ExternalProfile {
  return {
    id: crypto.randomUUID(),
    display_name: 'Ana',
    legal_birth_name: 'Ana Pérez',
    birth_date: '1990-04-12',
    birth_time: '',
    birth_city: 'Córdoba',
    birth_country: 'AR',
    created_at: NOW,
  };
}

function grantedConsent(externalProfileId: string): ComparisonConsent {
  return {
    id: crypto.randomUUID(),
    external_profile_id: externalProfileId,
    scope: { numerology: true, astro: false, soul_map_themes: false },
    status: 'granted',
    requested_at: NOW,
    responded_at: NOW,
    expires_at: NOW + 14 * 24 * 3_600_000,
  };
}

function comparison(p: ExternalProfile, c: ComparisonConsent): StoredComparison {
  return {
    id: crypto.randomUUID(),
    external_profile_id: p.id,
    consent_id: c.id,
    prompt_version: 'test',
    result: {} as StoredComparison['result'],
    mode: 'fixture',
    created_at: NOW,
  };
}

describe.skipIf(!configured)('adapters against Postgres', () => {
  const people: Person[] = [];
  const person = async () => {
    const p = await signIn();
    people.push(p);
    return p;
  };

  afterAll(async () => {
    for (const p of people) await admin().auth.admin.deleteUser(p.userId);
  });

  it('a second comparison saves beside the first', async () => {
    const { client, userId } = await person();
    const a = profile();
    const b = profile();
    const ca = grantedConsent(a.id);
    const cb = grantedConsent(b.id);
    await ADAPTERS.external_profiles.save(client, userId, [a, b]);
    await ADAPTERS.comparison_consents.save(client, userId, [ca, cb]);

    const first = comparison(a, ca);
    await ADAPTERS.chart_comparisons.save(client, userId, [first]);
    await ADAPTERS.chart_comparisons.save(client, userId, [first, comparison(b, cb)]);

    expect(await ADAPTERS.chart_comparisons.load(client, userId)).toHaveLength(2);
  });

  it('a lapsed consent does not block the next comparison', async () => {
    const { client, userId } = await person();
    const a = profile();
    const b = profile();
    const ca = grantedConsent(a.id);
    const cb = grantedConsent(b.id);
    await ADAPTERS.external_profiles.save(client, userId, [a, b]);
    await ADAPTERS.comparison_consents.save(client, userId, [ca, cb]);
    const first = comparison(a, ca);
    await ADAPTERS.chart_comparisons.save(client, userId, [first]);

    // Revoked, and the mirror still holds the reading it produced — exactly
    // what the store looks like until the next hydration.
    await ADAPTERS.comparison_consents.save(client, userId, [{ ...ca, status: 'revoked' }, cb]);
    await ADAPTERS.chart_comparisons.save(client, userId, [first, comparison(b, cb)]);

    expect(rowsOwnedBy(userId)['chart_comparisons']).toBe(2);
    expect(await ADAPTERS.chart_comparisons.load(client, userId)).toHaveLength(1);
  });

  it('a reading hidden by a revoked consent goes with its profile', async () => {
    const { client, userId } = await person();
    const p = profile();
    const c = grantedConsent(p.id);
    await ADAPTERS.external_profiles.save(client, userId, [p]);
    await ADAPTERS.comparison_consents.save(client, userId, [c]);
    await ADAPTERS.chart_comparisons.save(client, userId, [comparison(p, c)]);
    await ADAPTERS.comparison_consents.save(client, userId, [{ ...c, status: 'revoked' }]);

    // deleteExternalProfile in comparison.ts, in its order.
    await ADAPTERS.external_profiles.save(client, userId, []);
    await ADAPTERS.comparison_consents.save(client, userId, []);
    await ADAPTERS.chart_comparisons.save(client, userId, []);

    expect(rowsOwnedBy(userId)).toEqual({});
  });

  it('asking the same person again replaces the consent', async () => {
    const { client, userId } = await person();
    const p = profile();
    await ADAPTERS.external_profiles.save(client, userId, [p]);
    await ADAPTERS.comparison_consents.save(client, userId, [grantedConsent(p.id)]);

    const again: ComparisonConsent = {
      ...grantedConsent(p.id),
      status: 'pending',
      responded_at: null,
    };
    await ADAPTERS.comparison_consents.save(client, userId, [again]);

    const loaded: ComparisonConsent[] = await ADAPTERS.comparison_consents.load(client, userId);
    expect(loaded.map((c) => c.id)).toEqual([again.id]);
  });

  it('deleting the account leaves no row behind', async () => {
    const { client, userId } = await person();
    const p = profile();
    await ADAPTERS.preferences.save(client, userId, { locale: 'es', voice_volume: 1, bed_volume: 0.45 });
    await ADAPTERS.subscription.save(client, userId, { status: 'active', activated_at: NOW });
    await ADAPTERS.external_profiles.save(client, userId, [p]);
    const c = grantedConsent(p.id);
    await ADAPTERS.comparison_consents.save(client, userId, [c]);
    await ADAPTERS.chart_comparisons.save(client, userId, [comparison(p, c)]);
    expect(Object.keys(rowsOwnedBy(userId)).length).toBeGreaterThan(0);

    // The call purgeRemote makes, against the function `supabase functions
    // serve` is running.
    const { data, error } = await client.functions.invoke('delete-account', { method: 'POST' });
    expect(error).toBeNull();
    expect(data).toEqual({ deleted: true });

    expect(rowsOwnedBy(userId)).toEqual({});
    const { data: user } = await admin().auth.admin.getUserById(userId);
    expect(user.user).toBeNull();
  });

  it('the chat quota cannot be given back by the person it limits', async () => {
    const { client, userId } = await person();
    const { currentQuota, logCall } = await edgeShared();

    // What the chat function records: two answered turns and one crisis turn,
    // which is never charged.
    const turn = { userId, purpose: 'chat' as const, promptVersion: 'test', model: 'test', latencyMs: 0 };
    await logCall(admin(), { ...turn, mode: 'server', outcome: 'ok', charged: true });
    await logCall(admin(), { ...turn, mode: 'server', outcome: 'ok', charged: true });
    await logCall(admin(), { ...turn, mode: 'fixture', outcome: 'refused_crisis' });

    const before = await currentQuota(admin(), userId);
    expect(before.used).toBe(2);

    // Everything the browser can reach, tried.
    await client.from('messages').delete().eq('user_id', userId);
    await client.from('claude_api_calls').delete().eq('user_id', userId);
    await client.from('claude_api_calls').update({ charged: false }).eq('user_id', userId);

    expect(await currentQuota(admin(), userId)).toEqual(before);
  });
});
