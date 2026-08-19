# Decision record

Why things are the way they are, including the options that were rejected.

The implementation plan records *what* was built and the code comments record
*why this line*. This file holds the third thing: choices where a reasonable
person would have gone the other way, and the reason not to. It exists so the
work does not depend on anyone's memory of the conversation it came from.

Ordered by how expensive it would be to get wrong.

---

## 1. Modalities, not people

**Decision.** The MVP recommends therapy modalities. It shows no facilitator
name and no match percentage.

**Why it was a choice.** The mockups (`natus-mockups.html`) depict the May
2026 vault scope: a constellation of facilitator avatars, "98% match", "Ver
Perfil de Pepom". PDR section 0.1 supersedes that. Both documents are dated
August 2026 and neither obviously postdates the other, so this was confirmed
explicitly rather than inferred.

**What it costs.** The PDR's own section 0.2 is honest that this contradicts
the thesis underneath the product — the literature it cites (Bordin, Horvath,
Wampold, Flückiger) says alliance with a person predicts change, and technique
explains little variance. Recommending modalities is a weaker claim.

**Why it is still right for an MVP.** It ships without supply. No facilitator
needs to be onboarded for the product to be useful, and the demo does not have
to invent people who do not exist. Section 0.2 asks for a change of register
to match: not "this person will connect with you" but "this modality works on
what you are describing, and here is what a session feels like".

**If this reverses**, the surface to change is `src/lib/matching.ts`,
`src/ai/prompts/match.ts` and `src/components/ModalityCard.tsx`. The
constellation visual survives either way.

---

## 2. The system prompt is reconstructed, and says so

**Decision.** `src/ai/prompts/shared.ts` and `soul-map.ts` were written from
the PDR's principles rather than copied from the vault.

**Why.** PDR appendix B lists `07 - System Prompt IA.md` as "vigente y crítico
— copiar literal". That file was not available. The alternatives were to block
the phase or to reconstruct.

**How the risk is contained.** Every version string carries a
`-reconstructed` suffix, `shared.ts` opens with a provenance block, and the
Soul Map screen prints the version at the foot of the page. Nobody reading a
generated map can mistake it for the vault's voice. Swapping in the real text
is a change to two constants.

**Still open.** If the vault file appears, replace `TONE_RULES` and
`SOUL_MAP_SYSTEM_PROMPT`, drop the suffix, and re-run the fixture tests — the
copy lint will catch a prompt that stops matching the fixtures.

---

## 3. Fixtures by default, BYOK by opt-in — and no proxy

> **Partly superseded by §10.** The no-proxy half of this decision no longer
> holds; the fixture half does, and matters more than ever. Read §10 with it.

**Decision.** The demo ships curated responses. A viewer can paste their own
Anthropic key to see real generation.

**Rejected: a server-side proxy.** A tiny Cloudflare Worker holding the key
would give live AI to every visitor with no friction. It was rejected because
it reintroduces a server to a project whose whole premise is that it does not
have one, and because it puts a spend-anything endpoint on a public URL.

**Rejected: fixtures only.** Simpler and safer, but it cannot show the thing
the product actually is.

**Why the split works.** A live demo that depends on a network call and
someone else's quota is a demo that fails in the room. Fixture mode always
works, offline included. Both paths validate against the same zod schemas and
pass the same copy lint, so the fixtures cannot drift into being a different
product from the real one.

---

## 4. The copy rules are a lint, not a instruction

**Decision.** `src/lib/copy-lint.ts` runs over model output *and* over the
hand-written fixtures.

**Why.** The rules of PDR sections 1 and 7.5 are prose, and prose erodes. The
lint was originally planned for Phase 5, to police the model. Writing it in
Phase 4 revealed it matters more for the fixtures: a prompt gets reviewed, a
fixture does not, so a fixture is where "no orders, no cures, no percentages"
would quietly stop applying.

**The tests are built from the PDR's own examples** — its stated
anti-patterns must fail, its model sentences must pass. That is what keeps the
lint honest about what it is enforcing.

---

## 5. Safety is deterministic and runs in front of everything

**Decision.** Layer 1 is a keyword detector in `src/lib/safety.ts`, run before
any model call, and the clinical exclusions in the recommendation pool are a
SQL-shaped predicate rather than a prompt instruction.

