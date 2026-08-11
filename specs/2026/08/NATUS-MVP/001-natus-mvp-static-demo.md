# Natus MVP — Static User-Product Demo

Stage: `Act`
Last Updated: 2026-08-11

## High-Level Objective

Build a navigable, publicly shareable demo of the Natus user product — the
consumer side described in the August 2026 PDR — hosted entirely on GitHub
Pages with no backend, no database, and no server-held secrets. The demo has
to tell the full product story end to end so it can be shown to stakeholders,
while implementing the deterministic core (numerology, crisis safety, modality
filtering) as real production-grade code rather than throwaway mockup wiring.
The repository is created under `tomasbalmer/natus-mvp` and is expected to be
transferred to another owner once it is presentable.

## Mid-Level Objectives

- [ ] Ship a static single-page application on GitHub Pages that runs the whole
      user journey with browser storage standing in for Postgres.
- [ ] Implement numerology, deterministic crisis detection (Layer 1), and the
      therapy-modality hard filter as real TypeScript that can migrate to
      Supabase Edge Functions unchanged.
- [ ] Cover the PDR user journey: onboarding, Soul Map, modality
      recommendations and routine, dashboard, chat, meditations, and chart
      comparison.
- [ ] Serve every AI-dependent surface from curated fixtures by default, with an
      opt-in toggle that lets a viewer supply their own Anthropic API key to see
      real generation.
- [ ] Recommend therapy modalities, never named people, and never a numeric
      match score — per PDR sections 0.1 and 7.5.
- [ ] Treat the existing mockups as the visual source of truth (tokens,
      typography, glassmorphism, photography) and the PDR as the functional
      source of truth (flow, scope, copy rules, safety).

## Context

### Source documents

| Document | Role | Authority |
|----------|------|-----------|
| `PDR — MVP Natus: Producto del Usuario` (Aug 2026, 1384 lines) | Flow, scope, data contracts, safety rules, copy rules | Functional truth |
| `natus-mockups (3).html` (4 phone screens) | Palette, typography, glassmorphism, geometry, photography | Visual truth |

The two documents disagree on substance. The mockups depict the May 2026 vault
scope (matching to named facilitators, "98% match", a voice check-in screen, a
4-step onboarding). The PDR explicitly supersedes that in section 0.1. Resolved
in favour of the PDR — see Key Decisions.

### Design tokens recovered from the mockups

```
--verde  #1C3829   --azul   #0D2137   --negro  #1A1A1E
--crema  #E8DCC8   --blanco #FAFAF8   --tierra #8B6F52
page background #0e0e0e

glass  bg rgba(255,255,255,.08) / border rgba(255,255,255,.15)
       hover rgba(255,255,255,.13) / blur 12px chips, 16-20px cards

Cormorant Garamond 300/400/600 + italic  -> headings 30-40px, lh 1.12-1.2
DM Sans 300/400/500                      -> UI 12-14px, eyebrows 10px
                                            uppercase tracking .18-.25em

CTA h54 r27 · secondary h52 r26 · option h52 r14 · pill r20-23
side padding 22-28px
```

Four AI-generated background photographs (misty forest, aerial surf, palm
shadow underwater, grass blades), all desaturated dark green under a 45-96%
black gradient. No licensing constraint.

### Architecture constraints

GitHub Pages serves static files. It cannot run a backend, hold a secret, or
sign a URL. Every element of PDR section 4 therefore needs a browser-side
equivalent:

| PDR (production) | Static demo |
|------------------|-------------|
| Supabase Postgres + RLS | `localStorage`, namespaced per entity |
| Edge Functions (Deno) | TypeScript modules under `src/lib` |
| Supabase Auth | Local profile record, simulated signup |
| Storage private bucket | IndexedDB blobs + object URLs |
| Signed URLs | Not applicable |
| `claude_api_calls` logging | Local debug panel |
| Payment gateway + webhooks | Simulated paywall, no charge |
| Transactional email | Simulated screen |
| Google Cloud TTS | Web Speech API `SpeechSynthesis` |
| Curated `bed_tracks` audio files | `OscillatorNode` synthesis in-browser |

`src/lib` is the migration contract: numerology, safety, matching, crisis
resources and the zod schemas are written so they can be copied into
`supabase/functions/_shared/lib` unchanged. They must not import React,
`localStorage`, or anything browser-specific.

### Dependencies (pinned exact, audited against the 7-day release-age gate)

Cutoff 2026-08-03. `pnpm` enforces `minimum-release-age=10080`.

| Package | Pinned | Published | Note |
|---------|--------|-----------|------|
| react / react-dom | 19.2.8 | 2026-07-21 | latest |
| react-router-dom | 7.18.2 | 2026-07-28 | latest |
| zod | 4.4.3 | 2026-05-04 | latest |
| vite | 8.2.0 | 2026-07-30 | latest 8.2.1 is gated (2026-08-06) |
| @vitejs/plugin-react | 6.0.5 | 2026-07-30 | latest |
| typescript | 7.0.2 | 2026-07-08 | latest |
| tailwindcss / @tailwindcss/vite | 4.3.3 | 2026-07-16 | latest |
| @types/react | 19.2.18 | 2026-07-30 | latest |
| @types/react-dom | 19.2.4 | 2026-07-30 | latest |
| @types/node | 26.1.2 | 2026-07-27 | latest 26.2.0 is gated (2026-08-07) |
| vitest | 4.1.10 | 2026-07-06 | latest |

