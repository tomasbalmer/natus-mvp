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
| Soul Map, matching, chat, meditations, comparison | **Real with backend** | five Edge Functions; fixtures without one |
| Natal chart | **Real with backend** | Astrologer API via an authenticated Edge Function |
| Payments, transactional email | Simulated | no charge, no mail is sent |

`src/lib` is written to migrate: no React, no `localStorage`, no browser API.
Those files are copied into `supabase/functions/_shared/lib` unchanged by
`pnpm sync:shared`, and `shared-parity.test.ts` fails if the two ever differ.

## The two AI paths

**Server (signed in, backend configured).** Five authenticated Edge Functions
— one per purpose, so a broken meditation prompt cannot take the Soul Map
down. Each holds the key, refuses to spend a token on somebody the
deterministic crisis scan flags, validates the answer against the same zod
schema the browser would, and records the call. The chat one also counts the
quota where the person cannot reach it.

**Fixtures (the default, and the offline path).** Curated responses for three
seeded profiles. Works offline, never fails during a live presentation, and
nothing you type leaves the browser. A deployment with no key answers
`no_model`; a visitor who is not signed in never reaches the function at all.
Both land here deliberately.

Both paths validate against the same zod schemas and the same copy lint, so a
fixture that drifts from the contract breaks a test rather than the demo.

There used to be a third: paste your own Anthropic key and the browser called
the model directly. It was how a static demo showed real generation, and it
was removed once every surface had a server — it kept a working credential in
`localStorage` and was the one path whose spend nobody could account for.
`api.anthropic.com` now appears nowhere in `src` or in the built bundle.

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

### The model services

The browser never receives the Anthropic key either:

```bash
supabase secrets set ANTHROPIC_API_KEY=...
supabase functions deploy soul-map
supabase functions deploy match
supabase functions deploy chat
supabase functions deploy meditation
supabase functions deploy comparison
```

Without the key they answer `no_model` and the app falls back to the curated
fixtures, which is a supported way to run the deployment rather than a broken
one.

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

### Deployment configuration

Nothing here is source. All of it is environment, because changing owner or
attaching a domain changes the answers and should not mean editing a file.

| Secret | Where | Without it |
|--------|-------|------------|
| `ANTHROPIC_API_KEY` | Supabase project | The five model functions answer `no_model` |
| `RAPIDAPI_KEY` | Supabase project | `natal-chart` answers `astrologer_not_configured` |
| `ALLOWED_ORIGINS` | Supabase project | CORS falls back to the two localhost origins, and a deployed browser silently discards every answer |
| `MONTHLY_BUDGET_USD` | Supabase project | Defaults to 50 |
| `SUPABASE_ACCESS_TOKEN` | GitHub repository **secret** | The `functions` job skips; the site still ships and the functions stay at the last hand-deployed version |

`ALLOWED_ORIGINS` is comma-separated, scheme and host, no path:

```bash
supabase secrets set ALLOWED_ORIGINS=https://<owner>.github.io
```

`MONTHLY_BUDGET_USD` is the ceiling on what the whole deployment may spend at
Anthropic in a rolling thirty days, counted from `claude_api_calls`. Past it
every model call is refused with 429 and the application falls back to its
curated fixtures. Per-person ceilings sit under it in `src/lib/budget.ts`.

Three more things are keyed to the public URL and all three break silently
when it changes: the Supabase redirect allow-list (Authentication → URL
Configuration), `ALLOWED_ORIGINS`, and the authorised redirect URI on the
Google OAuth client. None of them produces a useful error.

`VITE_BASE` decides the base path, and is set in the `Build` step of
`.github/workflows/deploy.yml`:

| Situation | `VITE_BASE` |
|-----------|-------------|
| `<owner>.github.io/natus-mvp/` | `/natus-mvp/` |
| Custom domain at the root | unset, or `/` |

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
| `CLAUDE.md` | Architecture, non-negotiables, and what is still open |
| `docs/ASSETS.md` | Image origin and licensing |

The PDR itself is not committed. It lives in Nico's vault, and every prompt
reconstructed from it carries a `-reconstructed` suffix so nothing here can be
mistaken for the original text.
