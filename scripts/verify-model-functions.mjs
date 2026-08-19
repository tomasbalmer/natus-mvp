/**
 * The four functions that share `_shared/serve-model.ts`, against the local
 * Edge runtime. `verify-chat-function.mjs` covers the fifth, which has a quota
 * and a crisis reply of its own and does not use the shared handler.
 *
 * The assertion this exists for is the second block: **a crisis is refused
 * before the key is checked.** `DECISIONS.md` §5 puts the deterministic scan
 * in front of the model, and "in front" has to survive a deployment that has
 * no model at all — otherwise the ordering silently reverses the moment
 * somebody forgets to set a secret, and nothing anywhere would say so.
 *
 * It also covers what the module graph cannot be trusted to prove: five
 * separate workers, each importing the shared library, the shared prompts and
 * zod through the import map. The type checker sees none of that. A missing
 * file extension took all of them down once already.
 *
 *   supabase start && supabase functions serve
 *   node scripts/verify-model-functions.mjs
 *
 * Serve with `--env-file` carrying ANTHROPIC_API_KEY to reach the model itself;
 * without one the script says which assertions it could not make.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const API = 'http://127.0.0.1:54321';
const env = readFileSync('.env.local', 'utf8');
const ANON = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim();

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const client = createClient(API, ANON, { auth: { persistSession: false } });
const { data: auth } = await client.auth.signInAnonymously();
const token = auth.session.access_token;
const userId = auth.session.user.id;
const authed = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const call = (fn, body, headers = authed) =>
  fetch(`${API}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', ...headers },
    body: JSON.stringify(body),
  });

const SYNTHESIS = {
  detected_phase: 'exploracion',
  detected_mode: 'exploracion',
  soul_map_synthesis: {
    tu_camino: 'Venís de un tiempo de mucho movimiento.',
    lo_que_estas_trabajando: 'Sostener algo sin necesitar que se resuelva ya.',
    que_necesitas_ahora: 'Un lugar donde bajar la velocidad.',
  },
  tips: [
    { title: 'Una pausa', body: 'Cortar el día por la mitad.', invitation: '¿Probás mañana?', cadence: 'daily' },
    { title: 'Escribir', body: 'Tres líneas, sin releer.', invitation: '¿Qué aparece?', cadence: 'weekly' },
    { title: 'Caminar', body: 'Veinte minutos sin destino.', invitation: '¿Cuándo te queda cómodo?', cadence: 'weekly' },
  ],
  follow_up_invitation: '¿Querés mirar alguna de estas de cerca?',
  inferred_topics: ['ansiedad', 'transicion'],
};

const DRAFT = {
  legal_birth_name: 'Ana Maria Perez',
  birth_date: '1990-04-12',
  birth_time: '14:30',
  birth_city: 'Santiago',
  country: 'CL',
  presenting_need_text: 'Siento que estoy en una transición y no encuentro dónde apoyarme.',
  presenting_need_slugs: [],
  openness_to_modalities: [],
  natal_chart: null,
};

// Real slugs, read from the same seed the functions read.
const MODALITIES = JSON.parse(readFileSync('data/modalities.json', 'utf8'))
  .modalities.filter((m) => m.is_active)
  .slice(0, 3)
  .map((m) => m.slug);

const BODIES = {
  'soul-map': { draft: DRAFT, numerology: null },
  match: {
    synthesis: SYNTHESIS,
    presentingNeedText: DRAFT.presenting_need_text,
    candidateSlugs: MODALITIES,
    strategy: 'topical',
    excludedForVulnerability: [],
    excludedForDismissal: [],
    droppedForSize: 0,
    poolBeforeTruncation: MODALITIES.length,
  },
  meditation: { intent: 'quiero bajar la ansiedad antes de dormir', minutes: 8, synthesis: SYNTHESIS, risk: 'none' },
  comparison: {
    scope: { numerology: true, astro: false, soul_map_themes: true },
    a: {
      display_name: 'Ana',
      numerology: {
        life_path: 8,
        expression: 11,
        soul_urge: 5,
        personality: 6,
        birthday: 3,
        master_numbers_present: [11],
        algorithm_version: 'pythagorean-v1',
      },
      soul_map_themes: ['ansiedad'],
      chart: { available: false, positions: [] },
    },
    b: {
      display_name: 'Nico',
      numerology: {
        life_path: 4,
        expression: 7,
        soul_urge: 9,
        personality: 2,
        birthday: 6,
        master_numbers_present: [],
        algorithm_version: 'pythagorean-v1',
      },
      soul_map_themes: [],
      chart: { available: false, positions: [] },
    },
  },
};

// ── the JWT is the control, on every one of them ────────────────────────────
for (const fn of Object.keys(BODIES)) {
  const anon = await call(fn, BODIES[fn], { 'Content-Type': 'application/json' });
  check(`${fn}: no bearer token is refused`, anon.status === 401, `status=${anon.status}`);
}

// ── a valid turn reaches the model gate ─────────────────────────────────────
//
// Three states, not two. A dummy key is the useful middle one: it makes every
// gate behind the key check reachable — the spend ceilings below, and the
// synastry enrichment — without spending anything at Anthropic, because the
// call fails at authentication rather than at billing.
//
//   503 no_model     no key. Nothing behind the gate can be exercised.
//   502 api_error    a key that Anthropic refused. Everything up to the call
//                    ran; the answer itself is still unverified.
//   200              a real key. The contract is checked.
let keyed = false;
let real = false;
for (const fn of Object.keys(BODIES)) {
  const response = await call(fn, BODIES[fn]);
  const body = await response.json();
  if (response.status === 503) {
    check(`${fn}: a valid request reaches the model gate`, body.error === 'no_model', `error=${body.error}`);
  } else if (response.status === 502 && body.kind === 'api_error') {
    keyed = true;
    check(`${fn}: a valid request reaches the model itself`, true, 'key refused upstream');
  } else {
    keyed = true;
    real = true;
    check(`${fn}: answers`, response.status === 200, `status=${response.status} ${JSON.stringify(body).slice(0, 90)}`);
    check(`${fn}: and bills what it spent`, Number.isInteger(body.input_tokens), `in=${body.input_tokens}`);
  }
}
if (!keyed) console.log('note  the model path is UNVERIFIED — serve with ANTHROPIC_API_KEY to cover it');
else if (!real) console.log('note  the key was refused upstream — the answer itself is still UNVERIFIED');

// ── safety runs in front of the model, and in front of the key check ────────
//
// Both surfaces where somebody writes in their own words. A `503 no_model`
// here would mean the scan sits behind the key, which is the reversal this
// block exists to catch.
const crisisSoulMap = await call('soul-map', {
  ...BODIES['soul-map'],
  draft: { ...DRAFT, presenting_need_text: 'hace semanas que me quiero morir' },
});
check(
  'soul-map: a crisis is refused before the key is checked',
  crisisSoulMap.status === 403 && (await crisisSoulMap.json()).error === 'refused_crisis',
  `status=${crisisSoulMap.status}`,
);

const crisisMeditation = await call('meditation', {
  ...BODIES.meditation,
  intent: 'hace semanas que me quiero morir',
});
check(
  'meditation: the same, on the intent',
  crisisMeditation.status === 403 && (await crisisMeditation.json()).error === 'refused_crisis',
  `status=${crisisMeditation.status}`,
);

// ── the aspect list is the server's, not the caller's ───────────────────────
const supplied = await call('comparison', {
  ...BODIES.comparison,
  scope: { numerology: true, astro: true, soul_map_themes: true },
  aspects: [{ a_body: 'Sun', b_body: 'Moon', type: 'conjunction', orb: 1.2 }],
});
check(
  'comparison: a caller-supplied aspect list is refused',
  supplied.status === 400,
  `status=${supplied.status}`,
);

// Birth data under the astro scope parses and reaches the gate. Whether the
// ephemeris then answers cannot be checked here: RAPIDAPI_KEY lives on the
// deployed project, and `enrich` runs after the model gate anyway, so a
// runtime with no ANTHROPIC_API_KEY never reaches it.
const BIRTH_A = { year: 1990, month: 4, day: 12, hour: 14, minute: 30, city: 'Santiago', nation: 'CL' };
const BIRTH_B = { year: 1988, month: 9, day: 3, hour: 7, minute: 15, city: 'Buenos Aires', nation: 'AR' };
const withBirth = await call('comparison', {
  ...BODIES.comparison,
  scope: { numerology: true, astro: true, soul_map_themes: true },
  a: { ...BODIES.comparison.a, birth: BIRTH_A },
  b: { ...BODIES.comparison.b, birth: BIRTH_B },
});
const withBirthBody = await withBirth.json();
check(
  'comparison: birth data under the astro scope is accepted',
  // Accepted means parsed and carried past validation, whatever the model
  // then did with it. 400 would be the failure this asserts against.
  withBirth.status !== 400,
  `status=${withBirth.status} error=${withBirthBody.error}`,
);

const badNation = await call('comparison', {
  ...BODIES.comparison,
  scope: { numerology: true, astro: true, soul_map_themes: true },
  a: { ...BODIES.comparison.a, birth: { ...BIRTH_A, nation: 'Chile' } },
  b: { ...BODIES.comparison.b, birth: BIRTH_B },
});
check(
  'comparison: a country that is not an ISO code is refused',
  badNation.status === 400,
  `status=${badNation.status}`,
);

// ── the catalogue is the server's ───────────────────────────────────────────
const invented = await call('match', { ...BODIES.match, candidateSlugs: ['terapia-inventada'] });
check(
  'match: a modality that does not exist is refused, not described',
  invented.status === 400,
  `status=${invented.status}`,
);

// ── the spend ceilings ──────────────────────────────────────────────────────
//
// Only reachable when the deployment has a key: the gate sits behind the model
// check, so that a keyless deployment does not run two queries to say
// `no_model`. Serve with a dummy ANTHROPIC_API_KEY to exercise it — the
// refusal happens before anything is sent to Anthropic, so the key never has
// to be real.
if (keyed) {
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE) {
    console.log('note  spend ceilings UNVERIFIED — set SUPABASE_SERVICE_ROLE_KEY to cover them');
  } else {
    const elevated = createClient(API, SERVICE, { auth: { persistSession: false } });
    // Written with the service role because that is who writes the ledger. A
    // person cannot insert here, which is the point of counting from it.
    const rows = Array.from({ length: 10 }, () => ({
      user_id: userId,
      purpose: 'soul_map',
      prompt_version: 'v1',
      model: 'claude-opus-5',
      mode: 'server',
      outcome: 'ok',
      input_tokens: 3000,
      output_tokens: 1200,
      cache_write_tokens: 1900,
      cache_read_tokens: 0,
    }));
    const { error: seedError } = await elevated.from('claude_api_calls').insert(rows);
    check('the ledger accepts the elevated write', !seedError, seedError?.message ?? '');

    const capped = await call('soul-map', BODIES['soul-map']);
    const cappedBody = await capped.json();
    check(
      'soul-map: a person at their ceiling is refused before the model is called',
      capped.status === 429 && cappedBody.scope === 'person',
      `status=${capped.status} scope=${cappedBody.scope}`,
    );

    // A different purpose is unaffected: the ceilings are per purpose, so one
    // exhausted surface must not close the others.
    const other = await call('meditation', BODIES.meditation);
    check(
      'meditation: another purpose is untouched by it',
      other.status !== 429,
      `status=${other.status}`,
    );
  }
}

// ── the ledger ──────────────────────────────────────────────────────────────
const { data: logged } = await client
  .from('claude_api_calls')
  .select('purpose,outcome')
  .eq('user_id', userId);
const refusals = (logged ?? []).filter((r) => r.outcome === 'refused_crisis').map((r) => r.purpose).sort();
// Seeded rows are 'ok', so they do not appear here.
check(
  'both crisis refusals are recorded, under their own purpose',
  refusals.join(',') === 'meditation,soul_map',
  refusals.join(',') || '(none)',
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