No PDF library is installed. Natal-chart parsing needs Vision, which only
exists in BYOK mode; the PDF is stored and previewed, and parsing is stubbed
behind the same `AiClient` interface so it can be enabled later.

<!-- FEEDBACK: context
Resolved during planning. See Key Decisions in the summary.
Status: ADDRESSED
-->

## Proposed Solution

A mobile-first React SPA that reproduces the PDR journey screen by screen.
State lives in `localStorage` behind a small repository layer whose method
signatures mirror the SQL tables in PDR section 5, so a later swap to Supabase
is a change of implementation rather than a change of call sites.

Three modules are implemented for real, not simulated, because they are
deterministic and carry the product's actual risk: the Pythagorean numerology
engine, the Layer 1 crisis detector, and the modality hard filter. They ship
with unit tests and no React dependency.

Everything that requires a language model is routed through a single
`AiClient` interface with two implementations. `FixtureAiClient` returns
curated JSON for three seeded user profiles and is the default, so the demo
works offline and never fails during a live presentation. `AnthropicAiClient`
calls the API directly from the browser using a key the viewer pastes, stored
only in `localStorage`, enabled by a toggle in the header. Both implementations
return values validated by the same zod schemas, so a fixture that drifts from
the contract fails a test rather than the demo.

The recommendation surface ranks therapy modalities. It shows family, format,
evidence level, what actually happens in a session, and a two-to-four sentence
reasoning that quotes the user's own words. It never shows a person's name and
never shows a percentage. The constellation visual from mockup 04 is kept, with
modality nodes replacing facilitator avatars.

Safety is built before the features it gates. A high-severity signal replaces
the screen entirely with crisis resources and blocks Soul Map generation,
recommendations, matching and meditations; a low-severity signal shows a
persistent banner, excludes `requires_clinical_support` modalities and
prioritises the `psicologica` family. Crisis resources are data-driven from
`data/crisis-resources.json`, each carrying `verified_at`. When `verified_at`
is null the UI renders an unverified notice and surfaces the international
fallback, so the pending decision about publishing unverified hotline numbers
is a data edit rather than a code change.

Out of scope, per PDR section 2.2 and the reduced surface of a static demo:
marketplace and facilitator profiles, real payments, real email, native apps,
push notifications, automatic Soul Map re-synthesis, and any streak, badge or
re-engagement mechanic.

<!-- FEEDBACK: proposed_solution
Resolved during planning.
Status: ADDRESSED
-->

## Implementation Notes

Phases are ordered so each one leaves a deployable, type-checking, test-passing
application. Safety lands in Phase 2, before every surface it gates, because
retrofitting it would mean rewriting onboarding, chat and meditations.

<!-- FEEDBACK: implementation_approach
Resolved during planning.
Status: ADDRESSED
-->

### Phase 0: Scaffold, tokens and deployment

- [x] Step 0.1: Create build configuration
  - ADD `package.json` — exact pins from the Context table, `packageManager: pnpm@10.33.0`, scripts `dev` / `build` / `preview` / `typecheck` / `test`.
  - ADD `tsconfig.json` — strict, `moduleResolution: bundler`, `noUncheckedIndexedAccess`.
  - ADD `vite.config.ts` — React and Tailwind plugins, configurable base:
    ```ts
    base: process.env['VITE_BASE'] ?? '/',
    ```
  - ADD `.gitignore`, `.nvmrc`.
  - _Deviation: no `tsconfig.node.json`. `vite.config.ts` is covered by the
    single config and typechecks cleanly, so a second project file would be
    ceremony. TypeScript 7 has removed `baseUrl`, so path aliases are written
    relative (`./src/*`). `defineConfig` is imported from `vitest/config`
    rather than `vite`, which is what types the `test` key._
- [x] Step 0.2: Install dependencies
  - Run `pnpm install` only after presenting the version diff for approval.
  - _Approved with `vite` held at 8.2.0 and `@types/node` at 26.1.2 by the
    7-day release-age gate. 76 packages, lockfile committed._
- [x] Step 0.3: Port the design system
  - ADD `src/styles/tokens.css` — the CSS custom properties recovered above, plus glass and elevation utilities.
  - ADD `src/styles/index.css` — Tailwind v4 `@import` and `@theme` mapping tokens to utility names.
  - ADD `index.html` — Cormorant Garamond and DM Sans self-hosted or preconnected, `<meta name="robots" content="noindex">`.
- [x] Step 0.4: Optimise and commit the photography
  - ADD `public/img/forest.avif`, `surf.avif`, `palm.avif`, `grass.avif` — converted from the extracted JPEGs, quality 68.
  - ADD `docs/ASSETS.md` — origin (AI-generated) and usage per file.
  - _Deviation: AVIF rather than WebP. The macOS `sips` build reads WebP but
    cannot write it, and neither `cwebp` nor ImageMagick is installed; AVIF has
    equivalent browser support and compressed better here. `palm` and `grass`
    ship at native resolution because upscaling them to 1080px added weight
    without detail. 452 KB total, down from 1.18 MB._
- [x] Step 0.5: Application shell
  - ADD `src/main.tsx`, `src/App.tsx` — router with the phone-frame layout and a mobile-first responsive container.
  - ADD `src/components/PhoneFrame.tsx` — 335x726 frame on desktop, full-bleed on mobile.
  - ADD `src/components/Screen.tsx` — photographic backdrop plus the four per-screen legibility gradients transcribed from the mockup.
  - ADD `src/components/DemoBanner.tsx` — persistent notice that this is a demo, stating where the typed text goes in the current AI mode.