**Why.** A prompt instruction is a request. A predicate is a guarantee. The
difference matters most in exactly the case where the model is least reliable:
unusual input.

**Three findings worth remembering:**

- **Suppression tests pass vacuously by default.** Spanish reflexive
  morphology separates most third-person narration on its own ("matarse" is
  not "matarme"), so tests looked green while exercising nothing. Every
  suppression case now carries a control — the same sentence without the
  suppressor, which must fire.
- **Bare nouns fire on other people's lives.** "el suicidio de mi hermano" and
  "mi primo tuvo una sobredosis" both triggered a full lockout. Every term is
  now anchored to a first-person form.
- **A person reference must not suppress a term beginning with "me".** Abuse
  is disclosed as "mi ex me persigue", where the person named is the
  perpetrator, not a different subject. A flat suppressor list silences the
  entire abuse category.

---

## 6. Hotline numbers are data, not a decision

**Decision.** Every entry in `data/crisis-resources.json` carries
`verified_at: null`, and the crisis screen renders an unverified notice while
that is true.

**Why.** Whether to publish unverified numbers was an open product question.
Making it a field rather than a code path meant the phase did not have to wait
for the answer, and verification becomes a data edit.

**This is still a launch blocker.** PDR section 6.4 says to verify by calling,
not by searching, and to re-verify every six months.

---

## 7. Deliberate absences

Each of these is a thing a reasonable engineer would add, and a thing this
product decided against. If a ticket asks for one, this is the reason to push
back.

| Absent | Why |
|--------|-----|
| Streaks, badges, re-engagement notifications | PDR 12.2. `store/matches.ts` computes a total, never a consecutive run — the number a streak needs is not calculated anywhere |
| Match percentages | PDR 7.3 orders rather than scores; a percentage implies a precision that does not exist |
| Binaural tones | Contraindicated in epilepsy, and adding them would require another clinical onboarding question |
| Emoji in option lists | The typography and photography set a sober register that a column of emoji undoes |
| Raw `clinical_basics` in any model payload | PDR 10.2 — a derived risk level instead. Fewer tokens, less surface to leak back |

---

## 8. Deviations from the PDR, and why

| PDR says | Built as | Reason |
|----------|----------|--------|
| `matched_modalities` 3-5 | schema allows 1-5 | Sections 7.2 and 7.4 contradict each other; 7.2 forbids padding a small pool with noise, so it wins. The `min(3, poolSize)` guard moved to `matchModalities` |
| `requires_clinical_support` on breathwork | Not flagged | 5.3 names "breathwork holotrópico" specifically, and the PDR's own model routine tip is 4-7-8 breathing. Intense variants are in `contraindications` |
| Five contemplative modalities for the empty-pool fallback | Four | The fallback selects by family and safety rather than a hardcoded count; a fifth would have meant miscategorising something |
| Google Cloud TTS | Web Speech API | No backend can hold the key. The `synthesize` interface is preserved |
| Curated `bed_tracks` audio files | `OscillatorNode` synthesis | No assets, no licensing exposure, same declared frequencies |
| Server-side Vision parsing of the chart PDF | Held, parsing stubbed | Needs a key. **Superseded by §11** — the chart stops being a PDF rather than becoming a parsed one |
| Consent by transactional email | Simulated between local profiles | No mail provider in a static build |

---

## 9. Open questions, and who owns them

| Question | Owner | Blocks |
|----------|-------|--------|
| Telephone verification of the 11 hotlines | Nico | Launch, absolutely |
| Clinical review of `data/crisis-keywords.json` | A clinical psychologist | Launch |
| Review of the 21 modality descriptions | Nico | Nothing — the draft is integrated and tested |
| The vault's `07 - System Prompt IA.md` | Nico | Nothing — reconstructed and labelled |
| Final onboarding copy and the 6-8 presenting needs | Product | Nothing — drafted per PDR section 1 |
| Repository visibility (Pages on free requires public) | Tomás | Nothing today |
| Brand mark | Tomás | Nothing — the mockup's ouroboros stands in |
| Whether to pay to stop the Supabase project pausing | Tomás | Nothing structural — it decides whether a demo opens instantly or cold-starts |

