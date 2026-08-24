# Isolating the design layer

**Live plan. Delete this file when the four steps below are done** and fold
whatever is still true into `CLAUDE.md`. It exists because a designer is
joining and needs one place to work in; it is not a record.

## Why

A designer is about to review the product and propose changes. For that to be
possible she needs three things, and today only the first exists.

| | State |
|---|---|
| One place where changing a value changes the app | **Mostly there.** `src/styles/tokens.css` holds colour, type size, heading line-height, glass, geometry |
| A vocabulary of visual parts she can name | **Missing.** The repeated surfaces have no names, only repeated class strings |
| A boundary that keeps her changes out of the logic | **Missing.** Nothing separates a visual decision from a structural one |

The inventory of what the design *is* was already done and published as an
artifact — palette, the full type scale with live specimens, the photography
treatment, the glyphs, the constraints, and screenshots of fourteen screens.
That document is accurate and should be regenerated after step 4, because its
structure will no longer match the repository's.

## What is already done — do not redo it

- **Type sizes are tokenised.** 36 tokens over 9 roles, 24 distinct sizes,
  100% adoption. `text-[13px]` and `text-sm` both fail a test now.
- **Heading line-height is tokenised.** Four `--lh-heading-*`, named at their
  values.
- **Photo opacity is named** in `src/components/Screen.tsx` as `PHOTO.*`.
- **Spacing was measured and deliberately left alone.** 497 uses, 20 distinct
  values, and they are Tailwind's own 4px scale used consistently — only two
  arbitrary values in the whole tree. It is not drift and tokenising it would
  be churn. Do not "fix" it.
- **Layout utilities are not design.** `flex`, `grid`, `items-*`, `absolute`,
  `z-*` — 316 uses — belong to whoever builds the screen, not to the designer.
  Leave them in the screens.

## The finding this plan acts on

Ninety-nine elements carry a glass surface, in **41 distinct class
combinations**. One of them has a name:

```
  ×35   .cta                    one class, one definition, zero drift
  ──────────────────────────────────────────────────────────────────
  ×14   glass px-4 rounded-[var(--radius-option)]
        …at py-3 (×4), py-3.5 (×7) and py-4 (×3)
  ×17   glass-chip …rounded-full text-label-11 …uppercase
        …at px-3 py-2.5, px-3 py-2, px-3.5 py-2, crema/55, /60, /75
  ×3    glass-chip px-2.5 py-1 text-label-10 crema/70
  ×2    glass …px-4 py-3 text-body-14  (a textarea)
  ×2    glass rounded-full size-14     (a circular frame)
```

**The part with a name did not drift. Every part without one did.** That is
the whole argument for this plan: the card exists at three paddings and the
secondary button at four variants, and nobody decided either — there was no
name to compare a new one against.

It is also why a designer cannot work today. "Change the secondary button" has
no referent; there are seventeen similar strings across eleven files.

### Where they are

| Component | Uses | Files |
|---|---|---|
| Surface (card) | 14 | `Account.tsx:106,142,166` · `Library.tsx:58` · `SoulMap.tsx:44,126` · `SafetyLab.tsx:32,39` · `Result.tsx:202` · `Paywall.tsx:27` · `Meditation.tsx:238` · `Routine.tsx:71` |
| Secondary button | 17 | `Paywall.tsx:49` · `Meditation.tsx:179,294` · `Recommendations.tsx:188` · `Consent.tsx:161,206,217` · `Signup.tsx:188` · `SoulMap.tsx:170` · `Result.tsx:257` · `Library.tsx:92,101,108` · `ExternalProfile.tsx:111,124,131` |
| Badge | 3 | `ModalityCard.tsx:74,77,80` |
| Field (textarea) | 2 | `SafetyLab.tsx:95` · `ClinicalBasics.tsx:155` |
| Circle | 2 | `Recommendations.tsx:124` · `Result.tsx:139` |
| Resource row (link) | 2 | `CrisisResourceList.tsx:22,38` |

Regenerate this table rather than trusting it — line numbers move.

## The plan

### Step 1 — Name the components that exist

Extract the families above into real components under `src/design/components/`,
or classes in the primitives stylesheet where a class is enough. `.cta` is the
model: one definition, applied by name.

**This step changes pixels, in exactly the places where two decisions are
currently pretending to be one.** The card is at three paddings and the
secondary button at four variants; naming them forces one. Do not choose
silently — collect the variants, show them, and let the owner pick. Everything
else in this step must be pixel-identical.