- [x] [UNPLANNED] Step 0.5b: Enforce the mockup as visual source of truth
  - ADD `src/styles/tokens.test.ts` — parses `tokens.css` and asserts the
    palette, glass alpha values and geometry against the values transcribed
    from the mockup.
  - _Rationale: `tokens.css` claims verbatim transcription, which is only true
    if something enforces it. It also gives Phase 0 a real test suite instead
    of setting `passWithNoTests`, which would have let a later misconfigured
    test glob pass CI silently._
- [x] Step 0.6: Deployment
  - ADD `.github/workflows/deploy.yml` — pnpm install, typecheck, test, build with `VITE_BASE=/natus-mvp/`, publish to Pages on push to `main`.
  - ADD `public/robots.txt` — `Disallow: /`.
  - ADD `README.md`, `docs/HANDOFF.md` — the five-step ownership transfer checklist.
  - Run `gh repo create tomasbalmer/natus-mvp --public --source=. --push`.
  - _Deviation: `404.html` is produced by the workflow (`cp dist/index.html
    dist/404.html`) rather than committed to `public/`. A committed copy would
    reference stale hashed asset filenames after every build._

**Verification** — passed 2026-08-10

- `pnpm typecheck` clean, `pnpm test` 16 passing, `pnpm build` succeeds.
- Actions run green with no annotations.
- `https://tomasbalmer.github.io/natus-mvp/` renders the shell: Cormorant
  Garamond headline, DM Sans UI, forest backdrop, verde CTA, glass banner.
  Screenshot-verified at 900px viewport.
- Assets resolve under the `/natus-mvp/` base path; `img/forest.avif` serves
  as `image/avif`.
- A nested route serves the application HTML through the `404.html` fallback.
  Pages returns status 404 with that body, which is inherent to the technique
  — the browser renders it and the router takes over.
- Console clean after adding the favicon.

[UNPLANNED] `.github/workflows/deploy.yml` actions were several majors behind
and running under a forced Node 24 shim. Bumped to current releases and pinned
to exact tags, each checked against the same 7-day release-age gate applied to
npm packages.

### Phase 1: Content seed and contracts

- [x] Step 1.1: Therapy catalogue
  - ADD `data/modalities.json` — 21 modalities from PDR section 5.3, each with `slug`, `name_es`, `name_en`, `family`, `short_description`, `what_happens`, `works_well_for`, `typical_format`, `typical_horizon`, `intensity` (1-5), `evidence_level`, `contraindications`, `requires_clinical_support`.
  - `requires_clinical_support: true` on constelaciones familiares, medicina ancestral, hipnosis, EMDR.
  - _Deviation: plain `breathwork` is NOT flagged. PDR 5.3 names "breathwork
    holotrópico" specifically, and the PDR's own model example of a good
    routine tip is 4-7-8 breathing. The seed describes the general practice
    and calls out the intense variants in `contraindications` instead._
- [x] Step 1.2: Supporting seeds
  - ADD `data/topics.json` — the 15 topics from PDR section 5.3.
  - ADD `data/crisis-resources.json` — the hotlines for CL/MX/CO/AR/PE with `verified_at: null`, plus an emergency number per country and the international fallback entry.
  - ADD `data/bed-tracks.json` — synthesis descriptors (`frequency_hz`, waveform, noise layer) rather than file paths.
  - ADD `data/presenting-needs.json` — the 8 shortcuts for onboarding screen 3, phrased as questions the user is asking, never as diagnoses.
- [x] [UNPLANNED] Step 1.2b: Onboarding screen 4 options
  - ADD `data/openness-options.json` — five family-level choices, each with the modality slugs it expands to.
  - _Rationale: PDR 5.2 stores `openness_to_modalities` as slugs and PDR 7.2
    filters on them, but twenty-one checkboxes is an unusable screen. The UI
    offers families and the store expands to slugs before persisting, so the
    data contract is untouched. `expands_to` is asserted against
    `modalities.json` in the tests, so a modality that no option reaches — and
    would therefore be silently absent from every user's pool — fails._
- [x] Step 1.3: Contracts
  - ADD `src/lib/schemas/catalog.ts` — `Modality`, `Topic`, `CrisisResource`, `BedTrack`, `PresentingNeed`, and the two option files.
  - ADD `src/lib/schemas/ai.ts` — `Numerology`, `SoulMapSynthesis`, `SoulMapCrisis`, `MatchResult`, `ChatResponse`, `MeditationScript`, `ComparisonResult`.
  - ADD `src/lib/catalog.ts` — parses every seed at module load and exposes typed accessors plus `expandOpenness` and `hasUnverifiedResources`.
  - ADD `src/lib/catalog.test.ts` — referential integrity and the PDR's prose invariants.
  - _Note: the crisis contract is modelled so it has nowhere to put tips, and
    the comparison contract has no verdict or score field. The PDR states both
    as hard prompt rules; expressing them in the schema means a model that
    breaks them fails validation rather than reaching a screen._

**Verification** — passed 2026-08-11

- `pnpm test` 67 passing across 2 files, `pnpm typecheck` clean, `pnpm build`
  succeeds with the seed imported through the `@data` alias.
- 21 modalities, 15 topics, unique slugs, every `works_well_for` resolving.
- The coverage test caught a real hole on first run: no modality claimed
  `sexualidad`. Added to `psicologia-clinica`, `terapia-sistemica` and
  `terapia-somatica`, which is where sex therapy actually lives.
