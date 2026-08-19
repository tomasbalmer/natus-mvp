import { z } from 'zod';
import { ACTIVE_MODALITIES } from './catalog.ts';
import type { Modality } from './schemas/index.ts';

/**
 * The hard filter of PDR 7.2, as pure TypeScript.
 *
 * The SQL in the PDR is three predicates. What it does not settle is what
 * happens when they leave nothing, or too much, and section 7.2 marks those
 * as unresolved. The four outcomes below are this implementation's answer,
 * and every one of them is visible in the result rather than silent — "nunca
 * truncar en silencio" is the PDR's own instruction and the reason
 * `FilterOutcome` reports what it dropped and why.
 *
 * No React, no storage — copied into `_shared/lib` unchanged, and
 * `shared-parity.test.ts` fails if the two copies ever differ.
 *
 * **Which copy is authoritative.** The one in the Edge Function.
 * A filter running in a browser can be edited by whoever is holding the
 * browser, and this one decides whether somebody in a fragile state is shown
 * a modality that opens things up — `clinicallyExcluded` below is not a
 * presentation concern. The client keeps its copy so the UI can respond
 * without a round trip; the server's is the one that counts, and the two
 * agreeing is what the parity test protects.
 */

export const MAX_POOL = 12;

/**
 * Written as a schema and the type derived from it, because the strategy now
 * crosses to the server in a request body and a second hand-written union
 * would be one more thing to keep in step.
 */
export const filterStrategySchema = z.enum([
  /** All three predicates applied. The ordinary case. */
  'topical',
  /** Topical relevance dropped because it emptied the pool. */
  'relaxed',
  /** Nothing survived even relaxed; contemplative practices as a starting point. */
  'contemplative-fallback',
]);
export type FilterStrategy = z.infer<typeof filterStrategySchema>;

export type FilterOutcome = {
  candidates: Modality[];
  strategy: FilterStrategy;
  /** Slugs removed because the person is clinically vulnerable. */
  excludedForVulnerability: string[];
  /** Slugs removed because they were dismissed within the last 90 days. */
  excludedForDismissal: string[];
  /** How many were cut by the size cap, and never silently. */
  droppedForSize: number;
  poolBeforeTruncation: number;
};

export type FilterInput = {
  /** `openness_to_modalities`, already expanded to slugs. */
  openness: readonly string[];
  inferredTopics: readonly string[];
  clinicallyVulnerable: boolean;
  /** US-6.2 CA3: dismissed modalities do not reappear for 90 days. */
  dismissedSlugs?: readonly string[];
};

function passesOpenness(modality: Modality, openness: readonly string[]): boolean {
  // PDR 7.2: `me_da_lo_mismo` makes predicate 1 restrict nothing.
  if (openness.length === 0 || openness.includes('me_da_lo_mismo')) return true;
  return openness.includes(modality.slug);
}

function passesTopics(modality: Modality, topics: readonly string[]): boolean {
  if (topics.length === 0) return true;
  return modality.works_well_for.some((t) => topics.includes(t));
}

/**
 * Truncate by ascending intensity — start from the least confronting.
 *
 * PDR 7.2 specifies the order and the reason. Ties break on slug so the same
 * input always produces the same pool; a ranking that shuffles between runs
 * would make the eval set meaningless.
 */
function truncate(pool: Modality[]): { kept: Modality[]; dropped: number } {
  if (pool.length <= MAX_POOL) return { kept: pool, dropped: 0 };
  const sorted = [...pool].sort(
    (a, b) => a.intensity - b.intensity || a.slug.localeCompare(b.slug),
  );
  return { kept: sorted.slice(0, MAX_POOL), dropped: pool.length - MAX_POOL };
}

export function filterModalities(input: FilterInput): FilterOutcome {
  const dismissed = new Set(input.dismissedSlugs ?? []);

  const excludedForVulnerability: string[] = [];
  const excludedForDismissal: string[] = [];

  const afterHardRules = ACTIVE_MODALITIES.filter((m) => {
    if (dismissed.has(m.slug)) {
      excludedForDismissal.push(m.slug);
      return false;
    }
    if (!passesOpenness(m, input.openness)) return false;
    // Clinical safety outranks preference: a removing modality is out even if
    // the person asked for exactly that family.
    if (input.clinicallyVulnerable && m.requires_clinical_support) {
      excludedForVulnerability.push(m.slug);
      return false;
    }
    return true;
  });

  const topical = afterHardRules.filter((m) => passesTopics(m, input.inferredTopics));

  let strategy: FilterStrategy = 'topical';
  let pool = topical;

  if (pool.length === 0) {
    // PDR 7.2 edge case 1: retry without the topical predicate.
    strategy = 'relaxed';
    pool = afterHardRules;
  }

  if (pool.length === 0) {
    // Still nothing — the openness selection excluded everything, or the
    // person is vulnerable and asked only for removing modalities.
    // Contemplative practices are the honest floor: autonomous, low
    // intensity, and safe for someone the filter just protected.
    strategy = 'contemplative-fallback';
    pool = ACTIVE_MODALITIES.filter(
      (m) => m.family === 'contemplativa' && !m.requires_clinical_support && !dismissed.has(m.slug),
    );
  }

  const poolBeforeTruncation = pool.length;
  const { kept, dropped } = truncate(pool);

  return {
    candidates: kept,
    strategy,
    excludedForVulnerability,
    excludedForDismissal,
    droppedForSize: dropped,
    poolBeforeTruncation,
  };
}

/**
 * PDR 7.2 edge case 4: when the model call fails, rank deterministically by
 * how many inferred topics each modality claims, and build the reasoning from
 * the catalogue rather than inventing one.
 *
 * The result is duller than a generated reading and it is honest, which is
 * the right trade when the alternative is an error screen.
 */
export function fallbackRanking(
  outcome: FilterOutcome,
  inferredTopics: readonly string[],
  limit = 3,
): { modality: Modality; reasoning: string; overlap: number }[] {
  return [...outcome.candidates]
    .map((modality) => ({
      modality,
      overlap: modality.works_well_for.filter((t) => inferredTopics.includes(t)).length,
      reasoning: `${modality.short_description} ${modality.what_happens}`,
    }))
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        a.modality.intensity - b.modality.intensity ||
        a.modality.slug.localeCompare(b.modality.slug),
    )
    .slice(0, limit);
}

/**
 * The copy that frames a pool, which changes with how the pool was reached.
 *
 * PDR 7.2 is explicit that a small pool is shown as it is, without padding it
 * with noise, and that the copy acknowledges there are few. Saying "these are
 * your matches" over two cards would be a small lie that costs trust.
 */
export function poolFraming(outcome: FilterOutcome): string {
  if (outcome.strategy === 'contemplative-fallback') {
    return 'Con lo que nos contaste todavía no podemos afinar mucho. Estas son prácticas que suelen servir como punto de partida.';
  }
  if (outcome.strategy === 'relaxed') {
    return 'Ampliamos la búsqueda más allá de los temas que reconocimos, para no dejarte con las manos vacías.';
  }
  if (outcome.candidates.length <= 2) {
    return 'Son pocas, y las dejamos así. Preferimos mostrarte dos que tengan sentido antes que cinco para llenar la pantalla.';
  }
  return 'Caminos posibles, en el orden en que nos parece que tienen más que ver con lo que contaste.';
}
