import modalitiesRaw from '@data/modalities.json' with { type: 'json' };
import topicsRaw from '@data/topics.json' with { type: 'json' };
import crisisRaw from '@data/crisis-resources.json' with { type: 'json' };
import bedsRaw from '@data/bed-tracks.json' with { type: 'json' };
import needsRaw from '@data/presenting-needs.json' with { type: 'json' };
import opennessRaw from '@data/openness-options.json' with { type: 'json' };

import {
  bedTracksFileSchema,
  crisisResourcesFileSchema,
  modalitiesFileSchema,
  opennessFileSchema,
  presentingNeedsFileSchema,
  topicsFileSchema,
} from './schemas/index.ts';

/**
 * The seeded catalogue, parsed once at module load.
 *
 * Parsing rather than casting is deliberate: in production these rows come
 * from Postgres and can drift from the code that reads them. Validating at
 * the boundary here means the same guarantee holds in both worlds, and the
 * migration to a real query changes where the data comes from, not what the
 * rest of the app can assume about it.
 */

export const modalitiesFile = modalitiesFileSchema.parse(modalitiesRaw);
export const topicsFile = topicsFileSchema.parse(topicsRaw);
export const crisisResourcesFile = crisisResourcesFileSchema.parse(crisisRaw);
export const bedTracksFile = bedTracksFileSchema.parse(bedsRaw);
export const presentingNeedsFile = presentingNeedsFileSchema.parse(needsRaw);
export const opennessFile = opennessFileSchema.parse(opennessRaw);

export const MODALITIES = modalitiesFile.modalities;
export const TOPICS = topicsFile.topics;
export const BED_TRACKS = bedTracksFile.tracks;
export const PRESENTING_NEEDS = presentingNeedsFile.needs;

export const ACTIVE_MODALITIES = MODALITIES.filter((m) => m.is_active);

const BY_SLUG = new Map(MODALITIES.map((m) => [m.slug, m]));

export function modalityBySlug(slug: string) {
  return BY_SLUG.get(slug);
}

export function topicName(slug: string): string {
  return TOPICS.find((t) => t.slug === slug)?.name_es ?? slug;
}

/**
 * Expand a screen-4 selection into the modality slugs the hard filter expects.
 *
 * The UI offers five family-level choices because twenty-one checkboxes is a
 * bad screen; `openness_to_modalities` still stores slugs, exactly as PDR 5.2
 * specifies. Free-text entries keep their `otro:` prefix and restrict nothing.
 */
export function expandOpenness(selected: readonly string[]): string[] {
  if (selected.includes('me_da_lo_mismo')) return ['me_da_lo_mismo'];

  const slugs = new Set<string>();
  for (const choice of selected) {
    if (choice.startsWith(opennessFile.free_text_prefix)) continue;
    const option = opennessFile.options.find((o) => o.slug === choice);
    if (option) {
      for (const slug of option.expands_to) slugs.add(slug);
    } else if (BY_SLUG.has(choice)) {
      // Already a modality slug; accept it so a re-match can pass through.
      slugs.add(choice);
    }
  }
  return [...slugs];
}

/**
 * Whether any crisis resource for a country is still unverified.
 *
 * Drives the notice on the crisis screen. While this is true the
 * international fallback is shown alongside the local list, never instead of
 * it — PDR 6.4 is explicit that the list is never left empty.
 */
export function hasUnverifiedResources(country: string): boolean {
  return crisisResourcesFile.resources.some(
    (r) => r.country === country && r.is_active && r.verified_at === null,
  );
}
