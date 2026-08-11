import type { Numerology } from './schemas';

/**
 * What is allowed to leave the browser when two charts are compared.
 *
 * This is the highest-risk payload in the product. Every other model call
 * carries one person's material; this one carries two, and the second person
 * consented to a comparison rather than to being described. PDR 8.3 is
 * explicit that the other person's presenting need and clinical answers are
 * never part of it — and the same has to hold for the requester, because a
 * comparison is read by both.
 *
 * So the payload is built from an allow-list rather than trimmed down from a
 * record. The difference matters: a deny-list has to be updated every time a
 * field is added upstream, and the failure mode of forgetting is that private
 * data ships. Here a new field on the source is invisible until someone comes
 * to this file and names it.
 *
 * `comparison-payload.test.ts` loads the sources with clinical material and
 * asserts it cannot be found in the serialised payload, under every scope.
 */

export type ChartPosition = {
  body: string;
  sign: string;
  house: number | null;
};

/**
 * The local record, as the caller holds it. Deliberately typed as an open
 * object: the point is that whatever else is in there does not travel.
 */
export type ComparisonSource = {
  display_name: string;
  numerology: Numerology | null;
  soul_map_themes: readonly string[];
  chart: { available: boolean; positions: readonly ChartPosition[] } | null;
  [extra: string]: unknown;
};

export type ComparisonScope = {
  numerology: boolean;
  astro: boolean;
  soul_map_themes: boolean;
};

export type ComparisonSubject = {
  display_name: string;
  numerology: Numerology | null;
  soul_map_themes: string[];
  chart: { available: boolean; positions: ChartPosition[] };
};

export type ComparisonPayload = {
  scope: ComparisonScope;
  a: ComparisonSubject;
  b: ComparisonSubject;
};

/** Every field of a source that may cross into a payload. Nothing else does. */
const ALLOWED = ['display_name', 'numerology', 'soul_map_themes', 'chart'] as const;

function subject(source: ComparisonSource, scope: ComparisonScope): ComparisonSubject {
  // Named one at a time, never spread. A spread here would be the bug.
  return {
    display_name: source.display_name,
    numerology: scope.numerology ? (source.numerology ?? null) : null,
    soul_map_themes: scope.soul_map_themes ? [...source.soul_map_themes] : [],
    chart:
      scope.astro && source.chart?.available
        ? {
            available: true,
            positions: source.chart.positions.map((p) => ({
              body: p.body,
              sign: p.sign,
              house: p.house,
            })),
          }
        : { available: false, positions: [] },
  };
}

export function buildComparisonPayload(input: {
  a: ComparisonSource;
  b: ComparisonSource;
  scope: ComparisonScope;
}): ComparisonPayload {
  return {
    scope: {
      numerology: input.scope.numerology,
      astro: input.scope.astro,
      soul_map_themes: input.scope.soul_map_themes,
    },
    a: subject(input.a, input.scope),
    b: subject(input.b, input.scope),
  };
}

/** The allow-list, exported so a test can assert it rather than restate it. */
export const ALLOWED_SUBJECT_FIELDS: readonly string[] = ALLOWED;

/** A scope that permits nothing is not a comparison; the caller should refuse
 *  rather than send an empty payload and let the model improvise. */
export function isScopeUsable(scope: ComparisonScope): boolean {
  return scope.numerology || scope.astro || scope.soul_map_themes;
}
