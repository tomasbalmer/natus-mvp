import { serveModel } from '../_shared/serve-model.ts';
import { comparisonInputSchema } from '../_shared/lib/model-input.ts';
import { comparisonResultSchema } from '../_shared/lib/schemas/index.ts';
import { canComputeSynastry, inventedAspect } from '../_shared/lib/comparison-payload.ts';
import { resolveLocation, synastryAspects } from '../_shared/astrology.ts';
import {
  COMPARISON_PROMPT_VERSION,
  COMPARISON_SYSTEM_PROMPT,
  buildComparisonUserMessage,
} from '../_shared/prompts/comparison.ts';

/**
 * PDR 8.5, server-side.
 *
 * No `prose` hook, and that is deliberate rather than an oversight: nothing
 * in a comparison payload was typed by anyone. `buildComparisonPayload`'s
 * allow-list keeps free text out by construction — that is the whole reason
 * the file exists — so there is nothing here for the scan to read.
 *
 * Rule 6 of §8.5, which refuses the feature entirely while the requester is
 * in active crisis, is enforced by `ComparisonGate` in front of all three
 * screens.
 */

const TIMEOUT_MS = 25_000;

/**
 * The aspects, computed here and nowhere else.
 *
 * Two geocoding calls and one ephemeris call, all behind the deployment's
 * key. Every failure returns the payload unchanged with an empty aspect list,
 * which the prompt renders as "no hay dos cartas para cruzar" — the reading
 * still happens on numbers and themes. A comparison that errors because a
 * geocoder was slow would be worse than one that is quieter than it could be.
 */
async function withAspects<T extends Parameters<typeof canComputeSynastry>[0]>(
  payload: T,
): Promise<T> {
  if (!canComputeSynastry(payload) || !payload.a.birth || !payload.b.birth) return payload;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const [here, there] = await Promise.all([
      resolveLocation(payload.a.birth.city, payload.a.birth.nation, controller.signal),
      resolveLocation(payload.b.birth.city, payload.b.birth.nation, controller.signal),
    ]);
    if (!here || !there) return payload;

    const aspects = await synastryAspects(
      { ...payload.a.birth, ...here },
      { ...payload.b.birth, ...there },
      controller.signal,
    );
    return aspects ? { ...payload, aspects } : payload;
  } catch {
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(
  serveModel({
    purpose: 'comparison',
    // How many the ephemeris returned, alongside the token counts. Operational
    // metadata, no different in kind from those: it names a count, never a
    // placement. Without it a synastry that quietly computed nothing is
    // indistinguishable from two people who have no birth data, and the first
    // time that happened it took a deploy to find out which.
    meta: (payload) => ({ aspects_computed: payload.aspects.length }),
    promptVersion: COMPARISON_PROMPT_VERSION,
    input: comparisonInputSchema,
    output: comparisonResultSchema,
    system: COMPARISON_SYSTEM_PROMPT,
    user: (payload) => buildComparisonUserMessage(payload),
    enrich: withAspects,

    /**
     * Rule 5, with teeth. The predicate lives in `lib` so it has tests;
     * this is the wiring and the two boundary cases around it.
     *
     * Rejecting the whole answer rather than dropping the stray aspect,
     * because `summary` is written against the list the model believed it
     * had, and a summary describing an aspect that is no longer shown is a
     * quieter version of the same lie.
     */
    check: (result, payload) => {
      const dialogue = result.astro_dialogue;
      if (payload.aspects.length === 0) {
        return dialogue.available || dialogue.aspects.length > 0
          ? 'The model described chart aspects when the ephemeris returned none.'
          : null;
      }

      const invented = inventedAspect(dialogue.aspects, payload.aspects);
      return invented
        ? `The model invented an aspect the ephemeris did not return: ${invented.a_body} ${invented.type} ${invented.b_body}.`
        : null;
    },
  }),
);
