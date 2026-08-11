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
| Server-side Vision parsing of the chart PDF | Held, parsing stubbed | Needs a key; enabled in BYOK mode later |
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
