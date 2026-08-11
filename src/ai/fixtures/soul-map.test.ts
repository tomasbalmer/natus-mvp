import { describe, expect, it } from 'vitest';
import { ALL_SOUL_MAP_FIXTURES, CRISIS_FIXTURE, selectSoulMapFixture } from './soul-map';
import { soulMapCrisisSchema, soulMapSynthesisSchema } from '@/lib/schemas';
import { countSentences, isInvitation, lintDeep } from '@/lib/copy-lint';
import { emptyDraft } from '@/store/session';
import { TOPICS } from '@/lib/catalog';

/**
 * The fixtures are held to exactly what the prompt demands of the model. They
 * are the demo's voice, and a hand-written fixture is the easiest place for
 * the product's own rules to quietly stop applying.
 */

describe('every fixture satisfies the contract', () => {
  it.each(ALL_SOUL_MAP_FIXTURES.map((f) => [f.detected_phase, f] as const))(
    '%s parses against the schema',
    (_phase, fixture) => {
      expect(() => soulMapSynthesisSchema.parse(fixture)).not.toThrow();
    },
  );

  it('the crisis fixture parses, and has nowhere to put a tip', () => {
    expect(() => soulMapCrisisSchema.parse(CRISIS_FIXTURE)).not.toThrow();
    expect(CRISIS_FIXTURE).not.toHaveProperty('tips');
  });
});

describe('every fixture obeys the copy rules', () => {
  it.each(ALL_SOUL_MAP_FIXTURES.map((f) => [f.detected_phase, f] as const))(
    '%s passes the lint',
    (_phase, fixture) => {
      expect(lintDeep(fixture)).toEqual([]);
    },
  );

  it('the crisis response passes too, and offers no interpretation', () => {
    expect(lintDeep(CRISIS_FIXTURE)).toEqual([]);
  });

  it.each(ALL_SOUL_MAP_FIXTURES.map((f) => [f.detected_phase, f] as const))(
    '%s closes every tip on a question',
    (_phase, fixture) => {
      // PDR 1.5: recommendations are invitations. A tip that ends in a full
      // stop has become an instruction.
      for (const tip of fixture.tips) {
        expect(isInvitation(tip.invitation), `"${tip.invitation}"`).toBe(true);
      }
    },
  );

  it.each(ALL_SOUL_MAP_FIXTURES.map((f) => [f.detected_phase, f] as const))(
    '%s keeps the synthesis within its sentence budget',
    (_phase, fixture) => {
      // PDR 6.5: 3-5, 3-5, 2-4 sentences.
      const s = fixture.soul_map_synthesis;
      expect(countSentences(s.tu_camino)).toBeGreaterThanOrEqual(3);
      expect(countSentences(s.tu_camino)).toBeLessThanOrEqual(5);
      expect(countSentences(s.lo_que_estas_trabajando)).toBeGreaterThanOrEqual(3);
      expect(countSentences(s.lo_que_estas_trabajando)).toBeLessThanOrEqual(5);
      expect(countSentences(s.que_necesitas_ahora)).toBeGreaterThanOrEqual(2);
      expect(countSentences(s.que_necesitas_ahora)).toBeLessThanOrEqual(4);
    },
  );

  it.each(ALL_SOUL_MAP_FIXTURES.map((f) => [f.detected_phase, f] as const))(
    '%s only infers topics that exist',
    (_phase, fixture) => {
      const known = new Set(TOPICS.map((t) => t.slug));
      for (const topic of fixture.inferred_topics) {
        expect(known, `unknown topic "${topic}"`).toContain(topic);
      }
    },
  );
});

describe('selection', () => {
  const withNeed = (slug: string) => ({ ...emptyDraft(), presenting_need_slugs: [slug] });

  it('is deterministic — the same input gives the same map', () => {
    const draft = withNeed('repito-algo');
    expect(selectSoulMapFixture(draft)).toBe(selectSoulMapFixture(draft));
  });

  it('gives different people different maps', () => {
    // A demo where every answer is identical teaches the viewer that nothing
    // is being read.
    const a = selectSoulMapFixture(withNeed('repito-algo'));
    const b = selectSoulMapFixture(withNeed('perdida'));
    const c = selectSoulMapFixture(withNeed('para-que'));
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('reads the free text when no shortcut was chosen', () => {
    const draft = { ...emptyDraft(), presenting_need_text: 'mi mamá murió en marzo' };
    expect(selectSoulMapFixture(draft).detected_phase).toBe('integracion');
  });

  it('falls back rather than failing on an empty draft', () => {
    expect(selectSoulMapFixture(emptyDraft()).detected_phase).toBe('pregunta');
  });
});