---

# Backend migration

Decisions from August 2026, when the project stopped being a static demo. The
sections above were written for a product with no server and most of them still
stand; these three are where that assumption was load-bearing.

Planned in `specs/2026/08/NATUS-BACKEND/002-supabase-backend-migration.md`.

---

## 10. The proxy, reconsidered

**Decision.** The Anthropic key moves into a Supabase Edge Function. Every
visitor gets live generation without holding a key. The BYOK path is deleted.
**The fixture path stays.**

**This supersedes half of §3.** That section rejected a server-side proxy for
two reasons, and they did not age the same way.

> "It reintroduces a server to a project whose whole premise is that it does
> not have one."

Correct, and no longer applicable. The premise changed. This stopped being a
demo the moment it acquired users whose data has to outlive their browser
session, and once a server exists to hold their rows, refusing to let it hold a
key buys nothing.

> "It puts a spend-anything endpoint on a public URL."

Still entirely true, and unaddressed by anything above. This is why the chat
quota becomes real in the same round rather than a later one: enforced
server-side, counted over `messages where counted`, and checked in the Edge
Function rather than the browser. A quota checked in the client is a
suggestion. **The chat does not open to users until that is done** — that
sequencing is what discharges the objection, and reordering it would quietly
reintroduce the risk §3 named.

**What survives untouched.** The fixture path, and the reason for it: "a live
demo that depends on a network call and someone else's quota is a demo that
fails in the room." That is now a demo depending on a Supabase project that
pauses after a week of inactivity, which is the same failure with a different
cause. Fixtures become the degraded mode. `runAi` keeps its two-implementation
shape, its single zod validation and its single copy lint, which is what has
been stopping the fixtures from drifting into a different product.

**Rejected: deleting fixtures along with BYOK.** Tempting, since a working
server makes them look redundant. They are not — they are the offline path, and
they are the only thing that proves the contracts hold without spending tokens.

**What this newly makes possible, and newly makes fragile.** Raw
`clinical_basics` never entering a model payload (§7) was previously
guaranteed by there being no server to send it from. Now it is a real
guarantee — enforceable, logged, testable — and simultaneously easy to break,
because the function holds the whole row and only discipline stops it being
forwarded. It is a step in the plan for that reason.

---

## 11. The natal chart comes from ephemeris, not from a PDF

**Decision.** The chart is calculated from date, time and place through the
Astrologer API, which runs Kerykeion over Swiss Ephemeris. The PDF upload is
removed rather than made to work.

**Rejected: Vision parsing of the uploaded PDF.** This was the plan of record —
§8 and `docs/MIGRATION.md` both describe a Storage bucket plus a Vision call,
and `src/screens/onboarding/NatalChart.tsx` was written against it, accepting
the file and leaving `parse_status: 'pending'`. It was rejected because asking
someone to export a PDF from astro.com and upload it is harder than asking them
when and where they were born, because it spends model tokens on every chart,
and because it returns extracted text where the alternative returns structured
data.

**Why this API.** Its `/api/v5/context/*` endpoints return XML shaped for a
model rather than an SVG that would have to be parsed back into meaning. That
is the exact seam the Soul Map needs, and it removes a serialiser nobody has to
write. It also speaks Spanish, which matters for anything rendered.

**Cost shape.** One call per person for the life of their account, not one per
session. Fifty users is fifty calls, ever.

**Location resolution.** Astrologer needs coordinates and an IANA timezone.
The Edge Function resolves both from city and ISO country through Open-Meteo's
geocoding endpoint, so the onboarding does not ask people for coordinates or
require a second service credential. The RapidAPI key remains a Supabase
secret; it is not a `VITE_` variable and does not reach the browser.

**The trap in the same API.** `/compatibility-score` returns a number — a Ciro
Discepolo score. §7 forbids match percentages and the chart comparison is
explicitly verdict-free. `/chart-data/synastry` gives the aspects without the
score and is the endpoint to use. This is written down because the wrong one is
the more obviously named of the two.

**Verified against the provider, 2026-08-19.** A real chart, from the deployed
function, on the production project: Santiago resolved to its coordinates and
`America/Santiago`, and 10 kB of XML came back with Placidus houses and every
planet's position. Until then this whole section described an intention.

