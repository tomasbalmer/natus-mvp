# Natus MVP — Supabase Backend Migration

Stage: `Plan`
Last Updated: 2026-08-13

## High-Level Objective

Give the Natus demo a real backend without giving it a real server to operate.
Postgres holds the data, Row Level Security holds the promises, and Edge
Functions hold the keys. GitHub Pages keeps doing the one thing it does well:
serving static files.

The target is fifty pilot users whose data persists across sessions, and an AI
path that works for every one of them without anybody pasting an API key. That
is the whole ambition of this round. It is deliberately smaller than
`docs/MIGRATION.md`, which describes the full production destination; this plan
executes the first four of its six steps and leaves the rest named and
untouched.

## Mid-Level Objectives

- [ ] Stand up a Supabase schema covering the seventeen namespaces declared in
      `src/store/db.ts`, following the table mapping already written in
      `docs/MIGRATION.md`, with Row Level Security enabled on every table before
      any application code reads from it.
- [ ] Prove the two load-bearing policies with tests: nobody reads a
      `chart_comparisons` row without a granted, unexpired consent, and nobody
      reads another client's `clinical_basics` by any route.
- [ ] Give every visitor a real `auth.users` row via Supabase anonymous
      sign-in, and let anyone who wants to keep their data upgrade that same row
      to an email identity with no data migration.
- [ ] Copy `src/lib` into `supabase/functions/_shared/lib` unchanged, with its
      existing tests passing on the other side — the proof that the boundary
      held.
- [ ] Repoint `src/store` at Supabase without rewriting `src/screens`, which
      today calls the store synchronously from render bodies.
- [ ] Move the Anthropic key server-side behind one Edge Function per purpose,
      reusing the existing prompts, zod schemas and copy lint untouched.
- [ ] Keep the fixture path alive as the degraded mode, and delete only the
      BYOK path.
- [ ] Make the chat quota real before the chat is open to anyone.

## Context

### Prior art — read before touching anything

| Document | What it already settles |
|----------|-------------------------|
| `docs/MIGRATION.md` | The table-by-table store mapping, the `_shared/lib` copy list, the two RLS policies that carry product promises, and a six-step order. **This plan is the execution of its steps 1 to 4.** Do not restate it here; follow it |
| `docs/DECISIONS.md` | §3 rejected a server-side proxy, §5 fixes safety as deterministic and in front, §7 lists the deliberate absences |
| `specs/2026/08/NATUS-MVP/001-natus-mvp-static-demo.md` | The demo this migrates. Stage `Act`, phases 0 to 10 |
| `CLAUDE.md` | Non-negotiables, validation commands, dependency policy |

### The decision this round reverses

`docs/DECISIONS.md` §3 rejected a server-side proxy in these words: it
"reintroduces a server to a project whose whole premise is that it does not
have one", and it "puts a spend-anything endpoint on a public URL".

Both objections were correct, and the first no longer applies. The premise
changed: this stopped being a static demo the moment it acquired fifty users
whose data has to persist. The second objection still stands entirely, and it
is why the quota becomes real in this round rather than the next one — an Edge
Function that calls Anthropic without a per-user ceiling is exactly the
spend-anything endpoint §3 warned about.

This is recorded as a superseding decision in Phase 0, not as an edit that
quietly makes the old reasoning disappear.

### Architecture

```
GitHub Pages (static, unchanged)      Supabase
┌──────────────────┐                  ┌────────────────────────┐
│ index.html       │                  │ Postgres + RLS         │
│ assets/*.js      │───── fetch ────▶ │ Auth (anon + upgrade)  │
│ 404.html         │                  │ Edge Functions ────────┼──▶ Anthropic
└──────────────────┘                  └────────────────────────┘
      ▲
      └── deploy workflow gains exactly two env lines
```

### Constraints that shape the phases

**The anon key ships in the bundle.** That is by design and it is safe only if
RLS is on for every table. The data here includes `clinical_basics`. RLS
therefore lands in Phase 1, before a single screen reads from Postgres, and
Phase 1 is not done until the policy tests pass.

**CORS cannot be an access control.** The origin is
`https://tomasbalmer.github.io` — the entire domain, shared with every other
repository the owner publishes to Pages. An `Access-Control-Allow-Origin`
naming that host authorises every one of them equally. Every Edge Function
therefore validates the Supabase JWT and derives the user from it. CORS is
hygiene; the JWT is the control.

**Edge Functions need CORS written by hand.** The REST and Auth endpoints
accept any origin already. Edge Functions do not: each one needs an `OPTIONS`
preflight handler and explicit headers, and forgetting it produces a failure
that looks like the function is down.

**The router runs under a base path.** `src/main.tsx` uses
`BrowserRouter basename={import.meta.env.BASE_URL}`, which is `/natus-mvp/`.
The Supabase Site URL and redirect allowlist must include that subpath. Send
the auth callback to the base root, which returns HTTP 200; a nested route
returns 404-with-the-app-as-body through the `404.html` fallback, which works
but makes every future auth bug look like a routing bug.

