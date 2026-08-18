# Natus MVP

A navigable demo of the Natus user product: onboarding, Soul Map, therapy
modality recommendations, routine, chat, meditations and chart comparison.

**This is a prototype, not a health service.** It presents crisis resources
because the product it demonstrates does, but it is not monitored, the hotline
numbers are marked unverified until someone confirms them by telephone, and
nobody is on the other end.

## What is real and what is staged

Without Supabase configuration the demo still runs entirely in the browser.
With it, profile data persists in Postgres and server-held integrations run in
authenticated Edge Functions.

| Module | Status | How |
|--------|--------|-----|
| Numerology (5 Pythagorean numbers) | **Real** | `src/lib/numerology.ts`, unit tested |
| Crisis detection, Layer 1 | **Real** | `src/lib/safety.ts`, unit tested |
| Modality hard filter | **Real** | `src/lib/matching.ts`, unit tested |
| Chart-comparison payload isolation | **Real** | `src/lib/comparison-payload.ts`, unit tested per scope |
| Onboarding, dashboard, library | **Real** | `localStorage` in place of Postgres |
| Meditation voice and sound bed | **Real** | Web Speech API + `OscillatorNode` |
| Consent, quota, two-step delete, export | **Real** | Enforced in code, not only in the UI |
| Chat | **Real with backend** | Edge Function: safety, then quota, then the model |
| Soul Map, matching prose, meditations, comparison | Fixtures or BYOK | see below |
| Natal chart | **Real with backend** | Astrologer API via an authenticated Edge Function |
| Payments, transactional email | Simulated | no charge, no mail is sent |

`src/lib` is written to migrate: no React, no `localStorage`, no browser API.
Those files are meant to be copied into `supabase/functions/_shared/lib`
unchanged when the real backend is built. See `docs/MIGRATION.md`.

## The three AI paths

**BYOK (opt in, wins when set).** Paste your own Anthropic API key and the
demo calls the model from the browser. The key is kept in `localStorage` and
is never sent anywhere except Anthropic. In this mode, what you type is sent
to Anthropic — the banner says so while it is on. It comes first on purpose:
somebody who typed their own credential asked for their own credential to be
spent.

**Server (signed in, backend configured).** An authenticated Edge Function
holds the key, runs crisis detection before anything else can answer, counts
the quota where the person cannot reach it, and records the call. Only `chat`
is wired so far — the other four surfaces reach the fixtures.

**Fixtures (default, and the offline path).** Curated responses for three
seeded profiles. Works offline, never fails during a live presentation, and
nothing you type leaves the browser. A deployment with no key answers
`no_model` and the app lands here deliberately.

All three validate their output against the same zod schemas and the same copy
lint, so a fixture that drifts from the contract breaks a test rather than the
demo.

## Running it

```bash
pnpm install
pnpm dev
```

| Command | Does |
|---------|------|
| `pnpm dev` | Development server |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests |
| `pnpm build` | Production build into `dist/` |

Deployment is automatic on push to `main` via `.github/workflows/deploy.yml`.

### Natal chart service

The browser never receives the RapidAPI key. Configure both secrets on the
Supabase project, then deploy the function:

```bash
supabase secrets set RAPIDAPI_KEY=...
supabase functions deploy natal-chart
```

The Edge Function resolves the birth city through Open-Meteo's geocoding API,
then sends its coordinates and IANA timezone to Astrologer. The app calls
`/api/v5/context/birth-chart` and stores the returned XML context with the
person's profile so the chart can be reused by the Soul Map.

### Chat model service

The browser never receives the Anthropic key either:

```bash
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy chat
```

Without it the function answers `no_model` and the app falls back to the
curated fixtures, which is a supported way to run the deployment rather than a
broken one.

The prompts the function uses are copied from `src/ai/prompts` by
`pnpm sync:shared`, the same way `src/lib` is, and `shared-parity.test.ts`
fails if a copy drifts. Run it after touching either.

To exercise the function against the real Edge runtime:

```bash
supabase start && supabase functions serve
node scripts/verify-chat-function.mjs
```

That covers everything up to the model gate and says so when the model itself
is not configured. Add `--env-file` with a key to cover the call too.

## Deliberate omissions

No streaks, badges, or re-engagement notifications. The product's stated goal
is user autonomy — "Natus se crea para dejar de existir" — and engagement is
explicitly not a success metric. If a ticket asks for a streak, this paragraph
is the reason to push back.

No binaural tones. They are contraindicated in epilepsy and would require an
extra clinical question. The synthesised sound beds are single-tone drones and
filtered noise.

No facilitator names and no match percentages. The demo recommends therapy
modalities, not people.

## Documents

| File | What |
|------|------|
| `specs/2026/08/NATUS-MVP/001-natus-mvp-static-demo.md` | Implementation plan, phase by phase |
| `docs/DECISIONS.md` | Why things are the way they are, and what was rejected |
| `docs/ASSETS.md` | Image origin and licensing |
| `docs/HANDOFF.md` | Transferring the repository to a new owner |
| `docs/MIGRATION.md` | Mapping this code onto Supabase, table by table |

The PDR itself is not committed. It lives in Nico's vault; `docs/DECISIONS.md`
distils the parts the code depends on, and every prompt reconstructed from it
carries a `-reconstructed` suffix so nothing here can be mistaken for the
original text.