- Every MVP country reports unverified, and every country has an emergency
  number rather than only hotlines.
- The self-diagnosis guard rejects any shortcut naming a condition, which is
  what the mockups' "Superar la depresión" would have been.

### Phase 2: Crisis safety

- [x] Step 2.1: Keyword lists
  - ADD `data/crisis-keywords.json` — five categories (ideación, autolesión, abuso, psicosis, pánico) plus indirect markers and negation/third-person markers, versioned, flagged `"status": "preliminary"`.
- [x] Step 2.2: Detector
  - ADD `src/lib/safety.ts` — normalise, match whole token sequences on word boundaries, discard a match preceded by a suppressor within a 4-token window, require two distinct indirect markers within the same text, and expose `detectCrisis`, `isClinicallyVulnerable`, `riskLevel`, `shouldNotifyAdmin`.
  - ADD `src/lib/safety.test.ts` — 60 cases across direct terms, suppression with positive controls, indirect accumulation, the clinical answer, vulnerability and notification windows.
  - _Deviation: suppressors are split into three classes rather than the
    PDR's single list. Negation and reported speech always suppress; a person
    reference suppresses only when the matched term does not begin with "me".
    The exception is load-bearing — abuse is disclosed as "mi ex me persigue",
    where the person named is the perpetrator, not a different subject, and a
    flat list would silence the entire abuse category._
- [x] [UNPLANNED] Step 2.2b: Prove the suppression tests are not vacuous
  - MODIFY `src/lib/safety.test.ts` — every suppression case now carries a control: the same sentence without the suppressor, which must fire.
  - _Rationale: four of the first suppression tests passed while exercising
    nothing. Spanish reflexive morphology already separates third-person
    narration ("matarse" is not "matarme"), so the sentences never matched a
    term in the first place. The controls exposed two real defects — see the
    verification notes below._
- [x] Step 2.3: Deduplication and events
  - ADD `src/store/db.ts` — namespaced localStorage repository, one namespace per PDR table. Pulled forward from Phase 3 because the crisis store needs it.
  - ADD `src/store/crisis.ts` — record events, suppress repeat notification within 6 hours, false-positive marking, 30-day windows for blocking and for `$clinically_vulnerable`.
  - ADD `src/store/crisis.test.ts` — 11 cases over a Map-backed storage stub.
- [x] Step 2.4: Surfaces
  - ADD `src/screens/CrisisScreen.tsx` — full-screen takeover, containment copy, country hotlines with `tel:` links, unverified notice when `verified_at` is null, and the discreet "esto no aplica a mi caso" false-positive link.
  - ADD `src/components/CrisisBanner.tsx` — collapsible persistent banner for low severity.
  - ADD `src/components/CrisisResourceList.tsx` — shared by both surfaces so they cannot drift.
  - ADD `src/lib/crisis-resources.ts` — country lookup with the international fallback for any country outside CL/MX/CO/AR/PE.
- [x] [UNPLANNED] Step 2.5: `/lab/safety`
  - ADD `src/screens/SafetyLab.tsx` — type a phrase, see the verdict and the surface it produces, with samples covering each path including the deliberate silences.
  - _Rationale: the phase verification calls for a scratch route. Making it a
    real screen costs little and turns "the detector stays silent on
    bereavement" into something demonstrable rather than described._

**Verification** — passed 2026-08-11

- `pnpm test` 133 passing across 4 files, `pnpm typecheck` clean, build succeeds.
- Screenshot-verified in a browser: low severity renders the verdict and the
  collapsible banner; high severity renders the full-screen takeover with four
  Chilean numbers, the international fallback, and the unverified notice.
- The positive controls exposed two real defects, both fixed in the data:
  - **False positives on other people's lives.** Bare nouns fired:
    "el suicidio de mi hermano" and "mi primo tuvo una sobredosis" both
    triggered a full lockout, which would have met a bereaved person with a
    crisis screen. Every term is now anchored to a first-person form.
  - **False negatives on abuse.** The category had no stalking terms, so
    "mi ex me persigue" and "mi vecino me espera afuera de mi casa" were
    silent. Added, and covered by tests asserting they survive the person
    reference.
- [UNPLANNED] `DemoBanner` ran to three lines and covered every screen
  heading. Collapsed to one line with an expandable detail, and screens now
  clear it through a `--top-inset` token rather than each guessing a padding.

### Phase 3: Onboarding and numerology

- [x] Step 3.1: Numerology engine
  - ADD `src/lib/numerology.ts` — the five Pythagorean numbers, name normalisation (uppercase, strip diacritics, N-with-tilde to N, drop non A-Z), Y always a consonant, master numbers 11/22/33 preserved, life path reduced per component:
    ```ts
    const MASTERS = new Set([11, 22, 33]);
    export function reduce(n: number): number {
      while (n > 9 && !MASTERS.has(n)) {
        n = String(n).split('').reduce((a, d) => a + Number(d), 0);
      }
      return n;
    }
    ```
  - ADD `src/lib/numerology.test.ts` — at least 15 cases: one yielding 11, one yielding 22, one with N-with-tilde, one with acute accents, one five-word compound name.
- [x] Step 3.2: Session store
  - ADD `src/store/session.ts` — anonymous session with a 7-day expiry, claimable at signup, mirroring `anonymous_sessions`.
  - ADD `src/store/session.test.ts` — the acceptance criteria of US-1.1 and US-1.2 as executable checks.
  - `src/store/db.ts` was pulled forward into Phase 2.
