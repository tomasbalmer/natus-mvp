import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SUBJECT_FIELDS,
  buildComparisonPayload,
  inventedAspect,
  isScopeUsable,
  toComparisonBirth,
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
    birth: { year: 1990, month: 4, day: 12, hour: 14, minute: 30, city: 'Santiago', nation: 'CL' },
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

describe('birth data travels only under the astro scope', () => {
  it.each(SCOPES.map((scope) => [label(scope), scope] as const))('%s', (_label, scope) => {
    const payload = buildComparisonPayload({ a: source('A'), b: source('B'), scope });

    if (scope.astro) {
      expect(payload.a.birth).not.toBeNull();
      expect(payload.b.birth).not.toBeNull();
    } else {
      // A birthday is not clinical material, and it is still somebody else's.
      // The scope is what they consented to; a field that ignores it is a
      // field nobody agreed to send.
      expect(payload.a.birth).toBeNull();
      expect(payload.b.birth).toBeNull();
      expect(JSON.stringify(payload)).not.toContain('Santiago');
    }
  });

  it('never arrives carrying aspects', () => {
    // The ephemeris fills these, server-side. A payload built here that came
    // with any would be a caller choosing which placements the model reads
    // out as fact.
    const payload = buildComparisonPayload({
      a: source('A'),
      b: source('B'),
      scope: { numerology: true, astro: true, soul_map_themes: true },
    });
    expect(payload.aspects).toEqual([]);
  });
});

describe('what the ephemeris needs, and what it refuses', () => {
  const complete = {
    birth_date: '1990-04-12',
    birth_time: '14:30',
    birth_city: 'Santiago',
    birth_country: 'CL',
  };

  it('reads a complete birth place', () => {
    expect(toComparisonBirth(complete)).toEqual({
      year: 1990,
      month: 4,
      day: 12,
      hour: 14,
      minute: 30,
      city: 'Santiago',
      nation: 'CL',
    });
  });

  it.each([
    ['no time', { ...complete, birth_time: '' }],
    ['no city', { ...complete, birth_city: '' }],
    ['no country', { ...complete, birth_country: '' }],
    ['no date', { ...complete, birth_date: '' }],
    ['a country that is not a code', { ...complete, birth_country: 'Chile' }],
  ])('refuses with %s', (_why, input) => {
    // All or nothing. A date without a time gives a Moon that could be
    // anywhere in a twelve-degree band, and an aspect computed from it would
    // be stated as confidently as a real one.
    expect(toComparisonBirth(input)).toBeNull();
  });
});

describe('rule 5: an aspect the ephemeris did not compute', () => {
  const computed = [
    { a_body: 'Sun', b_body: 'Moon', type: 'conjunction', orb: 1.3 },
    { a_body: 'Venus', b_body: 'Mars', type: 'trine', orb: 4.2 },
  ];

  it('accepts an answer that stays inside the list', () => {
    expect(
      inventedAspect(
        [{ a_body: 'Sun', b_body: 'Moon', type: 'conjunction', reading: '...' }],
        computed,
      ),
    ).toBeNull();
  });

  it('accepts an empty answer', () => {
    expect(inventedAspect([], computed)).toBeNull();
  });

  it('tolerates casing and spacing the model chose', () => {
    expect(
      inventedAspect([{ a_body: 'sun', b_body: 'MOON', type: 'Conjunction ', reading: '.' }], computed),
    ).toBeNull();
  });

  it('catches a wholly invented pair', () => {
    const found = inventedAspect(
      [{ a_body: 'Saturn', b_body: 'Pluto', type: 'square', reading: '...' }],
      computed,
    );
    expect(found?.a_body).toBe('Saturn');
  });

  it('catches a real pair given the wrong aspect', () => {
    // The subtler failure, and the one a summary would carry: the planets are
    // right, so it reads as grounded, and the geometry is invented.
    const found = inventedAspect(
      [{ a_body: 'Venus', b_body: 'Mars', type: 'opposition', reading: '...' }],
      computed,
    );
    expect(found?.type).toBe('opposition');
  });

  it('catches the pair stated backwards', () => {
    // Synastry is directional: Sun-of-A to Moon-of-B is not the same reading
    // as Moon-of-A to Sun-of-B, and the ephemeris returns whichever it found.
    const found = inventedAspect(
      [{ a_body: 'Moon', b_body: 'Sun', type: 'conjunction', reading: '...' }],
      computed,
    );
    expect(found?.a_body).toBe('Moon');
  });

  it('rejects everything when nothing was computed', () => {
    const found = inventedAspect(
      [{ a_body: 'Sun', b_body: 'Moon', type: 'conjunction', reading: '...' }],
      [],
    );
    expect(found).not.toBeNull();
  });
});
