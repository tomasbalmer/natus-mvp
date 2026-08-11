import { describe, expect, it } from 'vitest';
import { CURATED_REASONING_SLUGS, CURATED_ROUTINES, buildMatchFixture } from './match';
import { matchResultSchema } from '@/lib/schemas';
import { countSentences, isInvitation, lintDeep } from '@/lib/copy-lint';
import { filterModalities } from '@/lib/matching';
import { ACTIVE_MODALITIES, modalityBySlug } from '@/lib/catalog';
import { ALL_SOUL_MAP_FIXTURES } from './soul-map';

const ANY = ['me_da_lo_mismo'];
const synthesis = ALL_SOUL_MAP_FIXTURES[1]!;

function build(overrides: Partial<Parameters<typeof filterModalities>[0]> = {}) {
  const outcome = filterModalities({
    openness: ANY,
    inferredTopics: synthesis.inferred_topics,
    clinicallyVulnerable: false,
    ...overrides,
  });
  return { outcome, result: buildMatchFixture({ outcome, synthesis }) };
}

describe('the assembled match satisfies the contract', () => {
  it('parses against the schema', () => {
    expect(() => matchResultSchema.parse(build().result)).not.toThrow();
  });

  it('returns between three and five modalities', () => {
    const { result } = build();
    expect(result.matched_modalities.length).toBeGreaterThanOrEqual(3);
    expect(result.matched_modalities.length).toBeLessThanOrEqual(5);
  });

  it('ranks from one with no gaps', () => {
    const { result } = build();
    expect(result.matched_modalities.map((m) => m.rank)).toEqual(
      result.matched_modalities.map((_, i) => i + 1),
    );
  });

  it('only ever returns slugs from the pool the filter produced', () => {
    // PDR 7.3: no inventing modalities. Here that is structural, but the test
    // guards the day a curated reasoning is keyed to a slug that was removed.
    const { outcome, result } = build();
    const pool = new Set(outcome.candidates.map((m) => m.slug));
    for (const match of result.matched_modalities) {
      expect(pool, match.modality_slug).toContain(match.modality_slug);
    }
  });
});

describe('the copy rules apply to the fixture too', () => {
  it('passes the lint', () => {
    expect(lintDeep(build().result)).toEqual([]);
  });

  it('keeps every reasoning between two and four sentences', () => {
    // PDR 7.5, stated as "ni más ni menos".
    for (const slug of CURATED_REASONING_SLUGS) {
      const reasoning = buildMatchFixture({
        outcome: filterModalities({
          openness: [slug],
          inferredTopics: [],
          clinicallyVulnerable: false,
        }),
        synthesis,
      }).matched_modalities.find((m) => m.modality_slug === slug)?.reasoning;

      if (!reasoning) continue;
      const sentences = countSentences(reasoning);
      expect(sentences, `${slug}: ${sentences} sentences`).toBeGreaterThanOrEqual(2);
      expect(sentences, `${slug}: ${sentences} sentences`).toBeLessThanOrEqual(4);
    }
  });

  it('closes every routine practice on a question', () => {
    for (const practice of CURATED_ROUTINES) {
      expect(isInvitation(practice.invitation), practice.title).toBe(true);
    }
  });

  it('never shows a percentage anywhere', () => {
    // The mockup's "98% match" is the thing this product decided not to be.
    expect(JSON.stringify(build().result)).not.toMatch(/\d\s*%/);
  });
});

describe('clinical caution', () => {
  it('attaches a caution note to every modality that requires support', () => {
    // PDR 7.3: if it survives the filter and appears anyway, the note is
    // mandatory. Reached by asking only for the removing ones while not
    // vulnerable, which is a legitimate state.
    const removing = ACTIVE_MODALITIES.filter((m) => m.requires_clinical_support).map(
      (m) => m.slug,
    );
    const { result } = build({ openness: removing });

    for (const match of result.matched_modalities) {
      const modality = modalityBySlug(match.modality_slug);
      if (!modality?.requires_clinical_support) continue;
      expect(match.caution_note, match.modality_slug).toBeTruthy();
      expect(match.caution_note!.length).toBeGreaterThan(40);
    }
  });

  it('leaves the note null when none is warranted', () => {
    const { result } = build({ openness: ['mindfulness-meditacion', 'yoga-terapeutico', 'breathwork', 'sound-healing'] });
    expect(result.matched_modalities.every((m) => m.caution_note === null)).toBe(true);
  });

  it('never recommends a removing modality to a vulnerable person', () => {
    const { result } = build({ clinicallyVulnerable: true });
    for (const match of result.matched_modalities) {
      expect(modalityBySlug(match.modality_slug)?.requires_clinical_support, match.modality_slug).toBe(
        false,
      );
    }
  });
});

describe('coverage of the catalogue', () => {
  it('has a curated reasoning for every active modality', () => {
    // Without this, growing the catalogue silently degrades some users to the
    // catalogue-description fallback while others get written prose.
    const curated = new Set(CURATED_REASONING_SLUGS);
    for (const modality of ACTIVE_MODALITIES) {
      expect(curated, `no curated reasoning for "${modality.slug}"`).toContain(modality.slug);
    }
  });
});

describe('a small pool is shown as it is', () => {
  it('produces one card from a pool of one, without padding', () => {
    // PDR 7.2 edge case 2: "se muestran igual, sin rellenar con ruido". This
    // is the case that forced the schema's lower bound down from the 3 stated
    // in 7.4 — the two sections contradict each other and this one wins.
    const outcome = filterModalities({
      openness: ['numerologia'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    const result = buildMatchFixture({ outcome, synthesis });

    expect(outcome.candidates).toHaveLength(1);
    expect(result.matched_modalities).toHaveLength(1);
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it('produces two cards from a pool of two', () => {
    const outcome = filterModalities({
      openness: ['terapia-somatica', 'biodanza'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    const result = buildMatchFixture({ outcome, synthesis });

    expect(result.matched_modalities).toHaveLength(2);
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });
});

describe('different people get different recommendations', () => {
  it('a body-oriented opening and a symbolic one do not produce the same list', () => {
    const body = buildMatchFixture({
      outcome: filterModalities({
        openness: ['terapia-somatica', 'biodanza', 'yoga-terapeutico'],
        inferredTopics: [],
        clinicallyVulnerable: false,
      }),
      synthesis,
    });
    const symbolic = buildMatchFixture({
      outcome: filterModalities({
        openness: ['astrologia-psicologica', 'numerologia', 'tarot-terapeutico'],
        inferredTopics: [],
        clinicallyVulnerable: false,
      }),
      synthesis,
    });

    expect(body.matched_modalities.map((m) => m.modality_slug)).not.toEqual(
      symbolic.matched_modalities.map((m) => m.modality_slug),
    );
  });
});
