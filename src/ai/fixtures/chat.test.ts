import { describe, expect, it } from 'vitest';
import { buildChatFixture, detectIntent } from './chat';
import { ALL_SOUL_MAP_FIXTURES } from './soul-map';
import { chatResponseSchema } from '@/lib/schemas';
import { countSentences, lintDeep } from '@/lib/copy-lint';
import { ACTIVE_MODALITIES } from '@/lib/catalog';

/**
 * The chat fixtures are the demo's conversational voice. They are held to
 * exactly what `prompts/chat.ts` demands of the model — the same schema, the
 * same lint, the same two-to-six sentence budget — because a fixture is where
 * those rules are most likely to lapse without anyone noticing.
 */

const SYNTHESIS = ALL_SOUL_MAP_FIXTURES[0]!;
const SLUGS = ACTIVE_MODALITIES.slice(0, 3).map((m) => m.slug);

const QUESTIONS = [
  '¿por qué?',
  'no se',
  '¿por que siempre elijo lo mismo cuando alguien se acerca de verdad?',
  'me pasa que cuando discutimos me quedo muda y despues me como la cabeza toda la noche',
  '¿que hago con esto?',
  '¿me sirve la terapia para esto?',
];

function build(question: string, turnIndex = 0, slugs: readonly string[] = SLUGS) {
  return buildChatFixture({ question, synthesis: SYNTHESIS, recommendedSlugs: slugs, turnIndex });
}

describe('every chat fixture satisfies the contract', () => {
  it.each(QUESTIONS)('"%s" parses against the schema', (question) => {
    expect(() => chatResponseSchema.parse(build(question))).not.toThrow();
  });

  it.each(QUESTIONS)('"%s" passes the copy lint', (question) => {
    expect(lintDeep(build(question))).toEqual([]);
  });

  it.each(QUESTIONS)('"%s" stays inside the 2-6 sentence budget', (question) => {
    const sentences = countSentences(build(question).message_text);
    expect(sentences).toBeGreaterThanOrEqual(2);
    expect(sentences).toBeLessThanOrEqual(6);
  });
});

describe('what the fixture decides to do', () => {
  it('asks rather than interprets when there is nothing to work with', () => {
    expect(detectIntent('no se')).toBe('clarify');
    expect(build('no se').type).toBe('clarifying_question');
  });

  it('does not mistake a short question for an empty one', () => {
    // Length alone would have made this a clarifying question, and it is
    // perfectly answerable.
    expect(detectIntent('¿por que siempre elijo lo mismo cuando me acercan?')).toBe('reflect');
  });

  it('points at a path when the person asks for one', () => {
    const response = build('¿que hago con esto?');
    expect(response.type).toBe('recommendation');
    expect(response.linked_modality_slugs).toHaveLength(1);
  });

  it('reflects by default', () => {
    expect(build(QUESTIONS[3]!).type).toBe('reflection');
  });
});

describe('the linked slugs are never invented', () => {
  it.each(QUESTIONS)('"%s" links only modalities the person already has', (question) => {
    for (const slug of build(question).linked_modality_slugs) {
      expect(SLUGS).toContain(slug);
    }
  });

  it('says so honestly when there are no recommendations yet', () => {
    const response = build('¿que hago con esto?', 0, []);
    expect(response.linked_modality_slugs).toEqual([]);
    expect(response.type).not.toBe('recommendation');
  });
});

describe('the demo does not repeat itself', () => {
  it('gives a different answer at a later turn', () => {
    const first = build(QUESTIONS[3]!, 0);
    const second = build(QUESTIONS[3]!, 1);
    expect(second.message_text).not.toBe(first.message_text);
  });

  it('is deterministic — the same question at the same turn gives the same answer', () => {
    expect(build(QUESTIONS[3]!, 2)).toEqual(build(QUESTIONS[3]!, 2));
  });
});

describe('crisis never comes from here', () => {
  it.each(QUESTIONS)('"%s" is not typed as crisis', (question) => {
    // Layer 1 runs in front of the model, deterministically. A fixture
    // producing containment would mean the safety decision had moved into
    // curated text, which is exactly what `lib/safety` exists to prevent.
    expect(build(question).type).not.toBe('crisis');
  });
});