- [x] Step 3.3: The eight screens
  - ADD `src/screens/onboarding/` — `Landing`, `BasicData`, `PresentingNeed`, `Openness`, `ClinicalBasics`, `NatalChart`, `Generating`, and the handoff to the Soul Map.
  - Copy follows PDR section 1: the entry question is "¿Qué te estás preguntando últimamente?"; options are phrased as situations, not diagnoses.
  - `birth_time` and `birth_city` are optional and skipping them must not block.
  - Clinical screen shows the containment intro, allows "prefiero no decir" on every question except ideation, and routes to the crisis screen when ideation is `plan_o_intencion`.
- [x] Step 3.4: Chart upload
  - ADD `src/screens/onboarding/NatalChart.tsx` — accept a PDF up to 10 MB, hold it, set `parse_status: 'pending'`, offer to continue without it.
  - ADD `src/components/onboarding/OptionItem.tsx` — the mockup's 52px glass row.
  - _Deviation: the emoji are dropped rather than replaced with line icons.
    Cormorant Garamond over desaturated photography is a sober register and a
    column of emoji pulls it toward a generic wellness app; the check mark
    carries the selected state on its own._
  - _Deviation: the file is held in session state rather than IndexedDB. The
    demo never re-reads the bytes — parsing needs Vision, which needs a key —
    so persisting a multi-megabyte blob would buy nothing. IndexedDB lands
    with the BYOK extraction call._

**Verification** — passed 2026-08-11

- `pnpm test` 167 passing across 6 files, `pnpm typecheck` clean, build succeeds.
- 23 numerology cases, every expected value computed by hand with the
  arithmetic written into the test, so the test checks the code rather than
  the code checking itself.
- Walked the full flow in a browser. "María de los Ángeles Fernández", born
  1901-11-29, renders life path 33, expression 1, soul urge 8, personality 11,
  birthday 11 — the same values derived by hand in `numerology.test.ts`.
- Answering `plan_o_intencion` on the clinical screen replaces the flow with
  the crisis screen and generates nothing (US-1.3 CA3).
- Birth time and city skipped without blocking (US-1.2 CA1).
- The whole run reaches the Soul Map with no account (US-1.1 CA1).

### Phase 4: Soul Map

- [x] [UNPLANNED] Step 4.0: Pull the copy lint forward from Phase 5
  - ADD `src/lib/copy-lint.ts`, `src/lib/copy-lint.test.ts` — the rules of PDR sections 1 and 7.5 as executable checks, with the PDR's own anti-patterns as failing cases and its model examples as passing ones.
  - _Rationale: the lint was planned for Phase 5, over model output. Written
    now, it also governs the hand-written fixtures — which is where the copy
    rules are most likely to lapse quietly, because nobody reviews a fixture
    the way they review a prompt. `runAi` applies it to both implementations._
- [x] Step 4.1: AI client
  - ADD `src/ai/client.ts` — one `runAi` with two paths, both parsing against the same schema and passing the same copy lint; `fetch` with the `anthropic-dangerous-direct-browser-access` header, a 45s timeout, and one retry.
  - ADD `src/ai/mode.ts` — mode persisted in `localStorage`, key never leaves the browser except to Anthropic.
  - ADD `src/components/AiModeToggle.tsx` — reachable from the landing screen, with the warning stated at the moment of the choice rather than in a policy.
  - _Note: a copy violation breaks out of the retry loop. It is a property of
    the prompt, not a bad roll, so a second call buys the same answer at the
    cost of the viewer's quota._
- [x] Step 4.2: Prompts
  - ADD `src/ai/prompts/soul-map.ts` — the output contract of PDR 6.5, `matched_facilitators` removed, `inferred_topics` added.
  - ADD `src/ai/prompts/shared.ts` — tone rules and JSON discipline.
  - _Deviation, and the important one: PDR appendix B calls
    `07 - System Prompt IA.md` "vigente y crítico — copiar literal". That file
    was not available, so the prompt is RECONSTRUCTED from the principles of
    section 1, the contract of 6.5 and the copy rules of 7.5. Every version
    string carries a `-reconstructed` suffix, the provenance is stated at the
    top of `shared.ts`, and the Soul Map screen prints the version — so
    nothing downstream can mistake it for the vault's text. Swapping in the
    real one is a change to two constants._
  - _`clinical_basics` is deliberately absent from the payload. PDR 10.2
    applies the same reasoning to chat: a derived risk level, never the raw
    answers._
- [x] Step 4.3: Fixtures
  - ADD `src/ai/fixtures/soul-map.ts` — three narratives (`pregunta`, `exploracion`, `integracion`) plus the crisis branch, selected deterministically from what the person chose.
  - ADD `src/ai/fixtures/soul-map.test.ts` — schema, copy lint, sentence budgets, question-shaped invitations, topic existence, and that three different inputs give three different maps.
  - _Deviation: four fixtures rather than three. A demo where every answer is
    identical teaches the viewer that nothing is being read._
- [x] Step 4.4: Screens
  - MODIFY `src/screens/onboarding/Generating.tsx` — runs the generation, holds a 4.8s floor, and shows the PDR's empathetic failure copy with a retry that keeps the input.
  - MODIFY `src/screens/SoulMap.tsx` — three sections, tips with cadence and italic invitations, the five numbers, and a provenance line naming the mode and prompt version.
  - ADD `src/store/soulMap.ts` — mirrors `soul_map_syntheses` including the one-current-row rule.

