import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SUBJECT_FIELDS,
  buildComparisonPayload,
  isScopeUsable,
  type ComparisonScope,
  type ComparisonSource,
} from './comparison-payload.ts';
import type { Numerology } from './schemas/index.ts';

const NUMEROLOGY: Numerology = {
  life_path: 7,
  expression: 3,
  soul_urge: 11,
  personality: 1,
  birthday: 4,
  master_numbers_present: [11],
  algorithm_version: 'pythagorean-v1',
};

/**
 * Loaded with exactly the material that must not travel. These strings are
 * chosen to be unmistakable in a serialised payload: if any of them appears,
 * the test can say which field leaked.
 */
function source(name: string): ComparisonSource {
  return {
    display_name: name,
    numerology: NUMEROLOGY,
    soul_map_themes: ['vinculos', 'autoestima'],
    chart: {
      available: true,
      positions: [{ body: 'Luna', sign: 'Escorpio', house: 8 }],
    },
    // Everything below is in the local record and none of it may cross.
    presenting_need_text: `SECRETO_NEED_${name}`,
    clinical_basics: {
      ideation_6m: `SECRETO_IDEACION_${name}`,
      in_treatment: true,
      psychiatric_medication: true,
      notes: `SECRETO_NOTAS_${name}`,
    },
    email: `SECRETO_MAIL_${name}@ejemplo.cl`,
    crisis_events: [{ severity: 'high', matched: `SECRETO_CRISIS_${name}` }],
  };
}

const SCOPES: ComparisonScope[] = [false, true].flatMap((numerology) =>
  [false, true].flatMap((astro) =>
    [false, true].map((soul_map_themes) => ({ numerology, astro, soul_map_themes })),
  ),
);

const label = (scope: ComparisonScope) =>
  `num=${scope.numerology} astro=${scope.astro} temas=${scope.soul_map_themes}`;

describe('the payload cannot carry clinical material, under any scope', () => {
  it.each(SCOPES.map((scope) => [label(scope), scope] as const))('%s', (_label, scope) => {
    const serialised = JSON.stringify(
      buildComparisonPayload({ a: source('A'), b: source('B'), scope }),
    );

    // One assertion per field, so a failure names what leaked rather than just
    // saying the payload was wrong.
    expect(serialised).not.toContain('SECRETO_NEED');
    expect(serialised).not.toContain('SECRETO_IDEACION');
    expect(serialised).not.toContain('SECRETO_NOTAS');
    expect(serialised).not.toContain('SECRETO_MAIL');
    expect(serialised).not.toContain('SECRETO_CRISIS');
    expect(serialised).not.toContain('clinical_basics');
    expect(serialised).not.toContain('presenting_need_text');
  });

  it('holds for both subjects, not only the requester', () => {
    // The other person consented to a comparison, not to being described.
    const serialised = JSON.stringify(
      buildComparisonPayload({
        a: source('A'),
        b: source('B'),
        scope: { numerology: true, astro: true, soul_map_themes: true },
      }),
    );
    expect(serialised).not.toContain('_B');
    expect(serialised).toContain('"display_name":"B"');
  });

  it('carries no field the allow-list does not name', () => {
    const payload = buildComparisonPayload({
      a: source('A'),
      b: source('B'),
      scope: { numerology: true, astro: true, soul_map_themes: true },
    });
    expect(Object.keys(payload.a).sort()).toEqual([...ALLOWED_SUBJECT_FIELDS].sort());
    expect(Object.keys(payload.b).sort()).toEqual([...ALLOWED_SUBJECT_FIELDS].sort());
  });
});

describe('the scope decides what is included', () => {
  it('drops the numbers when numerology is not consented to', () => {
    const payload = buildComparisonPayload({
      a: source('A'),
      b: source('B'),
      scope: { numerology: false, astro: true, soul_map_themes: true },
    });
    expect(payload.a.numerology).toBeNull();
    expect(payload.b.numerology).toBeNull();
  });

  it('drops the chart when astro is not consented to', () => {
    const payload = buildComparisonPayload({
      a: source('A'),
      b: source('B'),
      scope: { numerology: true, astro: false, soul_map_themes: true },
    });
    expect(payload.a.chart).toEqual({ available: false, positions: [] });
  });

  it('drops the themes when they are not consented to', () => {
    const payload = buildComparisonPayload({
      a: source('A'),
      b: source('B'),
      scope: { numerology: true, astro: true, soul_map_themes: false },
    });
    expect(payload.a.soul_map_themes).toEqual([]);
  });

  it('reports an unavailable chart as unavailable rather than as empty positions', () => {
    // The prompt forbids inventing chart positions. Saying "available: false"
    // is what makes that rule followable rather than aspirational.
    const withoutChart: ComparisonSource = { ...source('A'), chart: null };
    const payload = buildComparisonPayload({
      a: withoutChart,
      b: source('B'),
      scope: { numerology: true, astro: true, soul_map_themes: true },
    });
    expect(payload.a.chart.available).toBe(false);
  });

  it('refuses a scope that permits nothing', () => {
    expect(isScopeUsable({ numerology: false, astro: false, soul_map_themes: false })).toBe(false);
    expect(isScopeUsable({ numerology: true, astro: false, soul_map_themes: false })).toBe(true);
  });
});

describe('the payload does not alias the caller data', () => {
  it('copies the arrays, so a later mutation cannot reach a sent payload', () => {
    const a = source('A');
    const payload = buildComparisonPayload({
      a,
      b: source('B'),
      scope: { numerology: true, astro: true, soul_map_themes: true },
    });
    expect(payload.a.soul_map_themes).not.toBe(a.soul_map_themes);
    expect(payload.a.chart.positions[0]).not.toBe(a.chart?.positions[0]);
  });
});