### Step 2 — Move the design layer behind one door

```
src/design/
├── tokens.css        from src/styles/tokens.css
├── primitives.css    .glass .glass-chip .cta .eyebrow, from src/styles/index.css
└── components/       Surface · Button · Badge · Field · Circle · Screen
```

`src/styles/index.css` keeps the Tailwind import, the `@theme` mapping and the
base layer — those are wiring, not design. `Screen.tsx` moves: backdrop, scrim
and opacity are design decisions wearing a layout component's clothes.

Update `src/architecture.test.ts` — the layer table there needs `design` at a
level below `components`.

### Step 3 — Close the boundary

Add to `src/architecture.test.ts`: a screen may not write a raw surface. No
`glass` or `glass-chip` outside `src/design/`. The three erosion guards already
in that file are the pattern to copy.

**Prove it fails before trusting it.** Every rule in this repository was
verified by breaking it on purpose first; a guard nobody has seen fail is a
guard nobody has checked.

### Step 4 — Regenerate the designer's artifact

The generator was a throwaway script and is gone. Rebuild it reading from
`src/design/` so the document maps one-to-one onto a directory: every section
in the page corresponds to a file she can be pointed at. Publish to the
**same URL** so the link already shared keeps working:

```
https://claude.ai/code/artifact/1e9cbf1d-c8c1-4f22-9cd0-160af7cbd71c
```

Pass that URL as `url` when publishing, or it becomes a second artifact.

## How this repository verifies things

Not optional, and not generic advice — every one of these caught something
real during the work that produced this file.

**Pixel-diff before and after.** Start the dev server with no backend so the
fixture path renders (`mv .env.local /tmp/parked`), capture the screens a
change touches, apply the change, capture again, and compare with PIL. A
refactor that claims to change nothing must prove it.

**Run the control.** The crisis screen once differed by 26,804 pixels between
before and after — and by exactly the same 26,804 between two captures of the
*unchanged* page. `backdrop-filter` over a photograph does not repaint
deterministically. Capture the same state twice before concluding anything
from a diff.

**Verify in a browser, not by reasoning.** There is no testing-library here, so
component behaviour is checked by walking it. `browser_evaluate` is blocked;
use screenshots and the accessibility snapshot.

**The contrast test will catch you.** `src/styles/contrast.test.ts` scans every
component and fails on text below 0.55 alpha. It is right; raise the alpha
rather than exempting the file.

**Run `pnpm sync:shared` after touching `src/lib` or `src/ai/prompts`**, or the
parity test fails. Nothing in this plan should touch either.

## Rules of engagement

**Name what exists; do not decide what it should be.** This is the principle
the whole token pass was built on. `title` carries four sizes and `heading`
seven because that is what ships — collapsing them is a design decision and it
belongs to the designer, not to whoever is refactoring. The one exception is
step 1, where naming a component *forces* a choice; there, surface the options
and ask.

**Do not touch the prompts.** Reconstructed from a source document that was
never available, and the design is somebody's work. `src/ai/prompts/shared.ts`.

**Do not reorganise into `features/`.** Measured against
`waterplan-frontend`, which is fifty times this size: it introduced `features/`
after five years, and six months later the old `components/` still holds 3,297
files and is still changing. At 13k lines that migration is cost without the
problem.

**Do not migrate `_shared`.** 3,869 duplicated lines, guarded by a byte-level
parity test, so correctness is already bought. The workspace-package fix may
not even work with Supabase's bundler and can only be proven by deploying.
Recommended: leave it until it actually hurts.

## Still open, and owned by Tomás

Unchanged by this plan, listed so a fresh session does not rediscover them.

- The sixteen crisis numbers still need telephone verification. Launch blocker.
- Eight of them are short codes, undiallable from abroad, and nothing in the
  data records that.
- `REQUIRE_INVITE=false`. Closing it needs a Google Cloud OAuth client.
- **Confirm the delete fix in production**: sign in with Google, delete
  everything, reload, and check the Soul Map does not come back. That path
  could not be tested locally — the local stack cannot do Google OAuth.
- The prompt-cache question is answerable for free by reading
  `cache_read_tokens` from `claude_api_calls`, grouped by `purpose`. Needs
  `SUPABASE_ACCESS_TOKEN` in the environment, which it is not.