**Verification** — passed 2026-08-11

- `pnpm test` 208 passing across 8 files, `pnpm typecheck` clean, build succeeds.
- Walked the flow in a browser: choosing "Repito algo" produced the
  `exploracion` narrative with four tips, the five numbers, and the footer
  reading `MODO DEMO · GUION CURADO · SOUL-MAP-V2.0-RECONSTRUCTED`.
- The fixtures pass the same lint applied to model output — including the
  sentence budgets of PDR 6.5 and the rule that every tip closes on a question.
- Generation is guarded against StrictMode's double-invoke, which would
  otherwise spend two API calls on someone else's key.

### Phase 5: Modality matching and routine

- [x] Step 5.1: Hard filter
  - ADD `src/lib/matching.ts` — the SQL filter of PDR section 7.2 as pure TypeScript: openness exclusion (with `me_da_lo_mismo` bypass), clinical-vulnerability exclusion of `requires_clinical_support`, topical relevance, and the four edge cases — empty pool retries without the topical filter then falls back to the five contemplative modalities, a pool of one or two is shown honestly, a pool over twelve truncates by ascending intensity and logs the count dropped, and an AI failure falls back to top-three by topic overlap with pre-written reasoning.
  - ADD `src/lib/matching.test.ts` — one case per edge case plus a clinically vulnerable profile that must exclude every removing modality.
- [x] Step 5.2: Ranking
  - ADD `src/ai/prompts/match.ts` — the four ordered dimensions of PDR 7.3, the prohibition on inventing slugs, the mandatory `caution_note`, and the copy rules of 7.5. Reconstructed, like every prompt here.
  - ADD `src/ai/fixtures/match.ts` — a curated reasoning for all 21 modalities, assembled against whatever the hard filter returned, plus four routine practices.
  - ADD `src/ai/match.ts` — the call, with the deterministic fallback of PDR 7.2 edge case 4.
  - _The prompt is told how the pool was reached. A relaxed or fallback pool
    should not be described with the confidence of a topically matched one._
- [x] Step 5.3: Copy lint
  - Completed early in Phase 4.
- [x] Step 5.4: Screens
  - ADD `src/components/Constellation.tsx` — mockup screen 04 with modality nodes, no score, no person.
  - ADD `src/components/ModalityCard.tsx` — name, family, format, horizon, evidence level, personalised reasoning, an expandable "qué pasa en una sesión", the caution note, and save / dismiss.
  - ADD `src/screens/Recommendations.tsx`, `src/screens/Routine.tsx`, `src/store/matches.ts`.

**Verification** — passed 2026-08-11

- `pnpm test` 244 passing across 10 files, `pnpm typecheck` clean, build succeeds.
- Walked the flow in a browser: five modalities ranked, evidence levels
  visible and distinguished, no percentage anywhere, and the routine screen
  carrying check-ins with no streak.

Three defects found by walking it, all fixed:

- **A contradiction inside the PDR.** Section 7.2 says a pool of one or two is
  shown as it is, "sin rellenar con ruido"; section 7.4 requires three to five
  matched modalities. A two-modality pool therefore failed schema validation
  and silently fell through to the deterministic fallback. Resolved in favour
  of 7.2 — padding is the one thing that edge case forbids. The schema's lower
  bound drops to 1 and the real guard moves to `matchModalities`, which
  rejects fewer than `min(3, poolSize)` so a model under-delivering on a
  healthy pool still fails.
- **An impure state updater.** `advance` persisted the step from inside a
  `setIndex` updater. Under StrictMode's double-invoke the write ran twice and
  React was free to discard the result — the onboarding simply stopped
  advancing after the second screen. It looked like a click-handling problem
  and was a purity problem.
- **A stale match.** Redoing onboarding landed on the previous
  recommendations, because a stored match had no link to the synthesis it came
  from. `StoredMatch` now carries `synthesis_id` — which PDR 5.4 already asks
  for under the name `soul_map_snapshot`, for reproducibility.
- [UNPLANNED] The constellation was being flex-shrunk inside the screen's
  column while its absolutely positioned nodes stayed put, landing them on the
  heading. `shrink-0`.

### Phase 6: Account, dashboard and library

- [x] Step 6.1: Simulated account
  - ADD `src/store/account.ts` — signup claims the anonymous session, transfers the Soul Map, and invalidates the anonymous record.
  - ADD `src/screens/Signup.tsx` — presented after the Soul Map, never before.
  - ADD `src/store/account.test.ts` — the claim, the idempotency, and the fallback below.
  - _Deviation, and the one that mattered: `account.ts` also exports
    `activeProfile()`. `claimSession` expires the anonymous record, so every
    screen still reading `getSession()` — the Soul Map heading, the whole
    recommendation pool — went blank the moment someone signed up. The
    accessor returns the client's profile if there is one and the session
    otherwise; `SoulMap.tsx` and `Recommendations.tsx` now go through it._
- [x] [UNPLANNED] Step 6.1b: Actually attach the Soul Map
  - MODIFY `src/screens/onboarding/Generating.tsx` — call `attachSoulMap` and `attachSoulMapToClient` after `saveSynthesis`.
  - _Rationale: `session.soul_map_id` was written by nothing. `attachSoulMap`
    existed and was tested since Phase 3, and no screen ever called it, so
    every session carried `soul_map_id: null` — which is exactly the field the
    claim is supposed to transfer. The phase's own verification criterion
    would have passed on a null._
