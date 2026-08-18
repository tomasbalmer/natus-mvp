import { serveModel } from '../_shared/serve-model.ts';
import { matchInputSchema } from '../_shared/lib/model-input.ts';
import { matchResultSchema } from '../_shared/lib/schemas/index.ts';
import { modalityBySlug } from '../_shared/lib/catalog.ts';
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
 * `data/modalities.json`. The hard filter still runs in the browser — it
 * reads `clinical_basics`, and §7 keeps that out of anything the model sees,
 * so what crosses is the filter's *outcome* and never its input. But the
 * therapy descriptions the model reads out are ours, from our catalogue, not
 * whatever a caller chose to describe. `matchInputSchema` has already refused
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
