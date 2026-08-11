# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

A static demo of the Natus user product — the consumer side of a
self-knowledge platform for Spanish-speaking LATAM. It is **not** a Waterplan
project; it happens to live inside that workspace. It is expected to be
transferred to another GitHub owner once presentable.

Live at https://tomasbalmer.github.io/natus-mvp/

**It is a prototype, not a health service.** It presents crisis resources and
asks about suicidal ideation because the product it demonstrates does. Nobody
is monitoring it and the hotline numbers are unverified.

## Read these before changing anything

| File | Why |
|------|-----|
| `docs/DECISIONS.md` | Why things are the way they are, and what was rejected. Start here |
| `specs/2026/08/NATUS-MVP/001-natus-mvp-static-demo.md` | The implementation plan, phase by phase, with verification results |

The source documents are `PDR — MVP Natus_ Producto del Usuario.txt` and
`natus-mockups (3).html`, both in `~/Downloads`. You rarely need them —
`DECISIONS.md` distils what matters. When they disagree, the mockups are the
**visual** truth (palette, typography, glass, photography) and the PDR is the
**functional** truth (flow, scope, copy rules, safety).

## Resuming work

The plan is at `Stage: Act`. Phases 0 to 5 are complete and verified.

```
/dev:pair act specs/2026/08/NATUS-MVP/001-natus-mvp-static-demo.md
```

That reads the stage, finds the first unchecked `- [ ]`, and continues.
Remaining: F6 dashboard, F7 chat, F8 meditations, F9 chart comparison,
F10 hardening.

Update the plan as you go — check steps off, record deviations inline, and
write the verification results under each phase. That file is how the next
session picks up.

## Architecture

Static SPA. No backend, no database, no server-held secret. GitHub Pages
serves files and nothing else.

```
src/lib/     Deterministic core. NO React, NO localStorage, NO browser API.
             numerology · safety · matching · copy-lint · schemas
             These migrate to supabase/functions/_shared/lib unchanged.
             Keeping them clean is the point — do not import from here.

src/store/   localStorage standing in for Postgres, one namespace per PDR
             table. Replaced wholesale by Supabase later; callers do not move.

src/ai/      One runAi with two paths: curated fixtures (default) and BYOK.
             Both parse the same zod schema and pass the same copy lint.

src/screens/ Route-level components.
data/        Seed JSON: modalities, topics, crisis resources, bed tracks.
```

## Validation

```
pnpm typecheck      tsc --noEmit
pnpm test           vitest, 244 tests
pnpm build          production build
pnpm dev            development server
```

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