**The repository is expected to change owner.** `docs/HANDOFF.md` covers this.
A new owner is a new origin, so the redirect allowlist and the CORS allowlist
are environment configuration and must stay that way — the same reasoning that
already keeps `VITE_BASE` out of the source.

**Free-tier projects pause.** A Supabase project with roughly a week of no
activity is suspended, and the next visitor pays a cold start or an error. For
a product demonstrated occasionally rather than used daily, this is a live
failure mode and not a hypothetical one. See the prerequisites.

**Fixture mode survives.** `runAi` has two paths today. The BYOK path goes; the
fixture path stays, and becomes the degraded mode for a paused project, a
network failure, or a demo given offline. The current architecture provides
this for free and discarding it during the migration would be a real loss.

### The finding that shapes Phase 4

`docs/MIGRATION.md` says of `src/store`: "call sites do not move;
implementations do." That is the intent, and it is very nearly true — but the
call sites are synchronous, and they are in render bodies:

```
src/screens/Dashboard.tsx:46
  const profile = activeProfile();
  const synthesis = currentSynthesis();
```

Neither is a hook and neither is inside an effect. A React component cannot
await in its render body, so swapping `localStorage` for a network client is
not a matter of propagating `await` through the call sites. Something has to
absorb the asynchrony. Twenty-eight files import from `@/store`.

Three ways to absorb it:

| Approach | Screens change | New dependency | Risk |
|----------|---------------|----------------|------|
| **A. Hydrate-once into context** | Barely | None | Write-through and multi-tab staleness |
| **B. TanStack Query** | Every read becomes a hook | `@tanstack/react-query` | Most churn; also the most conventional |
| **C. Hand-rolled effect per screen** | Every read, by hand | None | 28 files of loading-state boilerplate and stale reads |

**Approach A — confirmed 2026-08-13, recorded as `DECISIONS.md` §12.** One
user's entire dataset here is small — a synthesis,
a handful of matches, some messages, some meditations. Loading it into a
context at session start and keeping a synchronous in-memory mirror preserves
the promise `MIGRATION.md` made, keeps the screens as they are, and keeps the
fixture path working with the same code. Writes go through to Postgres and
update the mirror.

C is rejected outright: phase 5 of the 001 plan already recorded a stale-match
defect that the type checker and the test suite both missed, and C is that
defect class multiplied by twenty-eight.

B stays on the table as the documented escape hatch. If the mirror starts
needing invalidation rules — which is what will happen if the chat streams, or
if a second device is ever in play — that is the signal to adopt B rather than
grow a cache by hand. `@tanstack/react-query@5.101.4` clears the age gate at 22
days if it comes to that.

### Dependencies

Checked against the 7-day release-age gate on 2026-08-13:

| Package | Latest | Age | Pin | Why |
|---------|--------|-----|-----|-----|
| `@supabase/supabase-js` | 2.112.3 | 1d — **blocked** | **2.112.1** | 2.112.2 is 6d, also blocked. 2.112.1 is exactly 7d and clears |
| `@tanstack/react-query` | 5.101.4 | 22d — clears | not installed | Only if the plan moves to approach B |

Pinning one version behind the latest is the established pattern here; `vite`
and `@types/node` already sit there for the same reason. Re-run the age check
at install time — these numbers age.

## Prerequisites — owned by Tomás, blocking Phase 1

Implementation cannot start until these exist. None of them are code.

- [ ] **Create the Supabase project.** Region: `sa-east-1` (São Paulo) is the
      closest to the LATAM audience. Region cannot be changed after creation.
- [ ] **Decide the free-tier pause question.** Either accept the cold start,
      add a scheduled ping to keep the project warm, or take the paid tier.
      This affects whether a demo opens instantly in a meeting. Deciding it
      late means deciding it during a demo.
- [ ] **Anthropic API key with billing enabled.** Goes into Edge Function
      secrets in Phase 5, never into the repository and never into the bundle.
- [ ] **Install the Supabase CLI locally.** Migrations and functions are
      developed and tested against a local stack before anything reaches the
      hosted project.
- [ ] **Add the CI variables** to the repository: `SUPABASE_URL` and
      `SUPABASE_ANON_KEY`, as GitHub **variables**, not secrets. They are public
      by design — they ship in the bundle — and filing them as secrets tells the
      next reader something false about them.
- [x] **Confirm the Phase 4 approach** — approach A, 2026-08-13.

Independent of the above, and needed only for the round after this one: a
RapidAPI subscription to the Astrologer API. Not blocking anything here.

## Proposed Solution

Six phases, each leaving the application working and deployable.

Phases 1 to 3 are **additive**: the schema, the auth session and the shared
library all come into existence while the application continues to run entirely
on `localStorage`. Nothing observable changes for a visitor. This is deliberate
— it means the risky phase starts from a fully built and verified backend
rather than building both sides at once.

Phase 4 is **the switch**, and it is the bulk of the work. Phase 5 switches the
AI path the same way. Phase 6 is configuration and documentation.

### What is not in this round

Recorded so the next session does not have to rediscover the boundary:

