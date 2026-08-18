# From this demo to Supabase

**Steps 1 to 5 are done.** This document is kept as the map it was, with each
step marked, because the reasoning is what makes the remaining step legible —
and because the line it draws through `src/` is still the line the parity test
enforces every time the suite runs.

This demo was written to be thrown away in one specific place and kept in
another. The line runs through `src/`:

```
  src/lib/     ──────────────►  supabase/functions/_shared/lib/
               copied unchanged. No React, no localStorage, no browser API.

  src/store/   ──────────────►  deleted. Replaced by SQL, per file.
               call sites do not move; implementations do.

  src/ai/      ──────────────►  moved server-side. BYOK deleted.
  src/screens/ ──────────────►  stayed. No screen changed for any of it.
```

Keeping `src/lib` clean is the whole point. If anything in there ever imports
from `src/store`, this document stops being true.

## `src/lib` — copy as is

| File | Becomes | Notes |
|------|---------|-------|
| `numerology.ts` | `_shared/lib/numerology.ts` | Pure. No change |
| `safety.ts` | `_shared/lib/safety.ts` | Pure. Reads `data/crisis-keywords.json`, which moves with it |
| `matching.ts` | `_shared/lib/matching.ts` | The hard filter. See the note below about where it should run |
| `copy-lint.ts` | `_shared/lib/copy-lint.ts` | Pure |
| `comparison-payload.ts` | `_shared/lib/comparison-payload.ts` | Pure. Keep the allow-list shape |
| `crisis-resources.ts` | `_shared/lib/crisis-resources.ts` | Pure |
| `catalog.ts` | `_shared/lib/catalog.ts` | The JSON seeds become tables; the accessors become queries |
| `schemas/` | `_shared/lib/schemas/` | zod, unchanged |
| `export.ts` | `_shared/lib/export.ts` | Takes a snapshot, returns a document. The snapshot becomes a query result |

**Where the hard filter runs.** In the demo it runs in the browser, because
there is nothing else. In production it belongs in the Edge Function, next to
the model call. The clinical exclusions are the reason: a filter running on a
client can be tampered with, and this one decides whether someone in a fragile
state is shown a modality that opens things up. Same file, different side.

## `src/store` — one namespace per table

Every file writes one `localStorage` key named after the PDR 5 table it
mirrors, and exposes functions shaped like the queries that replace them.

**"Call sites do not move" has a condition attached.** The store is synchronous
and the screens call it from render bodies, not from hooks or effects —
`Dashboard.tsx:46` reads `activeProfile()` and `currentSynthesis()` inline. A
component cannot await in its render body, so this is not a matter of
propagating `await` through twenty-eight importing files. Something has to
absorb the asynchrony, and the promise above only survives if that something
sits behind `read`. `DECISIONS.md` §12 records how, and what it costs.

| Store file | Table | What has to exist in SQL |
|------------|-------|--------------------------|
| `session.ts` | `anonymous_sessions` | 7-day expiry; a nightly job deletes expired unclaimed rows with their orphaned soul map and stored PDF |
| `account.ts` | `clients` | Supabase Auth owns identity; the claim moves the draft onto the row |
| `soulMap.ts` | `soul_map_syntheses` | The `one_current_synthesis` unique partial index is load-bearing |
| `matches.ts` | `match_requests`, `modality_matches`, `recommendations`, `recommendation_checkins` | Unique constraint on (practice, day) for check-ins |
| `crisis.ts` | `crisis_events` | The admin notification becomes a real email, deduplicated at 6 hours |
| `chat.ts` | `conversations`, `messages` | The quota becomes a count over `messages` where `counted` |
| `subscription.ts` | `subscriptions` | Replaced by the payment provider's webhooks |
| `meditations.ts` | `meditations` | Gains `audio_url` into a private bucket, per PDR 5.7 |
| `comparison.ts` | `external_profiles`, `comparison_consents`, `chart_comparisons` | The consent must be enforced by RLS, not only by the read helper |
| `preferences.ts` | `preferences` | |
| `blobs.ts` | — | Deleted. Storage buckets replace it |

