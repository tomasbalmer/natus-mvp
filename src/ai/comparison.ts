import { runAi, AiError, type AiResult } from './client';
import {
  COMPARISON_PROMPT_VERSION,
  COMPARISON_SYSTEM_PROMPT,
  buildComparisonUserMessage,
} from './prompts/comparison';
import { buildComparisonFixture } from './fixtures/comparison';
import { comparisonResultSchema, type ComparisonResult } from '@/lib/schemas';
import { canComputeSynastry, isScopeUsable, type ComparisonPayload } from '@/lib/comparison-payload';

export async function compareCharts(payload: ComparisonPayload): Promise<AiResult<ComparisonResult>> {
  if (!isScopeUsable(payload.scope)) {
    // Sending an empty payload would leave the model with nothing to read and
    // every incentive to improvise, which is the one thing rule 5 forbids.
    throw new AiError('Nothing was consented to, so there is nothing to compare.', 'api_error');
  }

  const result = await runAi({
    purpose: 'comparison',
    promptVersion: COMPARISON_PROMPT_VERSION,
    system: COMPARISON_SYSTEM_PROMPT,
    user: buildComparisonUserMessage(payload),
    schema: comparisonResultSchema,
    // The payload crosses as it was built. `buildComparisonPayload` decided
    // what may leave this browser; `comparisonInputSchema` decides again on
    // arrival what the deployment's key will pay to read.
    edge: { fn: 'comparison', body: { ...payload } },
    fixture: () => buildComparisonFixture(payload),
  });

  // Rule 5, from this side.
  //
  // The Edge Function checks the strong version — every aspect the model
  // returned has to match one the ephemeris actually computed — because it is
  // the only place that holds the ephemeris list. This is the half the caller
  // can still check: aspects may exist only when the server could have
  // computed them, which means the scope allowed it, both birth places were
  // complete, and the answer came from the server rather than a fixture.
  //
  // A fixture that grew an aspect would be a hand-written placement presented
  // as a reading of two real charts, which is the same lie with a different
  // author.
  const couldHaveAspects = result.mode === 'server' && canComputeSynastry(payload);
  const dialogue = result.value.astro_dialogue;
  if (!couldHaveAspects && (dialogue.available || dialogue.aspects.length > 0)) {
    throw new AiError('The model described chart aspects that were never computed.', 'copy_violation');
  }

  return result;
}
