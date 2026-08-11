import { runAi, type AiResult } from './client';
import {
  CHAT_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT,
  buildChatUserMessage,
  type ChatTurn,
} from './prompts/chat';
import { buildChatFixture } from './fixtures/chat';
import { chatResponseSchema, type ChatResponse, type Numerology, type SoulMapSynthesis } from '@/lib/schemas';

/** How much of the conversation goes back in. Enough to stay coherent, little
 *  enough that a long session does not quietly grow the bill on a viewer's
 *  own key. */
const HISTORY_TURNS = 8;

export type ChatAsk = {
  question: string;
  synthesis: SoulMapSynthesis;
  numerology: Numerology | null;
  risk: 'none' | 'elevated' | 'high';
  recommendedSlugs: readonly string[];
  history: readonly ChatTurn[];
};

export async function askChat(input: ChatAsk): Promise<AiResult<ChatResponse>> {
  const history = input.history.slice(-HISTORY_TURNS);

  const result = await runAi({
    purpose: 'chat',
    promptVersion: CHAT_PROMPT_VERSION,
    system: CHAT_SYSTEM_PROMPT,
    user: buildChatUserMessage({ ...input, history }),
    schema: chatResponseSchema,
    fixture: () =>
      buildChatFixture({
        question: input.question,
        synthesis: input.synthesis,
        recommendedSlugs: input.recommendedSlugs,
        turnIndex: history.filter((t) => t.role === 'user').length,
      }),
  });

  // The prompt allows slugs only from the list the person already has. A model
  // inventing one would put a therapy on screen that no filter ever cleared,
  // which is the whole point of the hard filter running in the client.
  const allowed = new Set(input.recommendedSlugs);
  return {
    ...result,
    value: {
      ...result.value,
      linked_modality_slugs: result.value.linked_modality_slugs.filter((slug) => allowed.has(slug)),
    },
  };
}
