import { serveModel } from '../_shared/serve-model.ts';
import { matchInputSchema } from '../_shared/lib/model-input.ts';
import { matchResultSchema } from '../_shared/lib/schemas/index.ts';
import { modalityBySlug } from '../_shared/lib/catalog.ts';
import { callerIsClinicallyVulnerable, withoutClinicalExclusions } from './clinical.ts';
import type { Modality } from '../_shared/lib/schemas/index.ts';
import {
  MATCH_PROMPT_VERSION,
  MATCH_SYSTEM_PROMPT,
  buildMatchUserMessage,
} from '../_shared/prompts/match.ts';

/**
 * PDR 7.4, server-side.
 *
 * The pool arrives as slugs and is rehydrated here, from this side's copy of
 * `data/modalities.json`. The hard filter runs in the browser so the screen
 * can answer without a round trip, and **again here**, where it counts: the
 * clinical exclusion is re-applied from the person's stored answers before
 * the model sees the pool, and any answer naming a modality outside that pool
 * is rejected. See `clinical.ts`. What reaches the model is still the
 * filter's outcome, never `clinical_basics`. The therapy descriptions the
 * model reads out are ours, from our catalogue, not whatever a caller chose
 * to describe. `matchInputSchema` has already refused
 * any slug that does not resolve, so the map below cannot produce a hole.
 *
 * The pool-size guard and the deterministic fallback of PDR 7.2 edge case 4
 * stay in `src/ai/match.ts`. Both are decisions about what to show somebody
 * when the model under-delivers, and that is the caller's call to make.
 */
Deno.serve(
  serveModel({
    purpose: 'match',
    promptVersion: MATCH_PROMPT_VERSION,
    input: matchInputSchema,
    output: matchResultSchema,
    system: MATCH_SYSTEM_PROMPT,
    enrich: async (input, { caller, userId }) => {
      const vulnerable = await callerIsClinicallyVulnerable(caller, userId);
      const { kept, excluded } = withoutClinicalExclusions(input.candidateSlugs, vulnerable);
      // Reachable only if the browser sent a pool of nothing but excluded
      // modalities, which its own filter never produces. Refused rather than
      // sent to the model as an empty list to rank.
      if (kept.length === 0) throw new Error('clinical_exclusion_emptied_pool');
      return {
        ...input,
        candidateSlugs: kept,
        excludedForVulnerability: [...new Set([...input.excludedForVulnerability, ...excluded])],
      };
    },
    // The model ranks the pool it was given. An answer naming anything else —
    // an excluded modality included — is refused, not shown.
    check: (output, input) => {
      const pool = new Set(input.candidateSlugs);
      const stray = output.matched_modalities.find((m) => !pool.has(m.modality_slug));
      return stray ? `recommended ${stray.modality_slug}, which is not in the pool` : null;
    },
    user: (input) =>
      buildMatchUserMessage({
        synthesis: input.synthesis,
        presentingNeedText: input.presentingNeedText,
        outcome: {
          candidates: input.candidateSlugs.map((slug) => modalityBySlug(slug) as Modality),
          strategy: input.strategy,
          excludedForVulnerability: [...input.excludedForVulnerability],
          excludedForDismissal: [...input.excludedForDismissal],
          droppedForSize: input.droppedForSize,
          poolBeforeTruncation: input.poolBeforeTruncation,
        },
      }),
  }),
);