**What still needs a fallback.** Houses and the ascendant need an exact birth
time and many people do not know theirs. The existing path — numerology plus
stated context, with the chart absent — already covers it and does not become a
special case.

---

## 12. The store keeps its synchronous shape

**Decision.** The user's dataset is loaded once into a React context at session
start and held as a synchronous in-memory mirror. `read` in `src/store/db.ts`
keeps its signature and serves from the mirror; `write` updates the mirror and
persists to Postgres behind it.

**Why it needed deciding at all.** `docs/MIGRATION.md` promised that "call
sites do not move; implementations do". That promise is nearly true and quietly
depends on something: the call sites are synchronous *and in render bodies*.

```
src/screens/Dashboard.tsx:46
  const profile = activeProfile();
  const synthesis = currentSynthesis();
```

Neither is a hook, neither is in an effect, and a component cannot await in its
render body. Swapping `localStorage` for a network client is therefore not a
matter of propagating `await`. Twenty-eight files import from `@/store`.

**Rejected: an effect and a loading state per screen.** Twenty-eight files of
hand-rolled fetch-and-store. Phase 5 of the 001 plan already recorded a
stale-match defect that neither the type checker nor the test suite caught;
this approach is that defect class multiplied by the number of screens.

**Rejected for now: TanStack Query.** The conventional answer, and the right
one if this outgrows a mirror. It was not chosen because one user's dataset
here is genuinely small — a synthesis, some matches, some messages, some
meditations — and because adopting it means rewriting every read as a hook,
which is the churn `MIGRATION.md` was trying to avoid.

**The signal to change.** If the mirror starts needing invalidation rules,
adopt TanStack Query rather than growing a cache by hand. Two things will
produce that signal: a streaming chat, and a second device on the same account.
Neither exists yet; both are foreseeable.

**What it costs.** Multi-tab staleness, and a write path where the mirror and
Postgres can disagree. The second is the dangerous one: `write` currently
swallows failures on purpose, to degrade a demo rather than break it, and that
is the wrong behaviour for a dropped network write — the person believes their
data was saved. Write failures surface.

---

## 13. A closed pilot gets a door, and the door comes first

**Decision.** When a backend is configured, the application requires a Google
sign-in before onboarding, and only addresses on an allow-list can complete it.
Without a backend it asks for nothing, because there is nothing to protect.

**This reverses the placement half of §11's sibling decision** — the one taken
at the start of this migration, that identity is anonymous first and upgraded
to an email after the Soul Map. PDR section 3 puts the account after the map
for a good reason: before it, an account is a toll gate on a product the person
has not yet seen the value of.

That reason is about strangers. It does not apply to fifty people who were
invited by name. Nobody in this pilot needs to be convinced to finish
onboarding by being spared a login — they are here because they were asked.

**What actually forced it.** There was no way to restrict access at all. The
site is public — GitHub Pages serves files, and access control on Pages is an
Enterprise feature — and anonymous sign-in meant anyone who opened the link
became a user with a row in `auth.users`. Row Level Security keeps one person's
clinical answers away from another's; it says nothing about who is allowed to
become a person. For a prototype that asks about suicidal ideation, "whoever
finds the URL" is the wrong answer.

**Rejected: magic link with an allow-list table.** The obvious choice, and it
has a cost that only appears at the end. Supabase's built-in email service
refuses to deliver to anyone who is not a member of the project's team, at two
messages an hour — so reaching fifty people means contracting a mail provider,
verifying a domain, and adding a third service that can fail on the morning of
a demo. Google adds an afternoon in a console and then nothing.

**Rejected: a shared invite code.** Simplest of all, and it cannot say who
accessed what. This product holds mental-health answers; a code that can be
forwarded is not an access record.

**What it costs.** Test users on an unverified Google app see a warning screen
and their tokens expire weekly. Both go away with Google's verification
process, which is paperwork rather than code. And the allow-list lives in
Google Cloud rather than in this repository, so who can enter is no longer
visible in the source — a real loss in reviewability, accepted because the
alternative was a list nobody could enforce.

**If this reverses**, the surfaces are the route gate in `src/App.tsx` and the
provider block in `supabase/config.toml`. The anonymous path is not deleted: it
remains the only path when no backend is configured, which is what keeps the
fixture demo running offline.

