import { describe, expect, it } from 'vitest';
import { MAX_POOL, fallbackRanking, filterModalities, poolFraming } from './matching.ts';
import { ACTIVE_MODALITIES, modalityBySlug } from './catalog.ts';

/** Every slug, as the "me da lo mismo" case produces. */
const ANY = ['me_da_lo_mismo'];

describe('the three predicates of PDR 7.2', () => {
  it('restricts nothing when the person said it makes no difference', () => {
    const { candidates } = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(candidates.length).toBe(Math.min(ACTIVE_MODALITIES.length, MAX_POOL));
  });

  it('keeps only what the person is open to', () => {
    const { candidates } = filterModalities({
      openness: ['terapia-somatica', 'biodanza'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(candidates.map((m) => m.slug).sort()).toEqual(['biodanza', 'terapia-somatica']);
  });

  it('keeps only what shares a topic with what was inferred', () => {
    const { candidates } = filterModalities({
      openness: ANY,
      inferredTopics: ['duelo'],
      clinicallyVulnerable: false,
    });
    for (const m of candidates) {
      expect(m.works_well_for, m.slug).toContain('duelo');
    }
  });
});

describe('clinical vulnerability outranks preference', () => {
  it('removes every modality requiring clinical support', () => {
    const { candidates, excludedForVulnerability } = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: true,
    });

    expect(candidates.every((m) => !m.requires_clinical_support)).toBe(true);
    expect(excludedForVulnerability.length).toBeGreaterThan(0);
    expect(excludedForVulnerability).toContain('constelaciones-familiares');
    expect(excludedForVulnerability).toContain('medicina-ancestral');
  });

  it('removes them even when the person asked for exactly that', () => {
    // The whole point of the predicate: someone in a vulnerable moment asking
    // for constellations is the case it exists to catch.
    const { candidates, strategy } = filterModalities({
      openness: ['constelaciones-familiares'],
      inferredTopics: [],
      clinicallyVulnerable: true,
    });
    expect(candidates.map((m) => m.slug)).not.toContain('constelaciones-familiares');
    expect(strategy).toBe('contemplative-fallback');
  });
});

describe('edge case 1 — an empty pool', () => {
  it('retries without the topical predicate before giving up', () => {
    // A topic nothing claims. Openness is wide, so relaxing topics recovers.
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: ['un-tema-que-no-existe'],
      clinicallyVulnerable: false,
    });
    expect(outcome.strategy).toBe('relaxed');
    expect(outcome.candidates.length).toBeGreaterThan(0);
  });

  it('falls back to contemplative practices when even that is empty', () => {
    const outcome = filterModalities({
      openness: ['una-modalidad-inexistente'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(outcome.strategy).toBe('contemplative-fallback');
    expect(outcome.candidates.length).toBeGreaterThan(0);
    expect(outcome.candidates.every((m) => m.family === 'contemplativa')).toBe(true);
  });

  it('keeps the fallback safe for the person it just protected', () => {
    // Reaching the fallback often means the filter removed everything for
    // clinical reasons. Offering a removing modality there would undo it.
    const outcome = filterModalities({
      openness: ['constelaciones-familiares'],
      inferredTopics: [],
      clinicallyVulnerable: true,
    });
    expect(outcome.candidates.every((m) => !m.requires_clinical_support)).toBe(true);
    expect(outcome.candidates.every((m) => m.intensity <= 3)).toBe(true);
  });
});

describe('edge case 2 — a pool of one or two', () => {
  it('shows them as they are, without padding', () => {
    const outcome = filterModalities({
      openness: ['numerologia'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.strategy).toBe('topical');
  });

  it('frames a small pool honestly instead of overselling it', () => {
    const outcome = filterModalities({
      openness: ['numerologia'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(poolFraming(outcome)).toMatch(/pocas/i);
  });
});

describe('edge case 3 — a pool over twelve', () => {
  it('truncates to twelve', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(outcome.candidates).toHaveLength(MAX_POOL);
  });

  it('reports how many it dropped rather than truncating silently', () => {
    // PDR 7.2 states this in exactly those words.
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(outcome.droppedForSize).toBe(ACTIVE_MODALITIES.length - MAX_POOL);
    expect(outcome.poolBeforeTruncation).toBe(ACTIVE_MODALITIES.length);
  });

  it('cuts from the most confronting end, keeping the gentlest', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    const keptMax = Math.max(...outcome.candidates.map((m) => m.intensity));
    const droppedSlugs = ACTIVE_MODALITIES.filter(
      (m) => !outcome.candidates.some((c) => c.slug === m.slug),
    );
    const droppedMin = Math.min(...droppedSlugs.map((m) => m.intensity));
    expect(keptMax).toBeLessThanOrEqual(droppedMin);
  });

  it('is deterministic across runs', () => {
    const input = { openness: ANY, inferredTopics: [], clinicallyVulnerable: false } as const;
    expect(filterModalities(input).candidates.map((m) => m.slug)).toEqual(
      filterModalities(input).candidates.map((m) => m.slug),
    );
  });
});

describe('edge case 4 — the model fails', () => {
  it('ranks by topic overlap and builds reasoning from the catalogue', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: ['trauma', 'ansiedad'],
      clinicallyVulnerable: false,
    });
    const ranked = fallbackRanking(outcome, ['trauma', 'ansiedad']);

    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.overlap).toBeGreaterThanOrEqual(ranked[1]!.overlap);
    // Reasoning is assembled from the seed, never invented.
    const first = ranked[0]!;
    expect(first.reasoning).toContain(first.modality.short_description);
  });

  it('is deterministic when overlap ties', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: ['ansiedad'],
      clinicallyVulnerable: false,
    });
    expect(fallbackRanking(outcome, ['ansiedad']).map((r) => r.modality.slug)).toEqual(
      fallbackRanking(outcome, ['ansiedad']).map((r) => r.modality.slug),
    );
  });
});

describe('US-6.2 CA3 — a dismissed modality does not come back', () => {
  it('excludes it from a re-match', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: [],
      clinicallyVulnerable: false,
      dismissedSlugs: ['terapia-somatica'],
    });
    expect(outcome.candidates.map((m) => m.slug)).not.toContain('terapia-somatica');
    expect(outcome.excludedForDismissal).toContain('terapia-somatica');
  });

  it('does not let dismissals empty the pool without the fallback catching it', () => {
    const outcome = filterModalities({
      openness: ['numerologia'],
      inferredTopics: [],
      clinicallyVulnerable: false,
      dismissedSlugs: ['numerologia'],
    });
    expect(outcome.strategy).toBe('contemplative-fallback');
    expect(outcome.candidates.length).toBeGreaterThan(0);
  });
});

describe('what the person is told about their pool', () => {
  it('admits when it could not narrow things down', () => {
    const outcome = filterModalities({
      openness: ['inexistente'],
      inferredTopics: [],
      clinicallyVulnerable: false,
    });
    expect(poolFraming(outcome)).toMatch(/punto de partida/i);
  });

  it('never claims certainty about the ranking', () => {
    const outcome = filterModalities({
      openness: ANY,
      inferredTopics: ['ansiedad'],
      clinicallyVulnerable: false,
    });
    expect(poolFraming(outcome)).toMatch(/posibles/i);
  });
});

describe('the catalogue itself', () => {
  it('has a modality for the fallback to offer', () => {
    expect(modalityBySlug('mindfulness-meditacion')?.family).toBe('contemplativa');
  });
});
