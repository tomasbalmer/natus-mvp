import { runAi, type AiResult } from './client';
import { SOUL_MAP_PROMPT_VERSION, SOUL_MAP_SYSTEM_PROMPT, buildSoulMapUserMessage } from './prompts/soul-map';
import { selectSoulMapFixture } from './fixtures/soul-map';
import { soulMapSynthesisSchema, type Numerology, type SoulMapSynthesis } from '@/lib/schemas';
import { soulMapDraftSchema } from '@/lib/model-input';
import type { OnboardingDraft } from '@/store/session';

/**
 * PDR 6.5, the generate-soul-map pipeline, minus the parts a browser cannot
 * do. Safety Layer 1 runs upstream in the onboarding flow, which is where the
 * PDR puts it — before a token is spent.
 */
export async function generateSoulMap(input: {
  draft: OnboardingDraft;
  numerology: Numerology | null;
}): Promise<AiResult<SoulMapSynthesis>> {
  return runAi({
    purpose: 'soul_map',
    promptVersion: SOUL_MAP_PROMPT_VERSION,
    system: SOUL_MAP_SYSTEM_PROMPT,
    user: buildSoulMapUserMessage(input),
    schema: soulMapSynthesisSchema,
    // Narrowed through the schema rather than forwarded. `OnboardingDraft`
    // carries `clinical_basics`; §7 says it never enters a model payload, and
    // `parse` strips it here rather than trusting every future caller to
    // remember. The prompt never read it either — see `soulMapDraftSchema`.
    edge: {
      fn: 'soul-map',
      body: { draft: soulMapDraftSchema.parse(input.draft), numerology: input.numerology },
    },
    fixture: () => selectSoulMapFixture(input.draft),
  });
}
