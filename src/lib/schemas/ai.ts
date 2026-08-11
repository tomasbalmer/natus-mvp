import { z } from 'zod';

/**
 * Output contracts for every model call, transcribed from the PDR.
 *
 * Both AI implementations validate against these — the fixtures and the real
 * API alike. That is the point: a curated fixture that drifts from the
 * contract breaks a test rather than the demo, and a model that returns
 * malformed JSON is caught before it reaches a screen.
 */

export const soulPhaseSchema = z.enum(['pregunta', 'exploracion', 'integracion', 'crisis']);
export const soulModeSchema = z.enum(['objetivo', 'exploracion']);

export const cadenceSchema = z.enum(['daily', 'weekly', 'process', 'one_off']);

export const tipSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  /** PDR 1.5: every tip closes on a micro-invitation, phrased as a question. */
  invitation: z.string().min(1),
  cadence: cadenceSchema,
});

/** PDR 6.5, normal case. `matched_facilitators` is deliberately absent: the
 *  matching is a separate call with its own contract (see matchResultSchema). */
export const soulMapSynthesisSchema = z.object({
  detected_phase: z.enum(['pregunta', 'exploracion', 'integracion']),
  detected_mode: soulModeSchema,
  soul_map_synthesis: z.object({
    tu_camino: z.string().min(1),
    lo_que_estas_trabajando: z.string().min(1),
    que_necesitas_ahora: z.string().min(1),
  }),
  tips: z.array(tipSchema).min(3).max(5),
  follow_up_invitation: z.string().min(1),
  /** PDR 7.2: feeds $inferred_topics in the hard filter. */
  inferred_topics: z.array(z.string().min(1)),
});
export type SoulMapSynthesis = z.infer<typeof soulMapSynthesisSchema>;

/** PDR 6.5, crisis case. Hard rule of the prompt: never return tips or
 *  recommendations when the phase is crisis. Expressed here as a schema that
 *  has nowhere to put them. */
export const soulMapCrisisSchema = z.object({
  detected_phase: z.literal('crisis'),
  crisis_response: z.string().min(1),
  crisis_resources: z.array(
    z.object({
      type: z.enum(['hotline', 'emergency']),
      country: z.string().length(2),
      name: z.string().min(1),
      contact: z.string().min(1),
      note: z.string().nullable(),
    }),
  ),
  follow_up_invitation: z.string().min(1),
});
export type SoulMapCrisis = z.infer<typeof soulMapCrisisSchema>;

export const soulMapResultSchema = z.union([soulMapSynthesisSchema, soulMapCrisisSchema]);
export type SoulMapResult = z.infer<typeof soulMapResultSchema>;

/** PDR 7.4. */
export const matchResultSchema = z.object({
  prompt_version: z.string().min(1),
  matched_modalities: z
    .array(
      z.object({
        modality_slug: z.string().min(1),
        rank: z.number().int().min(1),
        /** PDR 7.5: two to four sentences, connecting something specific the
         *  user said to something specific about the modality. */
        reasoning: z.string().min(1),
        /** Required whenever requires_clinical_support survives the filter. */
        caution_note: z.string().min(1).nullable(),
      }),
    )
    .min(3)
    .max(5),
  routine: z.array(tipSchema).min(3).max(5),
});
export type MatchResult = z.infer<typeof matchResultSchema>;

/** PDR 10.3. */
export const chatResponseSchema = z.object({
  type: z.enum(['reflection', 'recommendation', 'clarifying_question', 'crisis']),
  message_text: z.string().min(1),
  linked_modality_slugs: z.array(z.string().min(1)),
});
export type ChatResponse = z.infer<typeof chatResponseSchema>;

/** PDR 9.4 and 9.5. The script carries SSML; the browser turns it into a
 *  queue of utterances and timed pauses. */
export const meditationScriptSchema = z.object({
  title: z.string().min(1),
  script_text: z.string().min(1),
  script_ssml: z.string().min(1),
  bed_track_id: z.string().min(1),
});
export type MeditationScript = z.infer<typeof meditationScriptSchema>;

/** PDR 8.4. Note what is missing and cannot be added: there is no verdict
 *  field, no compatibility score, and the shape ends on questions. */
export const comparisonResultSchema = z.object({
  prompt_version: z.string().min(1),
  headline: z.string().min(1),
  numerology_dialogue: z.object({
    summary: z.string().min(1),
    pairs: z.array(
      z.object({
        a_number: z.number().int(),
        b_number: z.number().int(),
        kind: z.enum(['life_path', 'expression', 'soul_urge', 'personality', 'birthday']),
        reading: z.string().min(1),
      }),
    ),
  }),
  astro_dialogue: z.object({
    available: z.boolean(),
    summary: z.string(),
    aspects: z.array(
      z.object({
        a_body: z.string().min(1),
        b_body: z.string().min(1),
        type: z.string().min(1),
        reading: z.string().min(1),
      }),
    ),
  }),
  where_you_flow: z.array(z.string().min(1)).min(2).max(4),
  where_you_friction: z.array(z.string().min(1)).min(2).max(4),
  /** PDR 8.5 rule 4: the output ends in questions, never conclusions. */
  questions_to_explore: z.array(z.string().min(1)).min(2).max(3),
  disclaimer: z.string().min(1),
});
export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

/** PDR 6.2. Calculated in TypeScript, never by the model — the model is told
 *  to treat these as symbolic facts and not recompute them. */
export const numerologySchema = z.object({
  life_path: z.number().int().positive(),
  expression: z.number().int().positive(),
  soul_urge: z.number().int().positive(),
  personality: z.number().int().positive(),
  birthday: z.number().int().positive(),
  master_numbers_present: z.array(z.number().int()),
  algorithm_version: z.literal('pythagorean-v1'),
});
export type Numerology = z.infer<typeof numerologySchema>;