- **Natal chart via ephemeris.** The next round replaces the PDF upload with
  date, time and place, calling the Astrologer API's
  `/api/v5/context/birth-chart`, which returns XML shaped for a model rather
  than an SVG that needs parsing. **This deviates from `docs/MIGRATION.md`**,
  which planned a Storage bucket plus a Vision call over the uploaded PDF. The
  new direction removes the upload rather than reading it. Recorded as a
  decision in Phase 0; implemented in the next plan.
- **Synastry-backed comparison.** Depends on the above. Note when it lands that
  the API's `/compatibility-score` endpoint returns a number, which
  `docs/DECISIONS.md` §7 forbids. `/chart-data/synastry` is the endpoint to
  use.
- **TTS and audio storage, transactional email, payments.** Step 6 of
  `docs/MIGRATION.md`, each independent of the others.

## Implementation Notes

Validation for every phase, per `CLAUDE.md`: `pnpm typecheck`, `pnpm test` and
`pnpm build` must all pass. UI work is verified in a browser and not by
reasoning about it — the 001 plan records that every defect found in its phases
3 to 5 was invisible to both the type checker and the test suite.

Migrations are SQL files under `supabase/migrations`, applied to a local stack
first. No schema change is made through the dashboard: a change that exists
only in the hosted project cannot be reviewed and does not survive a rebuild.

---

### Phase 0: Record the decisions before building on them

- [x] Step 0.1: Supersede the no-proxy decision
  - MODIFY `docs/DECISIONS.md` — add a new section superseding §3. State that
    §3's reasoning was correct for a static demo, that the premise changed when
    the project acquired persisting users, and that its second objection — a
    spend-anything endpoint on a public URL — still holds and is discharged by
    the real quota in Phase 5. Leave §3 in place with a pointer forward.
  - _A decision record that gets edited to agree with the present is not a
    record. The value is in being able to see that the old reasoning was sound
    and what moved underneath it._
- [x] Step 0.2: Record the natal chart direction change
  - MODIFY `docs/DECISIONS.md` — add the ephemeris-over-Vision decision, with
    the rejected alternative and why: an API taking date, time and place removes
    the upload entirely, returns structured data rather than extracted text,
    costs one call per user for the life of the account, and does not spend
    model tokens per chart.
  - MODIFY `docs/MIGRATION.md` — amend the "Chart PDF held in session state"
    row so the document stops describing a plan that is no longer the plan.
- [x] Step 0.3: Record the data-layer approach
  - MODIFY `docs/DECISIONS.md` — approach A, with the two rejected alternatives
    and the stale-match precedent that rules out the hand-rolled one.
- [x] [UNPLANNED] Step 0.4: Carry the synchronous-call-site finding into `MIGRATION.md`
  - MODIFY `docs/MIGRATION.md` — the "call sites do not move" promise now states
    the condition it depends on, with the `Dashboard.tsx:46` evidence.
  - MODIFY `docs/MIGRATION.md` — "The order to do it in" points at this plan and
    notes that auth was inserted between its steps 1 and 2.
  - _Rationale: the plan recorded the finding but the document that makes the
    promise did not, and that document is the one the next session reads first.
    A caveat that lives only in the plan is a caveat nobody hits in time._

**Verification** — passed 2026-08-13

- `docs/DECISIONS.md` gained §10, §11 and §12 under a `Backend migration`
  heading. §1 to §9 keep their numbers, so the references to §3, §5 and §7 in
  `CLAUDE.md` and in this plan still resolve.
- §3 carries a forward pointer rather than an edit; its original reasoning is
  intact and readable, which was the point.
- §8's Vision-parsing row is struck through and points at §11. The two
  documents no longer describe different plans for the natal chart.
- `docs/MIGRATION.md` amended in three places: the chart row, the `src/store`
  promise, and the ordering section.
- No source changed. `pnpm typecheck` clean, `pnpm test` 565 passing across 21
  files, `pnpm build` succeeds in 400ms — what a documentation-only phase should
  produce.
- The build warns that a chunk exceeds 500 kB. Pre-existing and untouched here,
  but worth noting: `@supabase/supabase-js` lands in that bundle in Phase 2 and
  will make it worse. Code-splitting is not in this plan's scope; if it becomes
  one, that is the phase where it shows up.

---

### Phase 1: Schema and Row Level Security

The order inside this phase matters: tables, then RLS enabled, then policies,
then the tests that prove the policies. A table that exists without RLS, even
briefly, is a table exposed to the anon key.

- [x] Step 1.1: Initialise the Supabase project structure
  - ADD `supabase/config.toml`, `supabase/.gitignore` — via `supabase init`.
  - Hosted project `khwrauqgwopkgyvbonmp`, region `sa-east-1`, Postgres 17.6.
  - _[DEVIATION] The project was first created in `us-east-1` from the
    dashboard's defaults and recreated through the CLI, where `--region` is an
    explicit argument rather than a dropdown. Recorded because it is the
    argument for doing the next project this way round: the region is
    permanent and the dashboard makes it easy to accept by omission._
