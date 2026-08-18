import { runAi, type AiResult } from './client';
import {
  MEDITATION_PROMPT_VERSION,
  MEDITATION_SYSTEM_PROMPT,
  buildMeditationUserMessage,
} from './prompts/meditation';
import { buildMeditationFixture } from './fixtures/meditation';
import { parseSsml, validateMeditation } from '@/lib/ssml';
import { AiError } from './client';
import { BED_TRACKS } from '@/lib/catalog';
import { meditationScriptSchema, type MeditationScript, type SoulMapSynthesis } from '@/lib/schemas';

const ACTIVE_BEDS = BED_TRACKS.filter((bed) => bed.is_active);

export async function generateMeditation(input: {
  intent: string;
  minutes: number;
  synthesis: SoulMapSynthesis | null;
  risk: 'none' | 'elevated' | 'high';
}): Promise<AiResult<MeditationScript>> {
  const result = await runAi({
    purpose: 'meditation',
    promptVersion: MEDITATION_PROMPT_VERSION,
    system: MEDITATION_SYSTEM_PROMPT,
    user: buildMeditationUserMessage({ ...input, beds: ACTIVE_BEDS }),
    schema: meditationScriptSchema,
    // The beds are absent on purpose: the function offers the model its own
    // catalogue, so a caller cannot name a track the player cannot load.
    edge: {
      fn: 'meditation',
      body: {
        intent: input.intent,
        minutes: input.minutes,
        synthesis: input.synthesis,
        risk: input.risk,
      },
    },
    fixture: () => buildMeditationFixture({ intent: input.intent, minutes: input.minutes }),
  });

  // The prosody band and the break lengths are prompt rules, so a model can
  // miss them. A script that speaks at 110% or leaves a twelve-second hole is
  // not a meditation, and finding that out at play time means finding it out
  // in front of whoever is listening.
  const problems = validateMeditation(parseSsml(result.value.script_ssml));
  if (problems.length > 0) {
    throw new AiError(
      `The script broke the PDR 9.4 rules: ${problems.map((p) => p.detail).join('; ')}`,
      'copy_violation',
    );
  }

  if (!ACTIVE_BEDS.some((bed) => bed.id === result.value.bed_track_id)) {
    throw new AiError(`The model chose a bed that does not exist: ${result.value.bed_track_id}`, 'invalid_json');
  }

  return result;
}