- [x] Step 6.2: Dashboard
  - ADD `src/screens/Dashboard.tsx` — the seven sections of PDR section 11.1.
  - ADD `src/components/BottomNav.tsx` — the mockup's glass nav, extended past three icons.
  - _Deviation: PDR 11.1 names the dashboard's sections and that part of the
    document was not to hand. The seven are derived from the product's own
    destinations — map, paths, routine, conversation, meditations, comparison,
    account — which is the same list from the other direction. They live in
    one array, so a differing PDR ordering is one edit. The three surfaces
    that land in Phases 7 to 9 render dimmed and say so rather than linking
    nowhere._
  - _Deviation: a `--bottom-inset` token, mirroring `--top-inset`. The nav
    floats over the screens that carry it and one number is better than five
    guessed paddings. `tokens.test.ts` covers it under demo chrome, not under
    mockup geometry._
- [x] [UNPLANNED] Step 6.2b: A way back in
  - MODIFY `src/screens/Landing.tsx` — with a synthesis present the CTA reads "Volver a mi espacio" and points at the dashboard, with "Empezar de nuevo" underneath.
  - _Rationale: the dashboard was otherwise reachable only by signing up. A
    returning visitor was met by a first-run screen whose only button restarted
    onboarding over the top of their existing map._
- [x] Step 6.3: Data rights
  - ADD `src/lib/export.ts` — assemble the full local record as downloadable JSON.
  - ADD `src/lib/export.test.ts`, `src/store/blobs.ts`, `src/store/preferences.ts`.
  - ADD `src/screens/Account.tsx` — export, two-step delete that also clears IndexedDB blobs, and language preference.
  - _`export.ts` stays pure, like the rest of `src/lib`: it takes a snapshot
    and returns a document, and the caller reads storage and hands the browser
    a file._
  - _The redaction is the part with teeth. A BYOK viewer's Anthropic key lives
    in the same storage as everything else, and `src/ai/mode.ts` already
    claimed the key "is never included in an export". It is now enforced by a
    deep walk over the snapshot rather than promised in a comment._
  - _Nothing writes IndexedDB blobs yet — the chart PDF stays in session state
    and meditation audio lands in Phase 8. The sweep is written against the
    names Phase 8 will use, because a delete that quietly misses a store is
    the failure nobody notices._

**Verification** — passed 2026-08-11

- `pnpm test` 270 passing across 12 files, `pnpm typecheck` clean, build
  succeeds.
- Walked the whole flow in a browser, console clean, no warnings: onboarding
  through the Soul Map, signup, dashboard, recommendations, account.
- Signing up preserves the map generated anonymously — the dashboard still
  greets "María" and the recommendations still generate afterwards, which is
  the case the `activeProfile` fallback exists for and which would have been
  invisible to the type checker.
- Export downloaded as `natus-export-2026-08-11.json`, containing the client
  with its email and `soul_map_id`, the claimed anonymous session, the
  synthesis and the matches. Namespaces never written to are absent rather
  than emitted empty, which is what the snapshot honestly holds.
- With BYOK enabled and a key stored, the downloaded file carries
  `"apiKey": "[redactado]"` and the string `sk-ant-` appears nowhere in it.
  Verified on the real file, not only in the unit test.
- Two-step delete returns the app to first run: the landing reverts to
  "Comenzar" and the AI mode falls back to fixture, both of which are reads
  from the storage that was cleared.
- [UNPLANNED] The nav glyph for the routine was `❯`, which read as "next" and
  made a destination look like a step in a flow. Changed to `≡`.

### Phase 7: Chat and paywall

- [ ] Step 7.1: Chat engine
  - ADD `src/ai/prompts/chat.ts` — inherits the shared tone, adds short turns of two to six sentences, clarifying questions over forced interpretation, explicit referral to human work, and no therapy.
  - ADD `src/store/chat.ts` — conversations and messages, with the risk level derived in code rather than passing raw clinical notes into context.
- [ ] Step 7.2: Screens
  - ADD `src/screens/Chat.tsx` — always-visible remaining-question counter, Layer 1 safety on every message before it reaches the model, and the four response types.
  - ADD `src/components/Paywall.tsx` — appears at zero remaining without discarding the text already typed.

**Verification**

`pnpm test` green. The counter decrements only on successful answers, not on
failures or crisis turns. Reaching zero shows the paywall with the draft
message intact. A crisis phrase in chat switches to containment mode with no
symbolic interpretation.

### Phase 8: Meditations

- [ ] Step 8.1: Script and SSML
  - ADD `src/ai/prompts/meditation.ts` — the four-part structure of PDR section 9.4 with SSML markers, `rate` between 78% and 88%, and 2-5s breaks.
  - ADD `src/audio/ssml.ts` — parse SSML into an ordered queue of utterances and timed pauses.
  - ADD `src/audio/ssml.test.ts` — break durations and prosody survive the round trip.
- [ ] Step 8.2: Audio
  - ADD `src/audio/tts.ts` — Web Speech synthesis behind the same `synthesize` shape the PDR defines for the server provider, so swapping to Google TTS is one implementation.
  - ADD `src/audio/bed.ts` — bed tracks synthesised with `OscillatorNode` and filtered noise at the declared frequencies; single-tone drones only, explicitly not binaural.
  - ADD `src/audio/player.ts` — two gain nodes, independent voice and bed volume, preference persisted.