- [x] Step 1.2: Tables
  - ADD `supabase/migrations/<ts>_initial_schema.sql` — one table per namespace
    in `src/store/db.ts`, following the mapping table in `docs/MIGRATION.md`.
    Carry across the constraints that document names as load-bearing: the
    `one_current_synthesis` unique partial index, the `(practice, day)` unique
    constraint on check-ins, and the 7-day expiry on anonymous sessions.
  - _The seed JSON in `data/` becomes tables here — modalities, topics, crisis
    resources, bed tracks. `catalog.ts`'s accessors become queries in Phase 3._
  - _[DEVIATION] Match reactions became their own table, `match_reactions`,
    keyed on (user_id, modality_slug), rather than the `Record<slug, …>` the
    demo keeps inside the match row. The demo's shape made a reaction a
    property of a request, and every re-match then had to copy them forward by
    hand so they were not lost. As a table they simply outlive the request,
    which is what `store/matches.ts` says they are for._
  - _[DEVIATION] `bed_tracks.frequency_hz` is nullable. It was written
    `not null` and the seed rejected it: `lluvia` is filtered noise and
    `silencio` is no bed at all, so neither has a fundamental. The constraint
    was a claim about the domain that two of the five rows disproved._
- [x] Step 1.3: Enable RLS on every table, in the same migration
  - _Not a follow-up migration. A window between the two, however short, is a
    window where the anon key reads everything._
- [x] [UNPLANNED] Step 1.3b: Grants
  - MODIFY `supabase/migrations/…_rls_policies.sql` — explicit `grant` per role.
  - _Rationale: the plan treated RLS as the whole of access control and it is
    only half. A grant decides whether a role may touch a table; a policy
    decides which rows. Postgres checks the grant first, so nineteen tables
    with correct policies were unreachable by every role — the first run of the
    test suite failed on `permission denied for table clients`, not on any
    assertion. Granted narrowly: `authenticated` gets no verb at all on the
    reference tables, so no future policy edit can make a modality deletable._
- [x] Step 1.4: Policies
  - ADD `supabase/migrations/<ts>_rls_policies.sql` — ownership policies keyed
    on `auth.uid()`, plus the two that carry product promises per
    `docs/MIGRATION.md`: consent-gated reads of `chart_comparisons`, and
    `clinical_basics` unreachable across clients by any route including joins
    and views.
  - _`readableComparison` re-checks consent on every read in the demo. In
    Postgres it has to be a policy, because a helper is only as good as the
    call site that remembers to use it._
- [x] Step 1.5: Policy tests
  - ADD `supabase/tests/rls.test.sql` — pgTAP 1.3.3, 20 assertions.
  - _Negative assertions only. A policy test that only proves the owner can
    read their own row proves nothing about the policy._
  - _[UNPLANNED] Every assertion had to be made independently failable. The
    control reading Alice's clinical answer was a bare scalar subquery, and
    under a broken ownership policy it returns two rows, aborts the
    transaction, and takes the eighteen assertions after it down unrun —
    exactly when they are most needed. Aggregated instead. The same shape is
    worth checking for in any future test here._

**Verification** — passed 2026-08-13

- `supabase db reset` applies all three migrations cleanly from empty.
- 19 tables, RLS enabled on every one, none without a policy — confirmed by
  querying `pg_class.relrowsecurity` against `pg_policies` rather than by
  reading the migration back.
- Seeds load: 21 modalities, 15 topics, 16 crisis resources, 5 bed tracks.
  Verified hotlines: 0, which is correct — `verified_at` is null on every row
  and stays that way until someone telephones them.
- `supabase test db` — 20/20 pass.
- **Non-vacuity confirmed by sabotage, twice.** Replacing the `clients`
  ownership policy with `using (true)` failed 5 assertions, including both
  reads of another person's clinical answer and the cross-user write.
  Replacing the consent gate with plain ownership failed exactly 2 — the
  revoke and the expiry — and nothing else, which is the right blast radius
  for that policy.
- The application is untouched and still runs on `localStorage`.
  `pnpm typecheck` clean, `pnpm test` 565 passing across 21 files,
  `pnpm build` succeeds.
- [DEVIATION] One assertion was wrong rather than one policy: anon reading
  `modalities` was written as an expected count of zero, and Postgres denies
  it at the grant layer instead. Rewritten as `throws_ok`, which asserts the
  stronger of the two behaviours — the role was never given the verb, so no
  policy edit can open it by accident.
- Not yet done in this phase: the hosted project holds no schema. Everything
  above is local. `supabase link` and `db push` land with Phase 6, so that the
  first thing pushed to `sa-east-1` is a schema the whole plan has been
  verified against.

---

### Phase 2: Authentication

Additive. The session comes into existence and nothing reads from it yet.

- [x] Step 2.1: Add the client dependency
  - MODIFY `package.json` — `@supabase/supabase-js` pinned to `2.112.1`,
    7 days old and the newest that clears the gate; 2.112.2 (6d) and 2.112.3
    (1d) were both blocked.
  - _[FINDING] `pnpm audit` reports one pre-existing high: nanoid 3.3.17 via
    `vite > postcss > nanoid`, devDependencies only, so it never reaches the
    bundle. The fix, nanoid 3.3.18, was published 5 days ago and is itself
    blocked by the gate. Unresolvable today without an exception; it clears on
    2026-08-14. Not introduced by this change._
