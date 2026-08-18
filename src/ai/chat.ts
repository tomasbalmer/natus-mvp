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
  /** Chooses the crisis resource list if the server's Layer 1 fires. */
  country: string;
};

export async function askChat(input: ChatAsk): Promise<AiResult<ChatResponse>> {
  const history = input.history.slice(-HISTORY_TURNS);

  const result = await runAi({
    purpose: 'chat',
    promptVersion: CHAT_PROMPT_VERSION,
    system: CHAT_SYSTEM_PROMPT,
    user: buildChatUserMessage({ ...input, history }),
    schema: chatResponseSchema,
    // The server builds the prompt from its own copy of `prompts/chat.ts`,
    // so what crosses is the context and not the text. `risk` is a derived
    // level; PDR 10.2 keeps the answers it came from out of both payloads.
    edge: {
      fn: 'chat',
      body: {
        message: input.question,
        country: input.country,
        synthesis: input.synthesis,
        numerology: input.numerology,
        risk: input.risk,
        recommendedSlugs: [...input.recommendedSlugs],
        history: [...history],
      },
    },
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
