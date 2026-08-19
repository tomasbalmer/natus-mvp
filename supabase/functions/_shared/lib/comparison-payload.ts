import type { Numerology } from './schemas/index.ts';

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
 * What the ephemeris needs to compute the aspects between two charts, and
 * nothing more.
 *
 * It travels only under `scope.astro`, and it travels to the Edge Function —
 * never to the model. `buildComparisonUserMessage` does not read this field,
 * and a test asserts the rendered prompt contains neither birth date. The
 * model is given the aspects that come back; it has no use for the birthdays
 * that produced them, and every identifier that does not need to move is one
 * that should not.
 *
 * `name` is a label rather than an identity for the same reason: Astrologer
 * puts it on the chart and does nothing else with it, so the function sends
 * "A" and "B" and the two people's legal names stay in the deployment.
 */
export type ComparisonBirth = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  city: string;
  /** ISO 3166-1 alpha-2. Without it the geocoding step has nothing to resolve. */
  nation: string;
};

/**
 * One aspect between the two charts, as the ephemeris computed it.
 *
 * Named to match `astro_dialogue.aspects` in the result schema, so rule 5 is
 * checked by comparing two lists of the same shape rather than by mapping one
 * onto the other and hoping the mapping is right.
 *
 * There is no score here and there will not be. `/chart-data/synastry` can
 * return a Ciro Discepolo compatibility number and the request that fetches
 * these asks it not to — `DECISIONS.md` §7 forbids match percentages, and §11
 * wrote the warning down because the wrong endpoint is the better-named one.
 */
export type SynastryAspect = {
  a_body: string;
  b_body: string;
  type: string;
  /** Degrees of separation from exact. Renders as "orbe", never as a score. */
  orb: number;
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
  birth: ComparisonBirth | null;
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
  /** Null unless `scope.astro`. Read by the Edge Function, never by a prompt. */
  birth: ComparisonBirth | null;
};

export type ComparisonPayload = {
  scope: ComparisonScope;
  a: ComparisonSubject;
  b: ComparisonSubject;
  /**
   * Empty leaving the browser and filled by the Edge Function from the
   * ephemeris. It is not a field a caller supplies: an aspect list that
   * arrived with the request would be a caller telling the model which
   * placements to read out, which is rule 5 broken from the outside rather
   * than by the model.
   */
  aspects: SynastryAspect[];
};

/** Every field of a source that may cross into a payload. Nothing else does. */
const ALLOWED = ['display_name', 'numerology', 'soul_map_themes', 'chart', 'birth'] as const;

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
    // Gated on the scope alone, like everything else here. A source that
    // carries birth data under a scope that did not ask for it is the case
    // this file exists to make impossible.
    birth: scope.astro && source.birth ? { ...source.birth } : null,
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
    aspects: [],
  };
}

/**
 * Birth data out of the four strings a form collects, or null.
 *
 * All-or-nothing on purpose. A date without a time gives a Moon that could be
 * anywhere in a twelve-degree band, and an aspect computed from it would be
 * stated with the same confidence as a real one. Refusing is the honest
 * failure; the comparison has two other things to read.
 */
export function toComparisonBirth(input: {
  birth_date: string;
  birth_time: string;
  birth_city: string;
  birth_country: string;
}): ComparisonBirth | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birth_date.trim());
  const time = /^(\d{2}):(\d{2})$/.exec(input.birth_time.trim());
  const city = input.birth_city.trim();
  const nation = input.birth_country.trim().toUpperCase();

  if (!date || !time || !city || !/^[A-Z]{2}$/.test(nation)) return null;

  return {
    year: Number(date[1]),
    month: Number(date[2]),
    day: Number(date[3]),
    hour: Number(time[1]),
    minute: Number(time[2]),
    city,
    nation,
  };
}

/** Whether the ephemeris has enough to compute anything between these two. */
export function canComputeSynastry(payload: ComparisonPayload): boolean {
  return payload.scope.astro && payload.a.birth !== null && payload.b.birth !== null;
}

/** The allow-list, exported so a test can assert it rather than restate it. */
export const ALLOWED_SUBJECT_FIELDS: readonly string[] = ALLOWED;

/** A scope that permits nothing is not a comparison; the caller should refuse
 *  rather than send an empty payload and let the model improvise. */
export function isScopeUsable(scope: ComparisonScope): boolean {
  return scope.numerology || scope.astro || scope.soul_map_themes;
}

/**
 * Rule 5 of PDR 8.5, as a predicate.
 *
 * The old check asked only whether *any* aspect came back when no chart was
 * present. It passed in the case that mattered — a model handed two charts
 * and asked for aspects it cannot compute from signs and houses, which is
 * every reading this feature produced before the ephemeris supplied them.
 *
 * This asks the question that catches it: is the answer a subset of what was
 * computed? Returns the first aspect that was not, or null.
 *
 * Comparison is case- and space-insensitive because "Conjunction" and
 * "conjunction" are the same aspect, and rejecting a reading over the
 * difference would be pedantry rather than safety.
 */
export function inventedAspect<T extends { a_body: string; b_body: string; type: string }>(
  returned: readonly T[],
  computed: readonly SynastryAspect[],
): T | null {
  const key = (a: { a_body: string; b_body: string; type: string }) =>
    `${a.a_body}|${a.b_body}|${a.type}`.toLowerCase().replace(/\s+/g, '');
  const real = new Set(computed.map(key));
  return returned.find((aspect) => !real.has(key(aspect))) ?? null;
}