- [x] Step 2.2: The client singleton
  - ADD `src/supabase/client.ts` — reads `VITE_SUPABASE_URL` and
    `VITE_SUPABASE_ANON_KEY`.
  - _[DEVIATION] It does not fail loudly at boot when they are missing, as the
    step said it should. A build without them is not broken — it is the
    fixture demo, which still runs every screen offline, and that is a
    supported way to run this application rather than an error state. Exports
    `isBackendConfigured` and a nullable client instead, so the absence is a
    branch rather than an exception thrown somewhere that cannot decide what
    to do about it._
- [x] Step 2.3: Anonymous sign-in
  - ADD `src/supabase/session.ts`, `src/supabase/session.test.ts`.
  - MODIFY `src/App.tsx` — acquire the session once, in the background.
  - _An anonymous `auth.users` row is what makes every `auth.uid()` policy in
    Phase 1 meaningful. Without it, RLS has nothing to key on._
- [x] [UNPLANNED] Step 2.3b: An in-flight guard on `ensureSession`
  - MODIFY `src/supabase/session.ts` — concurrent callers share one attempt.
  - _Rationale: the first browser run created **two** anonymous users eight
    microseconds apart. StrictMode invokes the mount effect twice, both calls
    observed "no session" before either resolved, and both signed in. Harmless
    today because nothing reads the identity; in Phase 4 it means rows written
    to a `user_id` the second sign-in has already replaced, held by nobody.
    The type checker and 570 passing tests were both silent on it._
- [ ] ~~Step 2.4: Upgrade to email~~ — **deferred to Phase 4**
  - _[DEVIATION] `upgradeToEmail` is written and verified, but `Signup.tsx` is
    not wired to it. The screen currently reads "En esta demo no se envía
    ningún correo ni se crea ninguna cuenta en ningún servidor", and sending a
    confirmation link makes that false. The honest replacement while the store
    is still local — we email you, but your answers stay in this browser — is
    a sentence describing an intermediate state nobody should have to parse.
    The copy and the data move together in Phase 4. This product's plain
    self-description is load-bearing; it is not a caption to be left stale for
    a phase._
- [x] Step 2.5: Auth callback
  - MODIFY `supabase/config.toml` — `enable_anonymous_sign_ins`, plus local
    site and redirect URLs. `emailRedirectTo` resolves against
    `import.meta.env.BASE_URL`, so it carries the `/natus-mvp/` prefix.
  - _The base root returns HTTP 200. A nested route returns 404 with the app as
    its body via the `404.html` fallback. Both render, but only one of them
    stops looking like a bug during the next incident._
  - _The hosted project's URL configuration is deliberately not pushed from
    `config.toml`: supabase/cli#3208 reports `config push` overwriting a remote
    project's URLs with the local ones. Phase 6 sets them directly._

**Verification** — passed 2026-08-13

- 15/15 assertions in an end-to-end check through `supabase-js` against the
  local stack, not through psql: anonymous sign-in yields a real `auth.users`
  row flagged `is_anonymous`; a second visitor gets a different id and reads
  none of the first's rows, including when naming their `user_id` explicitly;
  a cross-user write is refused with 42501; the pool is readable signed in and
  refused signed out; crisis resources are readable either way.
- **The property the auth model rests on**: after `updateUser({ email })` the
  user id is byte-identical, and the row answered before signup is still
  readable. Nothing migrates at signup because nothing needs to.
- Browser, dev server against the local stack: the app renders identically,
  console clean. One page load creates exactly one anonymous user; a reload
  creates none, reusing the session. Both counted in `auth.users` rather than
  inferred.
- `pnpm test` 573 passing across 22 files (+8), `pnpm typecheck` clean,
  `pnpm build` succeeds.
- The concurrency test was confirmed non-vacuous by removing the guard and
  watching it fail — worth doing, because an earlier version of it passed
  while asserting nothing: the static import at the top of the file had
  already cached the real client, so `vi.doMock` never applied and the mock
  recorded zero calls. `vi.resetModules()` now runs in `beforeEach`, not only
  `afterEach`.
- Bundle is 709 kB (210 kB gzipped), over Vite's 500 kB warning. It was
  already over before this phase; `supabase-js` made it worse. Code-splitting
  is still out of scope, and still worth a decision before Phase 5 adds more.

---

### Phase 3: The shared library crosses the boundary

- [x] Step 3.1: Copy `src/lib` unchanged
  - COPY `src/lib/*.ts` → `supabase/functions/_shared/lib/`, byte-identical.
  - ADD `supabase/functions/deno.json` — import map for `@data/` and `zod`.
  - ADD `pnpm sync:shared` — regenerates the copy, so nobody does it by hand.
  - _If anything needs editing to run on the other side, the boundary was
    already broken and this is the step that reveals it. It revealed two
    things, and neither was what the step was watching for — see 3.1b._
