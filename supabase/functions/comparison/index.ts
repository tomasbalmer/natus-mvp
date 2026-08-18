import { serveModel } from '../_shared/serve-model.ts';
import { comparisonInputSchema } from '../_shared/lib/model-input.ts';
import { comparisonResultSchema } from '../_shared/lib/schemas/index.ts';
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
 * screens. Rule 5, which forbids inventing chart positions, is re-checked by
 * `src/ai/comparison.ts` over what this returns.
 */
Deno.serve(
  serveModel({
    purpose: 'comparison',
    promptVersion: COMPARISON_PROMPT_VERSION,
    input: comparisonInputSchema,
    output: comparisonResultSchema,
    system: COMPARISON_SYSTEM_PROMPT,
    user: (payload) => buildComparisonUserMessage(payload),
  }),
);
