/**
 * Round-trip every store adapter against the local Supabase stack.
 *
 * `pnpm test` cannot do this: it would need Docker, and CI on a machine that
 * only wants to typecheck would start failing. So it lives here, is run by
 * hand, and its result is recorded under Phase 4 of
 * specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md.
 *
 * What it is actually for: fourteen adapters were written in one sitting and
 * only one of them — the onboarding draft — was exercised by clicking through
 * the application. The other thirteen had never run. This writes a value
 * through each, reads it back through the same adapter, and compares.
 *
 *   supabase start
 *   node scripts/verify-adapters.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const URL = 'http://127.0.0.1:54321';
const KEY = readFileSync('.env.local', 'utf8').match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/**
 * Key-order-insensitive comparison.
 *
 * Postgres `jsonb` does not preserve the key order it was given — it stores a
 * parsed tree and returns keys sorted. ComparisonScope goes in as
 * {numerology, astro, soul_map_themes} and comes back alphabetised, which is
 * correct behaviour and identical data. A naive JSON.stringify comparison
 * reports it as drift.
 */
const stable = (value) =>
  JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

const client = createClient(URL, KEY, { auth: { persistSession: false } });
const { data: auth, error: authErr } = await client.auth.signInAnonymously();
if (authErr) {
  console.error('could not sign in:', authErr.message);
  process.exit(1);
}
const userId = auth.session.user.id;
const uuid = () => crypto.randomUUID();

// The adapters are TypeScript with `@/` aliases, so they are imported through
// vite-node rather than plain node — see the npm script.
const { ADAPTERS } = await import('../src/store/remote.ts');

const now = Date.parse('2026-08-13T12:00:00.000Z');
const synthesisId = uuid();
const conversationId = uuid();
const profileId = uuid();
const consentId = uuid();

/**
 * Ordered: later fixtures reference ids created by earlier ones.
 *
 * A third element, where present, is what the round trip should return when
 * that differs from what went in — a column type deliberately narrower than
 * the value. Stating it beats loosening the comparison, which would stop the
 * suite noticing the difference at all.
 */
const cases = [
  ['preferences', { locale: 'en', voice_volume: 0.5, bed_volume: 0.25 }],
  ['subscription', { status: 'active', activated_at: now }],
  [
    'anonymous_session',
    {
      id: uuid(),
      created_at: now,
      expires_at: now + 604800000,
      step: 4,
      draft: {
        legal_birth_name: 'Ana Ruiz',
        birth_date: '1990-03-14',
        birth_time: '07:45',
        birth_city: 'Santiago',
        birth_country: 'CL',
        country: 'CL',
        locale: 'es',
        presenting_need_text: 'algo tiene que cambiar',
        presenting_need_slugs: ['perdida'],
        openness_to_modalities: ['psicologia-clinica', 'terapia-gestalt'],
        clinical_basics: { ideation_6m: 'fugaces_sin_plan', in_treatment: true },
        natal_chart: null,
      },
      soul_map_id: null,
      claimed_by: null,
    },
  ],
  [
    'soul_map_synthesis',
    [
      {
        id: synthesisId,
        prompt_version: 'v1-reconstructed',
        synthesis: { titulo: 'prueba' },
        numerology: { life_path: 9 },
        mode: 'fixture',
        // A float on purpose: performance.now() produces one, an integer
        // column refuses it, and the first version of this script used a
        // round number and therefore agreed with the schema instead of with
        // the application. That is how the defect reached a browser.
        latency_ms: 2.600000023841858,
        created_at: now,
        is_current: true,
      },
    ],
    // latency_ms comes back as an integer. The column is one.
    [
      {
        id: synthesisId,
        prompt_version: 'v1-reconstructed',
        synthesis: { titulo: 'prueba' },
        numerology: { life_path: 9 },
        mode: 'fixture',
        latency_ms: 3,
        created_at: now,
        is_current: true,
      },
    ],
  ],
  [
    'modality_matches',
    [
      {
        id: uuid(),
        prompt_version: 'v1',
        strategy: 'topical',
        used_fallback: false,
        synthesis_id: synthesisId,
        result: { matched_modalities: [] },
        reactions: { 'terapia-gestalt': { reaction: 'saved', at: now } },
        created_at: now,
        is_current: true,
      },
    ],
  ],
  ['recommendation_checkins', [{ practice_title: 'Respiración 4-7-8', checked_on: '2026-08-13' }]],
  ['conversations', [{ id: conversationId, synthesis_id: synthesisId, created_at: now }]],
  [
    'messages',
    [
      {
        id: uuid(),
        conversation_id: conversationId,
        role: 'assistant',
        type: 'clarifying_question',
        text: '¿Desde cuándo lo notás?',
        linked_modality_slugs: [],
        created_at: now,
        counted: true,
      },
    ],
  ],
  [
    'meditations',
    [
      {
        id: uuid(),
        intent: 'dormir',
        requested_minutes: 10,
        estimated_minutes: 9,
        script: { parts: [] },
        prompt_version: 'v1',
        mode: 'fixture',
        created_at: now,
      },
    ],
  ],
  [
    'external_profiles',
    [
      {
        id: profileId,
        display_name: 'R',
        legal_birth_name: 'Rosa Diaz',
        birth_date: '1988-07-02',
        birth_time: '13:20',
        birth_city: 'Lima',
        created_at: now,
      },
    ],
  ],
  [
    'comparison_consents',
    [
      {
        id: consentId,
        external_profile_id: profileId,
        scope: { numerology: true, astro: false, soul_map_themes: true },
        status: 'granted',
        requested_at: now,
        responded_at: now,
        expires_at: now + 1209600000,
      },
    ],
  ],
  [
    'chart_comparisons',
    [
      {
        id: uuid(),
        external_profile_id: profileId,
        consent_id: consentId,
        prompt_version: 'v1',
        result: { ejes: [] },
        mode: 'fixture',
        created_at: now,
      },
    ],
  ],
  [
    'crisis_events',
    [
      {
        id: uuid(),
        severity: 'low',
        category: 'indirecto',
        layer: 'deterministic',
        matched: ['no doy mas'],
        excerpt: 'ya no doy mas con esto',
        source_surface: 'chat',
        created_at: now,
        admin_notified_at: null,
        false_positive: null,
      },
    ],
  ],
  ['client', null],
];

for (const [ns, value, expected = value] of cases) {
  const adapter = ADAPTERS[ns];
  try {
    await adapter.save(client, userId, value);
    const back = await adapter.load(client, userId);
    const same = stable(back) === stable(expected);
    check(
      `${ns} round-trips`,
      same,
      same ? '' : `\n      expected ${stable(expected)}\n      read     ${stable(back)}`,
    );
  } catch (error) {
    check(`${ns} round-trips`, false, error.message);
  }
}

// The prune half of replaceRows: writing a shorter array must delete rows.
await ADAPTERS.meditations.save(client, userId, []);
const emptied = await ADAPTERS.meditations.load(client, userId);
check('an emptied array deletes its rows', emptied.length === 0, `rows=${emptied.length}`);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
