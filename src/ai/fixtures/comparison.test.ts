import { describe, expect, it } from 'vitest';
import { buildComparisonFixture } from './comparison';
import { buildComparisonPayload, type ComparisonScope, type ComparisonSource } from '@/lib/comparison-payload';
import { comparisonResultSchema, type Numerology } from '@/lib/schemas';
import { isInvitation, lintDeep } from '@/lib/copy-lint';

function numbers(values: [number, number, number, number, number]): Numerology {
  const [life_path, expression, soul_urge, personality, birthday] = values;
  return {
    life_path,
    expression,
    soul_urge,
    personality,
    birthday,
    master_numbers_present: values.filter((v) => [11, 22, 33].includes(v)),
    algorithm_version: 'pythagorean-v1',
  };
}

function source(
  name: string,
  values: [number, number, number, number, number],
  themes: string[],
): ComparisonSource {
  return {
    display_name: name,
    numerology: numbers(values),
    soul_map_themes: themes,
    chart: null,
    presenting_need_text: 'algo que no puede viajar',
  };
}

const FULL: ComparisonScope = { numerology: true, astro: true, soul_map_themes: true };

const CASES: [string, ComparisonSource, ComparisonSource, ComparisonScope][] = [
  [
    'identical numbers',
    source('Lucía', [7, 3, 11, 1, 4], ['vinculos']),
    source('Nico', [7, 3, 11, 1, 4], ['vinculos']),
    FULL,
  ],
  [
    'nothing in common',
    source('Lucía', [7, 3, 11, 1, 4], ['vinculos']),
    source('Nico', [2, 8, 5, 9, 6], ['trabajo']),
    FULL,
  ],
  [
    'a master against a plain number',
    source('Lucía', [33, 3, 11, 1, 4], ['duelo']),
    source('Nico', [4, 3, 5, 1, 9], ['duelo']),
    FULL,
  ],
  [
    'numbers withheld',
    source('Lucía', [7, 3, 11, 1, 4], ['vinculos']),
    source('Nico', [2, 8, 5, 9, 6], ['vinculos']),
    { numerology: false, astro: false, soul_map_themes: true },
  ],
  [
    'themes withheld',
    source('Lucía', [7, 3, 11, 1, 4], ['vinculos']),
    source('Nico', [2, 8, 5, 9, 6], ['trabajo']),
    { numerology: true, astro: false, soul_map_themes: false },
  ],
];

function build(a: ComparisonSource, b: ComparisonSource, scope: ComparisonScope) {
  return buildComparisonFixture(buildComparisonPayload({ a, b, scope }));
}

describe('every comparison satisfies the contract', () => {
  it.each(CASES)('%s parses against the schema', (_label, a, b, scope) => {
    expect(() => comparisonResultSchema.parse(build(a, b, scope))).not.toThrow();
  });

  it.each(CASES)('%s passes the copy lint', (_label, a, b, scope) => {
    expect(lintDeep(build(a, b, scope))).toEqual([]);
  });

  it.each(CASES)('%s ends in questions rather than conclusions', (_label, a, b, scope) => {
    // PDR 8.5 rule 4. The schema has nowhere to put a verdict; this is the
    // other half of the same rule.
    for (const question of build(a, b, scope).questions_to_explore) {
      expect(isInvitation(question)).toBe(true);
    }
  });
});

describe('the six rules of PDR 8.5', () => {
  const result = build(CASES[1]![1], CASES[1]![2], FULL);
  const everything = JSON.stringify(result);
  // The disclaimer's whole job is to name what this is not, so it is the one
  // place those phrases are allowed to appear — and scanning it flagged
  // "ni una opinión sobre si les conviene" as a verdict on the first run.
  const { disclaimer, ...body } = result;
  const claims = JSON.stringify(body);

  it('rule 1: never delivers a verdict on the relationship', () => {
    expect(claims).not.toMatch(/compatib|alma[s]? gemela|les conviene|van a durar|funciona bien/i);
    expect(result).not.toHaveProperty('verdict');
    expect(result).not.toHaveProperty('score');
    expect(disclaimer).toMatch(/no es una medici[oó]n|no una medici[oó]n/i);
  });

  it('rule 2: never pathologises the other person', () => {
    expect(everything).not.toMatch(/\b(evitativ|narcisist|t[oó]xic|inmadur|problema con)\w*/i);
  });

  it('rule 3: is symmetric — every reading names both, or neither', () => {
    // The person asking is the only one reading this. A sentence about one of
    // them alone is a weapon handed over in the voice of a mirror.
    for (const pair of result.numerology_dialogue.pairs) {
      expect(pair.reading).toMatch(/\b(los dos|las dos|cada una|ustedes|de un lado)\b/i);
    }
    for (const line of [...result.where_you_flow, ...result.where_you_friction]) {
      expect(line).toMatch(/\b(los dos|las dos|cada una|ustedes|comparten|ninguna)\b/i);
    }
  });

  it('rule 5: never invents chart positions', () => {
    // No chart is parsed anywhere in this demo, so the honest output is an
    // empty astro section — not an approximated one.
    expect(result.astro_dialogue.available).toBe(false);
    expect(result.astro_dialogue.aspects).toEqual([]);
    expect(result.astro_dialogue.summary).toMatch(/no hay carta/i);
  });

  it('carries neither subject’s private material', () => {
    expect(everything).not.toContain('algo que no puede viajar');
  });
});

describe('what the scope leaves out', () => {
  it('says the numbers section is empty on purpose', () => {
    const result = build(CASES[3]![1], CASES[3]![2], CASES[3]![3]);
    expect(result.numerology_dialogue.pairs).toEqual([]);
    expect(result.numerology_dialogue.summary).toMatch(/no hubo n[úu]meros consentidos/i);
  });

  it('still finds two things on each side with almost nothing to work with', () => {
    const result = build(CASES[3]![1], CASES[3]![2], {
      numerology: false,
      astro: false,
      soul_map_themes: false,
    });
    expect(result.where_you_flow.length).toBeGreaterThanOrEqual(2);
    expect(result.where_you_friction.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the reading follows the numbers', () => {
  it('notices when the two people share everything', () => {
    const result = build(CASES[0]![1], CASES[0]![2], FULL);
    expect(result.where_you_flow[0]).toMatch(/5 de los cinco|Comparten 5/);
    expect(result.where_you_friction[0]).toMatch(/parecido/);
  });

  it('notices when they share nothing', () => {
    const result = build(CASES[1]![1], CASES[1]![2], FULL);
    expect(result.where_you_flow[0]).toMatch(/ninguno de los cinco/);
  });

  it('is deterministic', () => {
    expect(build(CASES[2]![1], CASES[2]![2], FULL)).toEqual(build(CASES[2]![1], CASES[2]![2], FULL));
  });
});
