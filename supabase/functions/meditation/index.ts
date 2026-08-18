import { serveModel } from '../_shared/serve-model.ts';
import { meditationInputSchema } from '../_shared/lib/model-input.ts';
import { meditationScriptSchema } from '../_shared/lib/schemas/index.ts';
import { BED_TRACKS } from '../_shared/lib/catalog.ts';
import {
  MEDITATION_PROMPT_VERSION,
  MEDITATION_SYSTEM_PROMPT,
  buildMeditationUserMessage,
} from '../_shared/prompts/meditation.ts';

/**
 * PDR 9, server-side.
 *
 * The bed catalogue comes from this side rather than the request. The model
 * must choose one of the tracks that actually exist, and a caller who could
 * name the options could name one that does not — which the player then fails
 * to load, in the middle of a meditation, out loud.
 *
 * The prosody band and the break lengths are checked by the caller, in
 * `src/ai/meditation.ts`, over the script this returns. They stay there
 * because they are checks on a rendered artefact rather than on the contract,
 * and `src/lib/ssml.ts` now crosses, so moving them here later costs nothing.
 */
const ACTIVE_BEDS = BED_TRACKS.filter((bed) => bed.is_active);

Deno.serve(
  serveModel({
    purpose: 'meditation',
    promptVersion: MEDITATION_PROMPT_VERSION,
    input: meditationInputSchema,
    output: meditationScriptSchema,
    system: MEDITATION_SYSTEM_PROMPT,
    user: (input) => buildMeditationUserMessage({ ...input, beds: ACTIVE_BEDS }),
    prose: (input) => input.intent,
  }),
);