- [x] [UNPLANNED] Step 3.1b: Two Vite conventions Deno does not share
  - MODIFY `src/lib/safety.ts`, `src/lib/catalog.ts` — JSON imports carry
    `with { type: 'json' }`.
  - MODIFY every relative import in `src/lib` — explicit `.ts` / `/index.ts`.
  - MODIFY `tsconfig.json` — `allowImportingTsExtensions: true`.
  - _Rationale: the boundary held in the way that mattered. Nothing in
    `src/lib` reached for React, `localStorage` or `@/store`; the library is
    portable in substance. What did not port was module-resolution syntax.
    Deno rejects a JSON import without an import attribute, and rejects
    `./schemas` without an extension — `sloppy-imports` is declared in
    `deno.json` and the edge runtime does not honour it, though it does read
    the import map, which is how `@data/` resolves._
  - _Both were fixed **in the source rather than in the copy**, because the
    standard syntax works under Vite, vitest and Deno alike. Fixing them in
    the copy would have bought a transform step and lost byte-identity, which
    is the one property making the copy safe._
- [x] Step 3.2: The tests come with it
  - _[DEVIATION] They do not. Tests are excluded from the copy and stay in
    `src/lib`, where they run. Copying them would deploy test files inside a
    production function, and running them a second time under the same runner
    would prove only that `cp` works — they cannot run under Deno at all,
    since they import `vitest`. The property that step wanted is enforced
    instead by `src/lib/shared-parity.test.ts`, which is stronger: it fails on
    drift in either direction, forever, rather than once at copy time._
- [x] Step 3.3: Seeds move with the code that reads them
  - COPY `data/*.json` → `supabase/functions/_shared/data/`, under parity too.
- [x] Step 3.4: Decide where the hard filter runs
  - MODIFY `src/lib/matching.ts` — records that the Edge Function's copy is
    authoritative from Phase 5, and why.
  - _Written where a reader lands rather than only in `docs/MIGRATION.md`: a
    filter running in a browser can be edited by whoever holds the browser,
    and `clinicallyExcluded` is not a presentation concern. The client keeps
    its copy so the UI answers without a round trip; the parity test is what
    keeps the two from disagreeing._

**Verification** — passed 2026-08-13

- **The library runs on the real runtime**, not on a proxy for it: a temporary
  function served by `supabase functions serve` (edge-runtime 1.74.3, Deno
  2.1.4) imported `numerology`, `safety`, `copy-lint` and `catalog` from the
  copy and returned HTTP 200. Deleted afterwards; Phase 5 brings the real ones.
- **Cross-runtime determinism.** The same four calls under Node and under Deno
  return identical output: `life_path 9`, `expression 11`, master number 11
  detected, safe text not flagged, `hace semanas que me quiero morir` flagged
  high, and both copy violations — `command` on "Tenés que" and `percentage`
  on "98%" — in the same order. The arithmetic and the safety layer do not
  change when they cross.
- `pnpm test` 616 passing across 23 files (+43), `pnpm typecheck` clean,
  `pnpm build` succeeds. Every pre-existing test passed unchanged after the
  import rewrite, which is the evidence that it was syntax and not semantics.
- **Parity is non-vacuous**, confirmed both ways: appending a line to the
  copy fails `matching.ts is byte-identical`; adding a file to `src/lib`
  without syncing fails `contains exactly the same files`. The second is the
  one that matters — the realistic failure is not a bad copy today but a good
  edit made in one place in six weeks.
- Two structural assertions also live in that file: nothing in `src/lib` may
  import `@/store`, `react`, or any `@/` specifier; and every relative import
  must carry an extension and every JSON import an attribute. The Deno
  requirements are now a test rather than a thing to remember.

---

### Phase 4: The data layer

The switch, and the bulk of the work. Approach A, per `DECISIONS.md` §12.

- [ ] Step 4.1: The hydration layer
  - ADD `src/store/hydrate.ts` — load the authenticated user's full dataset in
    one round trip at session start.
  - ADD `src/store/StoreProvider.tsx` — hold the mirror, expose it, and render a
    loading state until the first hydration resolves.
- [ ] Step 4.2: Repoint the reads
  - MODIFY `src/store/db.ts` — `read` serves from the mirror rather than
    `localStorage`. Signature unchanged, so its callers do not move.
  - _This is the file `docs/MIGRATION.md` says is "replaced, not its callers".
    Keeping `read` synchronous is what makes that true._
- [ ] Step 4.3: Repoint the writes
  - MODIFY `src/store/db.ts` — `write` updates the mirror synchronously and
    persists to Postgres in the background, with a failure surfaced rather than
    swallowed.
  - _Today `write` swallows quota errors on purpose, to degrade a demo rather
    than break it. A dropped network write is a different thing: the person
    believes their data was saved. It has to be visible._
- [ ] Step 4.4a: Wire the email upgrade, and rewrite the signup copy with it
  - MODIFY `src/screens/Signup.tsx` — call `upgradeToEmail`, and replace the
    "no se envía ningún correo" paragraph, which stops being true here.
  - _Carried from Phase 2, where the plumbing landed but the screen did not.
    The copy can only be honest once the data has actually moved._
- [ ] Step 4.4: Per-store queries
  - MODIFY each of `session.ts`, `account.ts`, `soulMap.ts`, `matches.ts`,
    `crisis.ts`, `chat.ts`, `subscription.ts`, `meditations.ts`,
    `comparison.ts`, `preferences.ts` — per the `MIGRATION.md` table.
  - DELETE `src/store/blobs.ts` — Storage buckets replace it.
