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
let keyed = false;
for (const fn of Object.keys(BODIES)) {
  const response = await call(fn, BODIES[fn]);
  const body = await response.json();
  if (response.status === 503) {
    check(`${fn}: a valid request reaches the model gate`, body.error === 'no_model', `error=${body.error}`);
  } else {
    keyed = true;
    check(`${fn}: answers`, response.status === 200, `status=${response.status} ${JSON.stringify(body).slice(0, 90)}`);
    check(`${fn}: and bills what it spent`, Number.isInteger(body.input_tokens), `in=${body.input_tokens}`);
  }
}
if (!keyed) console.log('note  the model path is UNVERIFIED — serve with ANTHROPIC_API_KEY to cover it');

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

// ── the catalogue is the server's ───────────────────────────────────────────
const invented = await call('match', { ...BODIES.match, candidateSlugs: ['terapia-inventada'] });
check(
  'match: a modality that does not exist is refused, not described',
  invented.status === 400,
  `status=${invented.status}`,
);

// ── the ledger ──────────────────────────────────────────────────────────────
const { data: logged } = await client
  .from('claude_api_calls')
  .select('purpose,outcome')
  .eq('user_id', userId);
const refusals = (logged ?? []).filter((r) => r.outcome === 'refused_crisis').map((r) => r.purpose).sort();
check(
  'both crisis refusals are recorded, under their own purpose',
  refusals.join(',') === 'meditation,soul_map',
  refusals.join(',') || '(none)',
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