- [ ] Step 8.3: Screens
  - ADD `src/screens/Meditation.tsx` — intent input passing through Layer 1 safety, 5/10/20 minute choice, status progression, transcript beside the audio.
  - ADD `src/screens/Library.tsx` — generated meditations, deletable together with their stored audio.

**Verification**

`pnpm test` green including the SSML round trip. A generated meditation plays
voice and bed together, the two volume sliders act independently, the
preference survives a reload, and the transcript matches the spoken script.

### Phase 9: Chart comparison

- [ ] Step 9.1: Payload isolation
  - ADD `src/lib/comparison-payload.ts` — build the model payload from an explicit allow-list of fields.
  - ADD `src/lib/comparison-payload.test.ts` — assert the constructed payload contains neither `presenting_need_text` nor `clinical_basics` for either subject, under every scope combination.
- [ ] Step 9.2: Consent
  - ADD `src/screens/comparison/ExternalProfile.tsx` — the mandatory warning about loading another person's data before saving, and deletion by the owner.
  - ADD `src/screens/comparison/Consent.tsx` — simulated request and response between two local profiles, with scope, 14-day expiry, and revocation.
- [ ] Step 9.3: Result
  - ADD `src/ai/prompts/comparison.ts` — the six hard rules of PDR section 8.5: no verdict on the relationship, no pathologising the other person, mandatory symmetry, close on questions, never invent chart positions, and refuse the feature entirely while the requester is in active crisis.
  - ADD `src/screens/comparison/Result.tsx` — the section 8.4 contract ending in `questions_to_explore` and the disclaimer.

**Verification**

`pnpm test` green including the payload isolation test. Revoking consent makes
the comparison unreadable on the next render with no client-side cache. The
feature is unavailable while a crisis event is active.

### Phase 10: Hardening and handover

- [ ] Step 10.1: Accessibility
  - MODIFY components — AA contrast against the photographic backgrounds, visible focus rings, labelled controls, respect for `prefers-reduced-motion` on the pulse and generating animations.
- [ ] Step 10.2: Honest framing
  - MODIFY `src/components/DemoBanner.tsx` — state that data stays in the browser in fixture mode and is sent to Anthropic in BYOK mode.
  - MODIFY `src/screens/CrisisScreen.tsx` — verify the unverified-hotline notice reads correctly and the international fallback is always present.
- [ ] Step 10.3: Documentation
  - MODIFY `README.md` — what this is, what is real versus simulated, how to run, how to enable BYOK.
  - ADD `docs/PDR.md` — the source document committed for provenance.
  - MODIFY `docs/HANDOFF.md` — transfer checklist including removing account-level domain verification.
  - ADD `docs/MIGRATION.md` — the mapping from `src/lib` and `src/store` to Supabase Edge Functions and tables.

**Verification**

`pnpm typecheck`, `pnpm test` and `pnpm build` all pass. Lighthouse
accessibility at or above 90 on the Soul Map and Recommendations screens. The
deployed URL shows the demo banner, `robots.txt` disallows crawling, and a
reviewer reading `README.md` can tell within a minute what is real and what is
staged.

## Success Criteria

- A public URL serves the demo and a first-time visitor can go from landing to
  dashboard without creating an account or entering any key.
- Numerology output is verified by at least 15 unit tests covering master
  numbers 11/22/33, diacritics, the letter N-with-tilde, and multi-word names.
- Crisis Layer 1 is verified by at least 20 synthetic cases, including negation
  and third-person narration that must NOT trigger a false positive.
- A high-severity crisis signal blocks Soul Map generation, recommendations and
  meditations, and shows the full-screen crisis view instead.
- No recommendation surface displays a facilitator name or a percentage score,
  and no card uses absolute-certainty language.
- The chart-comparison payload provably excludes `presenting_need_text` and
  `clinical_basics`, verified by a test over the constructed payload.
- Routine tracking exists with no streaks, badges, or re-engagement prompts.
- `pnpm typecheck` and `pnpm test` pass, and the deploy workflow publishes on
  push to `main`.
- The base path is configurable so attaching a custom domain or moving the repo
  to a new owner requires no code changes.

## Notes

### Deliberate deviations from the PDR, and why

| PDR | Demo | Reason |
|-----|------|--------|
| Google Cloud TTS | Web Speech API | No backend can hold the key; the `synthesize` interface is preserved |
| Curated `bed_tracks` audio files | `OscillatorNode` synthesis | No assets, no licensing exposure, same declared frequencies |
| Server-side Vision parsing of the chart PDF | Stored and previewed, parsing stubbed | Requires a key; enabled automatically in BYOK mode later |
| Consent by transactional email | Simulated between two local profiles | No mail provider in a static build |
| Payment gateway and webhooks | Simulated paywall | No charge is meaningful in a demo |

Binaural tones are deliberately not implemented. They are contraindicated in
epilepsy and would require adding a question to the clinical screen, which is
out of scope. The synthesised beds are single-tone drones and filtered noise.

### Deferred decisions, and why they do not block

| Decision | Why it can wait |
|----------|-----------------|
| Publishing unverified hotline numbers | Driven by `verified_at` in `data/crisis-resources.json`; a data edit, not a code change |
| Public versus private repository | Affects the `gh repo create` flag only; Pages on a free account requires public |
| Branding and logo | Mockup tokens are adopted wholesale; the ouroboros ring stands in until a mark exists |
| Custom domain | `VITE_BASE` is an environment variable and `public/CNAME` is one line |

<!-- FEEDBACK: general
General questions, concerns, or suggestions for the entire implementation plan.
Status: OPEN
-->