- [ ] Step 4.5: Keep the degraded path
  - MODIFY `src/store/hydrate.ts` — a failed hydration falls back to the
    in-memory mirror rather than a blank screen.
  - _A paused free-tier project must degrade the demo, not end it. This is the
    same reasoning that already governs `db.ts`'s swallowed reads._
- [ ] Step 4.6: The store tests
  - MODIFY the existing `src/store/*.test.ts` — they currently assert against
    `localStorage`. The behaviour under test does not change; the backing does.

**Verification — partial, 2026-08-13. This phase is not finished.**

Done and verified:

- **All fourteen adapters round-trip**, via `pnpm verify:adapters` against the
  local stack — 15/15. Written for a reason: thirteen of them had never
  executed, having been written in one sitting and exercised only by type
  checking. A round-trip suite was far cheaper than clicking every screen and
  covers the ones the UI reaches rarely.
- **The onboarding draft, through the real application.** Name, birth date,
  presenting need, twelve expanded openness slugs and
  `clinical_ideation_6m = 'fugaces_sin_plan'` all land in their own columns.
  Clearing every `natus:*` key from `localStorage` while keeping the auth token
  and reloading brings the answers back — so they came from Postgres, not from
  the browser.
- Repeated reloads create one `auth.users` row and one session row, not one
  per load. Console clean.
- `pnpm typecheck`, `pnpm test` 616 across 23 files, `pnpm build` all pass.

**Four schema defects, all mine, all from Phase 1**, and none catchable there
because nothing wrote to the tables yet — the RLS tests chose their own values,
so they agreed with the schema rather than with the application:

- `messages.type` allowed `'clarification'`. The schema says
  `'clarifying_question'`.
- `mode` allowed only `('fixture', 'server')`. The store writes `'byok'`, and
  will until Phase 5 deletes that path.
- `comparison_consents.scope` was `text`. `ComparisonScope` is
  `{ numerology, astro, soul_map_themes }` — three separate booleans, because
  consent is per kind of material. It would have stored `"[object Object]"`.
- `crisis_events.category` was unconstrained.

The third was caught by `supabase gen types` making the column type and the
application type check against each other. That is the argument for generating
them rather than hand-agreeing: the first two were found by reading, the third
by the compiler, and the compiler does not get tired.

Still outstanding, and why this phase stays open:

- Step 4.4a and 4.6 are not done.
- The journey past onboarding — Soul Map, recommendations, routine, chat,
  meditations, comparison — has not been walked in a browser. The adapters
  behind those screens round-trip in isolation, which is not the same claim.
- A deliberately failed write has not been observed surfacing. The handler
  exists and nothing calls `setWriteFailureHandler` yet, so today a dropped
  write is still silent — the exact thing `DECISIONS.md` §12 says must not be.
- [FINDING, pre-existing] `Onboarding.tsx` starts at `useState(0)` and never
  reads the stored `step`, so a returning visitor restarts at screen one with
  their answers pre-filled. `store/session.ts` describes `step` as "furthest
  step reached, so a returning visitor lands where they left off", which the UI
  has never implemented. Not a regression from this phase, and changing it is a
  product decision rather than a migration one.

---

### Phase 5: The AI moves server-side

- [ ] Step 5.1: One Edge Function per purpose
  - ADD `supabase/functions/{soul-map,match,chat,meditation,comparison}/index.ts` —
    each reusing the existing prompts, zod schemas and copy lint from
    `_shared/lib`. Each validates the JWT and derives the user from it.
  - _Not one function with a `purpose` parameter. Separate deployables mean a
    broken meditation prompt cannot take the Soul Map down with it._
- [ ] Step 5.2: CORS, written explicitly
  - ADD `supabase/functions/_shared/cors.ts` — the `OPTIONS` preflight handler
    and headers, used by all five.
  - _And in the same file, a comment recording why it is not a security
    boundary: the Pages origin is the whole `github.io` subdomain, shared with
    every other repository the owner publishes. The JWT check is the control._
- [ ] Step 5.3: Safety stays in front
  - MODIFY the chat function — Layer 1 detection runs before the model call,
    server-side, per `docs/DECISIONS.md` §5.
  - _And before the quota check. PDR 1.6 forbids meeting someone in crisis with
    a commercial fallback, and the ordering is what guarantees it. The 001 plan
    got this right in step 7.2; it must survive the move._
- [ ] Step 5.4: The derived risk level, not the raw notes
  - _A non-negotiable in `CLAUDE.md`: raw `clinical_basics` never enters a model
    payload. With a server this is finally enforceable rather than merely
    observed — and it is also newly easy to break, because the function has the
    whole row in hand and only discipline stops it being forwarded._
- [ ] Step 5.5: The real quota
  - MODIFY `src/store/subscription.ts` and the chat function — the quota becomes
    a count over `messages where counted`, enforced server-side.
  - _Enforced in the function, not the client. A quota checked in the browser is
    a suggestion. This is the step that discharges `DECISIONS.md` §3's surviving
    objection, and the chat does not open to users until it is done._