---

## 14. The model moves to the server, and BYOK goes with the move

**Decision.** `runAi` chooses between two implementations: a signed-in person
on a configured deployment calls an Edge Function, and everyone else gets the
curated fixtures. All five purposes have a function. The pasted-key path is
deleted.

**BYOK survived exactly as long as it was the only way.** It existed because a
static demo had no other route to real generation, and while only `chat` had a
server it still was — deleting it then would have left four surfaces with
nothing but fixtures. Once all five had functions its cost stopped being paid
for: it kept a working Anthropic credential in `localStorage`, it was the one
path whose spend nobody could account for, it bypassed the server-side crisis
scan and the quota, and it forced the demo banner to explain a third state
that only a handful of people ever entered. `src/store/db.ts` clears the
stored key from browsers that already have one — removing the feature and
leaving the secret behind would have been the worse half of the change.

**Fixtures are not a failure state.** They are the offline demo, they are what
a deployment answering `no_model` is asking for, and they are what a visitor
who has not signed in gets. They are also the only thing that proves the
contracts hold without spending tokens, which is why §10 refused to delete
them and why that refusal outlived BYOK.

**`no_model` is the only failure that falls back.** Every other server error
throws. A fixture substituted for a broken server is a screen that looks like
it worked, and the whole point of §10 was that a real backend is now something
that can break visibly rather than something that cannot exist.

**No session, no server path.** The function derives the person from the JWT
and refuses without one. A 401 there is not a fault to surface — it is
somebody using the demo without signing in, which is a supported way to run
this application, so `runAi` checks for a session first and lands on the
fixtures rather than on an error the person cannot act on.

**Every prompt crosses the boundary, and two of them had to be untangled
first.** `soul-map.ts` reached into `@/store/session` for the draft type and
`meditation.ts` into `@/audio/ssml` for the prosody bounds. The first is fixed
by `soulMapDraftSchema`, which narrows the draft to what the prompt actually
reads — and, not incidentally, makes PDR 10.2 a shape rather than an
intention, since the narrowed object has nowhere to put `clinical_basics` and
`parse` strips it on the way out. The second is fixed by moving `ssml.ts` into
`src/lib`, where its own header had said it belonged since it was written. The
parity test fails if a copied prompt grows an import that cannot resolve.

**The catalogue is the server's, not the caller's.** `match` receives modality
slugs and rehydrates them from its own `data/modalities.json`; `meditation`
receives no bed list at all and offers the model its own. Sending the objects
would have worked and would have let a caller describe a therapy that does not
exist, or quietly edit the contraindications of one that does — which the
model then reads out as ours.

**Extensions are required rather than hoped for.** The Edge runtime refused to
boot on `from './shared'` — `sloppy-imports` in `deno.json` did not save it,
the type checker did not see it, and the test suite did not see it. Serving
the function did. The parity test now asserts the extension, because the next
person to add a prompt will write it the Vite way by reflex.

**The request body is split in two, and the split is the safety ordering.**
The envelope — message and country — is all that stands between a request and
`scanText`. The model context is parsed after safety and the quota have both
had their say. Validating the whole body up front, which is how this was first
written, meant a person in crisis with a half-built context got a 400 instead
of a hotline. `scripts/verify-chat-function.mjs` is what caught it.

**One handler, five deployables.** `_shared/serve-model.ts` holds the sequence
four of the functions share — authenticate, refuse to spend a token on
somebody in crisis, call, validate, log — because four hand-written copies of
that sequence is four chances to put the safety check in the wrong place. Each
purpose still has its own directory, URL and worker, which is what step 5.1
asked for. `chat` does not use it: it has a quota to consult between safety
and the model, and a crisis reply that is a product surface rather than a
refusal.

**What is still unverified.** The model call itself. No Anthropic key was
available while this was written, so every check above the model gate passed
against the local Edge runtime and the gate itself was exercised only in its
`no_model` form. The verify script covers the real call and says out loud that
it did not run; the first deployment with a key is where that gets closed.

**Model.** `claude-opus-5`, in the browser and on the server, from one
constant each kept deliberately identical. Somebody on their own key and
somebody on the deployment should be reading the same product.
