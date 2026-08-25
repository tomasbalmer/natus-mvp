# Isolating the design layer

**Live plan. One step left; delete this file when it is done** and fold what is
still true into `CLAUDE.md`.

## What now exists

```
src/design/
├── tokens.css      palette · glass · geometry · type scale · line-height
├── primitives.css  the named parts, and nothing else in the tree may write one
└── Screen.tsx      backdrop, scrim and photo opacity
```

`src/styles/index.css` keeps the Tailwind import, the `@theme` mapping and the
base layer. Those are wiring, not design.

**Sixty-four elements wore a glass surface in thirty-nine different strings.**
They are now nine families, and `src/architecture.test.ts` fails if a screen
writes a raw surface again — in any of the three spellings the drift used: the
`glass` classes, a `--glass-*` token in an arbitrary value, or `backdropFilter`
set inline. Each guard was broken on purpose and watched to fail before being
trusted.

The pass named what ships; it decided nothing. Four surface paddings, three
chip paddings and four text alphas are still four, three and four, named at
their values so collapsing one later is a deletion rather than a hunt. **Those
are the designer's calls, and `primitives.css` is where she can see them all at
once.**

It also found a third blur. `blur(16px)` was written inline on the
constellation nodes, outside both tokens and every inventory; it is
`--glass-blur-node` now.

## What is left

**Regenerate the designer's artifact** so it maps one-to-one onto
`src/design/`: every section in the page corresponding to a file she can be
pointed at. Publish to the **same URL**, passing it as `url`, or it becomes a
second artifact:

```
https://claude.ai/code/artifact/1e9cbf1d-c8c1-4f22-9cd0-160af7cbd71c
```

## How this repository verifies visual work

**Compare computed styles, not pixels.** Serve the old tree from a worktree at
`HEAD`, inject the new stylesheet into that same page, render every class
string both ways and diff `getComputedStyle`. Two thousand and ninety-seven
values were compared this way and one real defect fell out that no amount of
reading would have caught: `.option-glass` was declared *above* `.option`, so
at equal specificity the transparent border won and the unselected onboarding
row silently lost its edge.

**Capture the control.** Measure the unchanged thing twice before trusting any
diff. Pixel-diffing was abandoned for exactly this reason — `backdrop-filter`
over a photograph does not repaint deterministically, and the crisis screen
once differed from *itself* by 26,804 pixels. Computed styles came back
identical twice, which is what makes a difference mean something.

**Fetch injected CSS as `.txt`.** Vite's dev server puts a `.css` request
through its own pipeline and the fetch hangs the renderer.

**Then still open it.** The contrast test (`src/styles/contrast.test.ts`) reads
`.tsx` and fails on any text alpha below 0.55 — which is why the alpha ramp
deliberately stays in the screens rather than moving into `primitives.css`.

## Rules of engagement

**Name what exists; do not decide what it should be.** `title` carries four
sizes and `heading` seven because that is what ships. Collapsing them is a
design decision and it belongs to the designer.

**Do not touch the prompts.** Reconstructed from a source document that was
never available. `src/ai/prompts/shared.ts`.

**Do not reorganise into `features/`.** Measured against `waterplan-frontend`,
fifty times this size: it introduced `features/` after five years and six
months later the old `components/` still holds 3,297 files. At 13k lines that
migration is cost without the problem.

**Do not migrate `_shared`.** 2,949 duplicated lines, guarded by a byte-level
parity test, so correctness is already bought. The workspace-package fix may
not even work with Supabase's bundler and can only be proven by deploying.

## Still open, and owned by Tomás

Unchanged by this work, listed so a fresh session does not rediscover them.

- The sixteen crisis numbers still need telephone verification. Launch blocker.
- Eight of them are short codes, undiallable from abroad, and nothing in the
  data records that.
- `REQUIRE_INVITE=false`. Closing it needs a Google Cloud OAuth client.
- **Confirm the delete fix in production**: sign in with Google, delete
  everything, reload, and check the Soul Map does not come back.
- The prompt-cache question is answerable for free by reading
  `cache_read_tokens` from `claude_api_calls`, grouped by `purpose`.
- **There is no logo.** `public/favicon.svg` says so in its own source, and the
  four raster icons are the same drawing. It is the largest open asset question
  the product has.
