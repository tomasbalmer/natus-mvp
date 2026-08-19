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

## Read these before changing anything

| File | Why |
|------|-----|
| `docs/DECISIONS.md` | Why things are the way they are, and what was rejected. Start here |
| `specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md` | The current plan. Phases 0 to 5 done; Phase 6 is where work resumes |
| `specs/2026/08/NATUS-MVP/001-natus-mvp-static-demo.md` | The plan that built the demo. Complete — history, not instructions |
| `docs/HANDOFF.md` | What a transfer moves and what it silently breaks |

The source documents are `PDR — MVP Natus_ Producto del Usuario.txt` and
`natus-mockups (3).html`, both in `~/Downloads`. You rarely need them —
`DECISIONS.md` distils what matters. When they disagree, the mockups are the
**visual** truth (palette, typography, glass, photography) and the PDR is the
**functional** truth (flow, scope, copy rules, safety).

## Resuming work

Both plans are finished. 001 built the demo; 002 took it to Supabase and ran
past its own last phase into two unplanned ones — synastry, and ceilings on
what the model can cost. Everything in them is verified against production.

```
specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md
```

Read its Phase 6, 7 and 8 verification blocks before touching the backend.
They record what broke and why, and most of it was invisible until something
real ran.

**What is left is not code.** In rough order of weight:

- The sixteen crisis numbers carry `2026-08-19`, which records the product
  owner accepting them as transcribed from the PDR — not a call placed to each
  line. The calls are still owed. `docs/HANDOFF.md`.
- Eight of those sixteen are short codes and cannot be dialled from abroad.
  Nothing in the data records that.
- The door is open: `REQUIRE_INVITE=false`, so anybody with the link is in.
  Closing it needs a Google Cloud OAuth client first — the code is built and
  waiting, the console work is not done. `DECISIONS.md` §13.
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

Update the plan as you go — check steps off, record deviations inline, and
write the verification results under each phase. That file is how the next
session picks up.

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
             Call sites stayed synchronous; DECISIONS.md §12.

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
pnpm test           vitest, 694 tests
pnpm build          production build
pnpm dev            development server
pnpm sync:shared    re-copy src/lib and src/ai/prompts into _shared
```

Functions deploy on push, from the `functions` job that the site job waits on.
`pnpm deploy:functions` pushes them without a commit, which is what to use
while iterating on one.

All three must pass before a commit. CI runs the same and deploys on push to
`main`.

Verify UI work in a browser, not by reasoning about it. Every defect found in
phases 3 to 5 — a stopped wizard, an overlapping constellation, a stale match
— was invisible to the type checker and the test suite.

## Non-negotiables

These are product decisions, not preferences. `docs/DECISIONS.md` section 7
has the reasoning.

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
change. See `docs/HANDOFF.md`.

A nested route returns HTTP 404 with the application as its body. That is the
GitHub Pages SPA fallback working correctly, not a bug — the browser renders
it and the router takes over.
