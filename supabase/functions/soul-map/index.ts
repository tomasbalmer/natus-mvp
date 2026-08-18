import { serveModel } from '../_shared/serve-model.ts';
import { soulMapInputSchema } from '../_shared/lib/model-input.ts';
import { soulMapSynthesisSchema } from '../_shared/lib/schemas/index.ts';
import {
  SOUL_MAP_PROMPT_VERSION,
  SOUL_MAP_SYSTEM_PROMPT,
  buildSoulMapUserMessage,
} from '../_shared/prompts/soul-map.ts';

/**
 * PDR 6.5, server-side.
 *
 * The output schema is the synthesis alone rather than the union with the
 * crisis shape. That is not an omission: `serveModel` scans the presenting
 * need before a token is spent, so a crisis reaches the refusal above rather
 * than the model, and asking the model to hold a branch it can never be
 * reached on is asking it to guess.
 *
 * Effort stays at the default. This is the one call that produces a document
 * somebody keeps, is made once for the life of an account, and is read more
 * carefully than anything else in the product.
 */
Deno.serve(
  serveModel({
    purpose: 'soul_map',
    promptVersion: SOUL_MAP_PROMPT_VERSION,
    input: soulMapInputSchema,
    output: soulMapSynthesisSchema,
    system: SOUL_MAP_SYSTEM_PROMPT,
    user: (input) => buildSoulMapUserMessage(input),
    prose: (input) => input.draft.presenting_need_text,
    effort: 'high',
  }),
);
