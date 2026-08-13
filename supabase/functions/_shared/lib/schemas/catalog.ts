import { z } from 'zod';

/**
 * Schemas for the seeded catalogue: therapy modalities, topics, crisis
 * resources, sound beds and the onboarding option lists.
 *
 * These mirror the SQL of PDR 5.3 and 5.9. Nothing here imports React or
 * touches a browser API — this file is meant to be copied into
 * `supabase/functions/_shared/schemas` unchanged.
 */

export const FAMILIES = [
  'psicologica',
  'corporal',
  'energetica',
  'simbolica',
  'contemplativa',
] as const;

export const familySchema = z.enum(FAMILIES);
export type Family = z.infer<typeof familySchema>;

/** PDR 5.3: 'clinica' | 'emergente' | 'tradicional'. Epistemic honesty is a
 *  column, not a footnote — the UI must be able to say which is which. */
export const evidenceLevelSchema = z.enum(['clinica', 'emergente', 'tradicional']);
export type EvidenceLevel = z.infer<typeof evidenceLevelSchema>;

export const typicalFormatSchema = z.enum([
  '1:1 semanal',
  'grupal',
  'taller intensivo',
  'práctica autónoma',
]);

export const typicalHorizonSchema = z.enum(['short', 'medium', 'long', 'flexible']);

export const topicSchema = z.object({
  slug: z.string().min(1),
  name_es: z.string().min(1),
  name_en: z.string().min(1),
});
export type Topic = z.infer<typeof topicSchema>;

export const topicsFileSchema = z.object({
  version: z.string(),
  topics: z.array(topicSchema).min(1),
});

export const modalitySchema = z.object({
  slug: z.string().min(1),
  name_es: z.string().min(1),
  name_en: z.string().min(1),
  family: familySchema,
  /** One sentence, shown on the card. */
  short_description: z.string().min(1),
  /**
   * What actually happens in a session, in concrete terms. PDR 7.5 makes this
   * load-bearing: without it the recommendation is useless, because nobody
   * knows what EMDR or constelaciones involve. The length floor is a guard
   * against it decaying into another one-line blurb.
   */
  what_happens: z.string().min(120),
  works_well_for: z.array(z.string().min(1)).min(1),
  typical_format: typicalFormatSchema,
  typical_horizon: typicalHorizonSchema,
  /** 1-5, how confronting or destabilising the modality is. */
  intensity: z.number().int().min(1).max(5),
  evidence_level: evidenceLevelSchema,
  contraindications: z.array(z.string().min(1)),
  requires_clinical_support: z.boolean(),
  is_active: z.boolean(),
});
export type Modality = z.infer<typeof modalitySchema>;

export const modalitiesFileSchema = z.object({
  version: z.string(),
  families: z.array(familySchema),
  modalities: z.array(modalitySchema).min(1),
});

export const crisisResourceSchema = z.object({
  country: z.string().length(2),
  type: z.enum(['hotline', 'emergency']),
  name: z.string().min(1),
  contact: z.string().min(1),
  note: z.string().min(1).nullable(),
  priority: z.number().int().min(1),
  is_active: z.boolean(),
  /**
   * Null until someone has called the number. The crisis screen shows an
   * unverified notice while this is null. PDR 6.4 calls verification an
   * absolute launch blocker, so this field is not optional — an entry that
   * simply omitted it would read as verified.
   */
  verified_at: z.iso.date().nullable(),
});
export type CrisisResource = z.infer<typeof crisisResourceSchema>;

export const crisisResourcesFileSchema = z.object({
  version: z.string(),
  resources: z.array(crisisResourceSchema).min(1),
  fallback: z.object({
    name: z.string().min(1),
    url: z.url(),
    note: z.string().min(1),
    emergency_instruction: z.string().min(1),
  }),
});

const oscillatorVoiceSchema = z.object({
  type: z.enum(['sine', 'triangle', 'sawtooth', 'square']),
  hz: z.number().positive(),
  gain: z.number().min(0).max(1),
});

export const bedTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  frequency_hz: z.number().positive().nullable(),
  suits: z.string().min(1),
  synthesis: z.object({
    voices: z.array(oscillatorVoiceSchema),
    noise: z
      .object({
        type: z.enum(['white', 'pink', 'brown']),
        gain: z.number().min(0).max(1),
        lowpass_hz: z.number().positive(),
      })
      .nullable(),
    lfo: z
      .object({
        hz: z.number().positive(),
        depth: z.number().min(0).max(1),
      })
      .nullable(),
  }),
  is_active: z.boolean(),
});
export type BedTrack = z.infer<typeof bedTrackSchema>;

export const bedTracksFileSchema = z.object({
  version: z.string(),
  tracks: z.array(bedTrackSchema).min(1),
});

export const presentingNeedSchema = z.object({
  slug: z.string().min(1),
  label_es: z.string().min(1),
  topic_hints: z.array(z.string().min(1)).min(1),
});
export type PresentingNeed = z.infer<typeof presentingNeedSchema>;

export const presentingNeedsFileSchema = z.object({
  version: z.string(),
  prompt_es: z.string().min(1),
  helper_es: z.string().min(1),
  needs: z.array(presentingNeedSchema).min(6).max(8),
});

export const opennessOptionSchema = z.object({
  slug: z.string().min(1),
  label_es: z.string().min(1),
  hint_es: z.string().min(1),
  expands_to: z.array(z.string().min(1)),
});

export const opennessFileSchema = z.object({
  version: z.string(),
  prompt_es: z.string().min(1),
  helper_es: z.string().min(1),
  options: z.array(opennessOptionSchema).min(1),
  special: z.array(opennessOptionSchema).min(1),
  allows_free_text: z.boolean(),
  free_text_prefix: z.string().min(1),
});
