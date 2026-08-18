import { runAi, AiError, type AiResult } from './client';
import {
  COMPARISON_PROMPT_VERSION,
  COMPARISON_SYSTEM_PROMPT,
  buildComparisonUserMessage,
} from './prompts/comparison';
import { buildComparisonFixture } from './fixtures/comparison';
import { comparisonResultSchema, type ComparisonResult } from '@/lib/schemas';
import { isScopeUsable, type ComparisonPayload } from '@/lib/comparison-payload';

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

  // Rule 5, checked rather than trusted: a model that describes aspects for a
  // chart nobody uploaded has invented them, and the reader has no way to tell.
  const chartsPresent = payload.a.chart.available && payload.b.chart.available;
  if (!chartsPresent && (result.value.astro_dialogue.available || result.value.astro_dialogue.aspects.length > 0)) {
    throw new AiError('The model described chart positions that were never provided.', 'copy_violation');
  }

  return result;
}