- [ ] Step 5.6: Logging
  - ADD the `claude_api_calls` table and writes from each function — PDR 4,
    which had no equivalent in the demo because there was no server to log from.
- [ ] Step 5.7: Delete the BYOK path
  - DELETE `src/ai/mode.ts`, `src/components/AiModeToggle.tsx`.
  - MODIFY `src/ai/client.ts` — the BYOK branch goes; **the fixture branch
    stays** and becomes the degraded path.
  - _`runAi` keeps its two-implementation shape and its single validation path.
    That symmetry is what stops the fixtures drifting into a different product,
    and it is worth as much now as it was in the demo._

**Verification** — every AI surface generates against the local stack with no
key in the browser, confirmed by inspecting the network tab for the absence of
any `api.anthropic.com` request. A malformed model response still fails the
schema before reaching a screen. A copy-lint violation still fails. The crisis
path in chat produces containment and no interpretation, and costs no quota. At
zero remaining the paywall appears; the quota cannot be bypassed by editing
client state, verified by trying. `claude_api_calls` rows appear. With Supabase
unreachable the fixture path still renders every screen.

---

### Phase 6: Deployment, configuration and documentation

- [ ] Step 6.1: CI
  - MODIFY `.github/workflows/deploy.yml` — add `VITE_SUPABASE_URL` and
    `VITE_SUPABASE_ANON_KEY` from repository **variables**, alongside the
    existing `VITE_BASE`.
  - _Variables, not secrets. They ship in the bundle. Filing a public value as
    a secret misleads whoever reads the workflow next._
- [ ] Step 6.2: Function deployment
  - MODIFY `.github/workflows/deploy.yml` or ADD a second workflow — deploy Edge
    Functions on push. Anthropic key from secrets, which genuinely are secret.
  - _Pin any new action to an exact release tag and check it against the same
    7-day gate as everything else, per the existing comment in that file._
- [ ] Step 6.3: Handover documentation
  - MODIFY `docs/HANDOFF.md` — a transfer now also means a new Supabase redirect
    allowlist and a new CORS allowlist. Environment, not source, exactly like
    `VITE_BASE`.
- [ ] Step 6.4: Close out the migration document
  - MODIFY `docs/MIGRATION.md` — mark steps 1 to 4 done, leave 5 and 6 standing.
- [ ] Step 6.5: Project documentation
  - MODIFY `CLAUDE.md` — the architecture section still says "No backend, no
    database, no server-held secret". Update it, including the validation
    commands if the local stack becomes part of them.
  - MODIFY `package.json` — the `description` field still reads "static demo of
    the user product. No backend, no database."

**Verification** — a push to `main` deploys both the site and the functions. The
deployed site acquires a session, generates a Soul Map and persists it across a
refresh. A nested route still resolves through the `404.html` fallback. No
document in the repository still describes the project as having no backend.

## Success Criteria

- [ ] Fifty users' data persists in Postgres across sessions and devices, for
      anyone who upgraded to an email identity.
- [ ] RLS is enabled on every table, and the two product-promise policies have
      non-vacuous negative tests.
- [ ] No Anthropic key exists in the bundle, in the repository, or in any
      browser. Verified by network inspection, not by reading the source.
- [ ] The chat quota is enforced server-side and cannot be bypassed from the
      client.
- [ ] Raw `clinical_basics` appears in no model payload.
- [ ] Every non-negotiable in `CLAUDE.md` still holds: no streaks, no
      percentages, no facilitator names, safety deterministic and in front, the
      copy lint governing fixtures as well as model output.
- [ ] The fixture path still renders every screen with Supabase unreachable.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm build` pass, and CI deploys on
      push to `main`.
- [ ] `docs/DECISIONS.md` records the superseded proxy decision with its
      original reasoning intact.

## Notes

**On phase ordering.** Phases 1 to 3 are additive on purpose. The application
runs on `localStorage` throughout them, which means the risky phase begins
against a schema that is already built, already has passing policy tests, and
already has a working auth session. Building both sides at once is how a
migration ends up with two half-working systems and no way to tell which one is
lying.

**On what this round buys.** Not features. A visitor sees almost exactly what
they see today — the same screens, the same journey. What changes is that their
data outlives the browser, and that the AI works without them holding a key.
Every user-visible addition in this plan is a consequence of those two, not a
goal alongside them.

**The next round** is the natal chart via ephemeris, and then synastry on top of
it. Both are recorded in Phase 0 as decisions so the deviation from
`docs/MIGRATION.md` is on the record before anyone implements against the older
plan.

**Where this stands.** Phases 0 to 3 are done. Phase 4 is **in progress**: the
mirror, the hydration and all fourteen adapters are built and round-trip
verified, and onboarding writes to Postgres through the real application.
Not yet done — the signup wiring carried from Phase 2, the store tests, a
browser walk past onboarding, and surfacing a failed write. Outstanding and
owned by Tomás: the free-tier pause decision, the CI variables, and the
Anthropic key for Phase 5.

**Carried forward.** The nanoid advisory clears the age gate on 2026-08-14 and
should be closed then. The bundle is over Vite's chunk warning and Phase 5 will
add to it.
