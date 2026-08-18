/**
 * The chat function, against the local Edge runtime.
 *
 * The assertion this exists for is the last one: **a person at zero remaining
 * questions who writes something desperate must be met with a hotline, not a
 * payment screen.** PDR 1.6 forbids a commercial fallback in that moment, and
 * the only thing standing between the product and that failure is the order of
 * two `if` blocks in supabase/functions/chat/index.ts. Ordering is not
 * something a type checker can hold.
 *
 *   supabase start && supabase functions serve
 *   node scripts/verify-chat-function.mjs
 *
 * Without a key the script covers everything up to the model gate and says so.
 * To cover the model itself — the contract, the lint and the ledger, against
 * the real API, for a few cents — serve with one:
 *
 *   echo 'ANTHROPIC_API_KEY=sk-ant-...' > supabase/.env.local
 *   supabase functions serve --env-file supabase/.env.local
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

const call = (body, headers = {}) =>
  fetch(`${API}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173',
      ...headers,
    },
    body: JSON.stringify(body),
  });

// ── CORS is present, and is not the control ─────────────────────────────────
const pre = await fetch(`${API}/functions/v1/chat`, {
  method: 'OPTIONS',
  headers: { Origin: 'http://localhost:5173' },
});
check('preflight answers 204', pre.status === 204, `status=${pre.status}`);
// Not asserted here: the value of Access-Control-Allow-Origin. The local
// Supabase gateway rewrites it to `*` on every response whatever the function
// sets, so this check could only ever confirm the gateway. The decision is
// unit-tested in src/lib/cors.test.ts instead, and the delivered header has to
// be confirmed against the deployed project in Phase 6.

// ── the JWT is the control ──────────────────────────────────────────────────
const noToken = await call({ message: 'hola' });
check('no bearer token is refused', noToken.status === 401, `status=${noToken.status}`);

const badToken = await call({ message: 'hola' }, { Authorization: 'Bearer not-a-jwt' });
check('a forged token is refused', badToken.status === 401, `status=${badToken.status}`);

const authed = { Authorization: `Bearer ${token}` };

// ── an ordinary turn ────────────────────────────────────────────────────────
//
// Sent with a complete context, because the function parses that only after
// the model gate: an incomplete body would be answered by the gate and the
// keyed branch below would never be reached.
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

const turn = {
  message: 'ultimamente me cuesta dormir',
  country: 'CL',
  synthesis: SYNTHESIS,
  numerology: null,
  risk: 'none',
  recommendedSlugs: ['terapia-cognitivo-conductual'],
  history: [],
};

const ordinary = await call(turn, authed);
const ordinaryBody = await ordinary.json();

if (ordinary.status === 503) {
  // No key configured. This is a declared state, not a failure: `runAi` reads
  // exactly this and falls back to the curated fixtures.
  check(
    'an ordinary turn reaches the model gate',
    ordinaryBody.error === 'no_model',
    `status=${ordinary.status} error=${ordinaryBody.error}`,
  );
  check(
    'and reports the remaining allowance',
    ordinaryBody.remaining === 3,
    `remaining=${ordinaryBody.remaining}`,
  );
  console.log('note  the model path is UNVERIFIED — serve with ANTHROPIC_API_KEY to cover it');
} else {
  // The last mile: the contract, the copy lint and the ledger, against the
  // real API. Costs a few cents per run, which is why it is opt-in.
  check('an ordinary turn answers', ordinary.status === 200, `status=${ordinary.status}`);
  check(
    'in one of the four shapes',
    ['reflection', 'recommendation', 'clarifying_question', 'crisis'].includes(
      ordinaryBody.result?.type,
    ),
    `type=${ordinaryBody.result?.type}`,
  );
  check(
    'with something to read',
    typeof ordinaryBody.result?.message_text === 'string' &&
      ordinaryBody.result.message_text.length > 0,
    `${ordinaryBody.result?.message_text?.slice(0, 60)}…`,
  );
  check(
    'naming only modalities that were offered',
    (ordinaryBody.result?.linked_modality_slugs ?? []).every((slug) =>
      turn.recommendedSlugs.includes(slug),
    ),
    (ordinaryBody.result?.linked_modality_slugs ?? []).join(','),
  );
  check(
    'and reports the remaining allowance',
    ordinaryBody.remaining === 2,
    `remaining=${ordinaryBody.remaining}`,
  );
  check(
    'and bills what it spent',
    Number.isInteger(ordinaryBody.input_tokens) && Number.isInteger(ordinaryBody.output_tokens),
    `in=${ordinaryBody.input_tokens} out=${ordinaryBody.output_tokens}`,
  );
}

// ── safety, before anything can answer ──────────────────────────────────────
const crisis = await call({ message: 'hace semanas que me quiero morir', country: 'CL' }, authed);
const crisisBody = await crisis.json();
check('a crisis turn is met with containment', crisisBody.type === 'crisis', crisisBody.type);
check('at high severity', crisisBody.severity === 'high', crisisBody.severity);
check(
  'with somewhere to call',
  Array.isArray(crisisBody.resources?.resources) && crisisBody.resources.resources.length > 0,
  `n=${crisisBody.resources?.resources?.length}`,
);
check('and costs nothing', crisisBody.counted === false, `counted=${crisisBody.counted}`);

// ── the quota is counted where the person cannot reach it ───────────────────
//
// Written directly as the person, through the anon key and RLS — which is
// exactly what somebody trying to inflate their own allowance would do. The
// function counts with the service role, so these are visible to it.
const spend = async (n) => {
  const { data: synthesis } = await client
    .from('soul_map_syntheses')
    .insert({ user_id: userId, prompt_version: 'v1', synthesis: {}, mode: 'fixture' })
    .select()
    .single();
  const { data: conversation } = await client
    .from('conversations')
    .insert({ user_id: userId, synthesis_id: synthesis.id })
    .select()
    .single();
  await client.from('messages').insert(
    Array.from({ length: n }, () => ({
      user_id: userId,
      conversation_id: conversation.id,
      role: 'assistant',
      type: 'reflection',
      text: 'x',
      counted: true,
    })),
  );
};

await spend(3);

const exhausted = await call({ message: 'otra pregunta mas' }, authed);
const exhaustedBody = await exhausted.json();
check(
  'at zero remaining an ordinary turn is refused',
  exhausted.status === 402 && exhaustedBody.error === 'quota_exhausted',
  `status=${exhausted.status} error=${exhaustedBody.error}`,
);

// ── THE ONE THAT MATTERS ────────────────────────────────────────────────────
const crisisAtZero = await call(
  { message: 'hace semanas que me quiero morir', country: 'CL' },
  authed,
);
const crisisAtZeroBody = await crisisAtZero.json();
check(
  'at zero remaining a crisis turn is STILL containment, not a paywall',
  crisisAtZero.status === 200 && crisisAtZeroBody.type === 'crisis',
  `status=${crisisAtZero.status} type=${crisisAtZeroBody.type} error=${crisisAtZeroBody.error}`,
);
check(
  'and still costs nothing',
  crisisAtZeroBody.counted === false,
  `counted=${crisisAtZeroBody.counted}`,
);

// ── the ledger ──────────────────────────────────────────────────────────────
const { data: logged } = await client
  .from('claude_api_calls')
  .select('outcome')
  .eq('user_id', userId);
const outcomes = (logged ?? []).map((r) => r.outcome).sort();
check(
  'every refusal is recorded',
  outcomes.filter((o) => o === 'refused_crisis').length === 2 &&
    outcomes.filter((o) => o === 'refused_quota').length === 1,
  outcomes.join(','),
);

if (ordinary.status === 200) {
  check(
    'and so is the turn that succeeded',
    outcomes.filter((o) => o === 'ok').length === 1,
    outcomes.join(','),
  );
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
