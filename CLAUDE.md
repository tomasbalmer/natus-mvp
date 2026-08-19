# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

The Natus user product — the consumer side of a self-knowledge platform for
Spanish-speaking LATAM. It is **not** a Waterplan project; it happens to live
inside that workspace. It is expected to be transferred to another GitHub
owner once presentable.

It began as a static demo and is no longer one: there is a Supabase project
behind it, with Postgres under Row Level Security, Google sign-in, and Edge
Functions holding the API keys. **The offline path is not vestigial** — a
build with no backend configured, or a visitor who has not signed in, still
renders every screen from curated fixtures. Keep it working.

Live at https://tomasbalmer.github.io/natus-mvp/

**It is a prototype, not a health service.** It presents crisis resources and
asks about suicidal ideation because the product it demonstrates does. Nobody
is monitoring it and the hotline numbers are unverified.

## Where the reasoning lives

**This file is it.** The design record — two implementation plans, a decision
log and a migration map, about 2,900 lines — was deleted once the product ran
end to end, deliberately and with the owner's decision on record. What is
below is what survived that, because it is still true rather than because it
happened. `git log` has the rest.

The consequence is worth stating plainly: nothing in this repository now
explains why a rejected alternative was rejected. Before reversing something
under **Non-negotiables**, ask — do not assume the absence of a reason means
there was not one.

The source documents are `PDR — MVP Natus_ Producto del Usuario.txt` and
`natus-mockups (3).html`, both in `~/Downloads`. When they disagree, the
mockups are the **visual** truth (palette, typography, glass, photography) and
the PDR is the **functional** truth (flow, scope, copy rules, safety).
`README.md` carries the deployment configuration; `docs/ASSETS.md` the image
licensing.

## Resuming work

The product runs end to end in production: onboarding, natal chart by
ephemeris, Soul Map, recommendations, chat, meditations and synastry, all with
real generation, all walked on the deployed site.

**What is left is not code.** In rough order of weight:

- The sixteen crisis numbers carry `2026-08-19`, which records the product
  owner accepting them as transcribed from the PDR — not a call placed to each
  line. The calls are still owed, and the PDR calls telephone verification an
  absolute launch blocker. Verify by calling, not by searching, then set the
  date again; re-verify every six months.
- Eight of those sixteen — 1515, 131, 911, 192, 106, 135, 113, 123 — are short
  codes and cannot be dialled from abroad. Nothing in the data records that, so
  somebody living abroad who selected their home country is shown a number they
  cannot ring. The international fallback on the same screen is all that covers
  it today.
- The door is open: `REQUIRE_INVITE=false`, so anybody with the link is in.
  Closing it needs a Google Cloud OAuth client first — the code is built and
  waiting, the console work is not done. Access control on GitHub Pages is an
  Enterprise feature, so the site itself cannot be restricted; the gate is the
  sign-in. Google rather than magic links because Supabase's built-in mail
  refuses anyone outside the project team, at two messages an hour.
- The free-tier pause question is still open.
- `crisis-keywords.json` is `"status": "preliminary"` and wants a clinician.

**Two open questions with the data now being collected for them:** whether the
prompt cache is worth its 25% write surcharge on the once-per-account surfaces
(`cache_read_tokens` answers it), and whether a retry should tell the model
what the first attempt got wrong (that adds text to the user message, so it is
the owner's call).

**The prompts are reconstructed, not the author's.** Every version string
carries `-reconstructed` because `07 - System Prompt IA.md` was never
available. Swapping in the real text is a change to constants in
`src/ai/prompts/shared.ts` and the five version strings. Do not edit prompt
text for any other reason without asking — the design is somebody's work.

Keep this section current. It is now the only handover there is: when one of
the items above closes, delete it, and when something new is left open, write
it down here.

## Architecture

An SPA on GitHub Pages, a Supabase project behind it. No secret is ever in the
bundle: the publishable key is a public identifier and is safe only because
RLS is on for every table.

```
src/lib/     Deterministic core. NO React, NO localStorage, NO browser API,
             NO `@/` imports, and relative imports carry their extension.
             numerology · safety · matching · copy-lint · schemas · ssml
             · model-input · model-json
             Copied verbatim into supabase/functions/_shared/lib by
             `pnpm sync:shared`. `shared-parity.test.ts` fails if the two
             ever differ — run the sync after touching anything in here.

src/store/   Postgres behind a synchronous in-memory mirror, hydrated once at
             session start. localStorage is the last-known-good fallback.
             Call sites stayed synchronous by design.

src/ai/      One runAi with two paths: an Edge Function when the backend is
             configured and the person is signed in, curated fixtures
             otherwise. Both parse the same zod schema and pass the same copy
             lint. Prompts also cross into _shared, under the same parity test.

src/screens/ Route-level components.
data/        Seed JSON: modalities, topics, crisis resources, bed tracks.

supabase/functions/
             soul-map · match · chat · meditation · comparison · natal-chart
             One directory, URL and worker each. Four share the sequence in
             _shared/serve-model.ts; chat has a quota to consult mid-flow.
```

**The module graph is only real when something serves it.** `tsc` does not see
the Edge runtime's resolution, and a missing file extension once took every
function down with nothing in the suite noticing. Before trusting a change to
`_shared`, run it:

```
supabase start && supabase functions serve
pnpm verify:chat && pnpm verify:models
```

## Validation

```
pnpm typecheck      tsc --noEmit
pnpm test           vitest, 752 tests
pnpm build          production build
pnpm dev            development server
pnpm sync:shared    re-copy src/lib and src/ai/prompts into _shared
```

Functions deploy on push, from the `functions` job that the site job waits on.
`pnpm deploy:functions` pushes them without a commit, which is what to use
while iterating on one.

All three must pass before a commit. CI runs the same and deploys on push to
`main`.

Verify UI work in a browser, not by reasoning about it. Every defect found
during the build — a stopped wizard, an overlapping constellation, a stale
match — was invisible to the type checker and the test suite.

## Non-negotiables

These are product decisions, not preferences. Each one was argued and settled;
the argument is no longer written down, which is a reason to ask rather than a
licence to reverse.

- **No streaks, badges, or re-engagement notifications.** `store/matches.ts`
  computes a total, never a consecutive run. The number a streak needs is not
  calculated anywhere.
- **No match percentages, ever.** The ranking orders; it does not score.
- **No facilitator names.** The MVP recommends modalities, not people.
- **Safety runs in front of the model, deterministically.** Clinical
  exclusions are a predicate, not a prompt instruction.
- **Raw `clinical_basics` never enters a model payload.** A derived risk level
  instead.
- **The copy lint governs fixtures as well as model output.** A hand-written
  fixture breaking a copy rule must fail a test.

## Dependencies

Exact pins only, no floating ranges. Every version is checked against a 7-day
release-age gate before installing — including GitHub Actions, which are
pinned to exact release tags. `vite` and `@types/node` are deliberately one
version behind for this reason.

## Language

Product copy is Spanish (rioplatense, voseo) because the UI is Spanish.
Everything else — code, comments, commits, docs, this file — is English.

## Deploying

Automatic on push to `main`. `VITE_BASE` is set in the workflow, so attaching
a custom domain or moving the repository to a new owner needs no source
change. See the deployment configuration table in `README.md`.

A nested route returns HTTP 404 with the application as its body. That is the
GitHub Pages SPA fallback working correctly, not a bug — the browser renders
it and the router takes over.