**RLS is not optional here.** Two policies carry the product's promises:

- Nobody reads a `chart_comparisons` row without a `granted`, unexpired
  `comparison_consents` row for that pair. In the demo, `readableComparison`
  re-checks this on every read; in Postgres it has to be a policy, because a
  helper function is only as good as the call site that remembers it.
- Nobody reads another client's `clinical_basics`, ever. Not through a join,
  not through a view, not through a comparison.

## `src/ai` — most of it moves server-side

**Done.** `runAi` had two paths: curated fixtures and a key the viewer pasted.
The key now lives in the Edge Functions' environment, and the BYOK path is
gone along with `mode.ts` and `AiModeToggle.tsx`. What it kept is the shape:
two implementations, one validation path.

Two prompts had to be untangled to travel — `soul-map.ts` reached into
`src/store` for a type and `meditation.ts` into `src/audio` for the prosody
bounds. The first became `soulMapDraftSchema`, the second moved `ssml.ts` into
`src/lib`. Both are the boundary above doing its job: neither would have been
noticed until the server refused to boot.

Everything else survives intact:

- The prompts, unchanged. **Replace `prompts/shared.ts` first** — every
  version string carries a `-reconstructed` suffix because the vault's
  `07 - System Prompt IA.md` was not available. Swapping in the real text and
  dropping the suffix is a change to two constants.
- The copy lint over every response, fixtures included.
- The schemas, which is what makes a malformed response fail before it reaches
  a screen rather than after.
- The fixtures themselves, as test material. They are the only thing that
  proves the contracts still hold without spending tokens.

`claude_api_calls` logging (PDR 4) has no equivalent here — there is no server
to log from. It lands with the Edge Function.

## What has no equivalent and must be built

| Demo | Production |
|------|------------|
| Web Speech API | Google Cloud TTS. `audio/tts.ts` already has the `synthesize` shape; the bed and the SSML parser stay client-side |
| `OscillatorNode` beds | Curated audio files, and `bed_tracks.license` becomes mandatory |
| Chart PDF held in session state | ~~Storage bucket plus a Vision call~~ — **superseded.** The chart is calculated from date, time and place through the Astrologer API's `/api/v5/context/birth-chart`, and the upload is removed rather than parsed. See `DECISIONS.md` §11 |
| Simulated consent between two local profiles | Transactional email with a signed link |
| Simulated paywall | Payment gateway and webhooks |
| Local debug panel | `claude_api_calls` |

## The order to do it in

Steps 1 to 5 were planned phase by phase in
`specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md`, with auth
inserted between 1 and 2 — anonymous sign-in with an optional upgrade to email,
because `auth.uid()` has to mean something before the policies in step 1 do
anything. Step 6 is still not scheduled.

1. ~~Tables and RLS.~~ Done. The policies above are the ones with tests.
2. ~~`_shared/lib`, copied, with its existing tests.~~ Done — they passed
   unchanged, and `shared-parity.test.ts` now fails if the copies drift.
3. ~~One Edge Function per purpose, reusing the prompts and schemas.~~ Done.
   Five of them, plus `natal-chart`, which this document did not anticipate.
4. ~~Repoint `src/store` at Supabase.~~ Done, and no screen changed — which
   was the promise this file made and the one most likely to have been broken
   quietly.
5. ~~Delete `mode.ts`, `AiModeToggle.tsx`, and the BYOK branch.~~ Done.
6. TTS, storage, email, payments — each independent of the others. Not started.

**What the plan did not have, and reality did:** the natal chart stopped being
a PDF to parse and became an ephemeris call (`DECISIONS.md` §11), and a closed
pilot needed a door in front of everything (§13). Both are in the repository;
neither is in the list above, because the list is what was foreseen.
