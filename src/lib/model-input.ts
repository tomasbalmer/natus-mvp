import { z } from 'zod';
import { numerologySchema, soulMapSynthesisSchema } from './schemas/index.ts';
import { filterStrategySchema } from './matching.ts';
import { modalityBySlug } from './catalog.ts';

/**
 * What the browser is allowed to say about itself, for every surface that has
 * a server implementation.
 *
 * One file rather than one per function, because these are five statements of
 * the same rule and reading them side by side is the only way to notice that
 * one of them has grown a field the others would refuse. It lives in
 * `src/lib` so the prompts can take their input types from here and the
 * functions can validate against the same objects, under the parity test.
 *
 * **The context is the person's own data, echoed back from their own device,
 * and that is why it is accepted rather than re-read from Postgres.** Someone
 * who edits their synthesis before sending it changes only the reading they
 * get about themselves; there is no other subject to reach and no privilege
 * to gain. The things they must *not* be able to state are absent by
 * construction: no `clinical_basics` field exists here, so PDR 10.2 is a
 * shape rather than an intention, and neither crisis nor quota is decided
 * from anything in this file.
 *
 * **The bounds are not validation for its own sake.** Every string below
 * becomes prompt tokens charged to the deployment's key, so an unbounded
 * history is a way to spend somebody else's money one request at a time.
 */

const MAX_TURNS = 8;
const MAX_TURN_CHARS = 4_000;
const MAX_PROSE = 8_000;
/** Astrologer's XML context, capped where the natal-chart function caps it. */
const MAX_CHART = 250_000;

const slug = z.string().trim().min(1).max(80);
const slugs = z.array(slug).max(60);

/**
 * Split in two, and the split is the safety ordering.
 *
 * Safety runs before anything else can answer, so what safety needs must be
 * validated before anything else can reject. A person in crisis whose context
 * is half-built — a stale synthesis, a field this deployment has not shipped
 * yet — must still be met with a hotline, not with a 400. The envelope is all
 * that stands between a request and `scanText`; the model context is parsed
 * afterwards, once safety and the quota have both had their say.
 */
export const chatEnvelopeSchema = z.object({
  message: z.string().trim().min(1).max(MAX_TURN_CHARS),
  /** Chooses the crisis resource list. Not trusted for anything else. */
  country: z.string().trim().length(2).default('CL'),
});

export const chatContextSchema = z.object({
  synthesis: soulMapSynthesisSchema,
  numerology: numerologySchema.nullable().default(null),
  /** PDR 10.2. A derived level, never the answers it came from. */
  risk: z.enum(['none', 'elevated', 'high']).default('none'),
  recommendedSlugs: slugs.default([]),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(MAX_TURN_CHARS) }))
    .max(MAX_TURNS)
    .default([]),
});
export type ChatContext = z.infer<typeof chatContextSchema>;

/**
 * The onboarding draft, narrowed to what the prompt actually reads.
 *
 * `OnboardingDraft` has a `clinical_basics` field and this does not, which is
 * the whole point: the Soul Map prompt never referenced it, and now it cannot
 * receive it either. The narrowing also lets `prompts/soul-map.ts` cross into
 * `_shared` without dragging `src/store` behind it.
 */
export const soulMapDraftSchema = z.object({
  legal_birth_name: z.string().trim().max(160),
  birth_date: z.string().trim().max(40),
  birth_time: z.string().trim().max(20).default(''),
  birth_city: z.string().trim().max(120).default(''),
  country: z.string().trim().max(40).default('CL'),
  presenting_need_text: z.string().max(MAX_PROSE).default(''),
  presenting_need_slugs: slugs.default([]),
  openness_to_modalities: slugs.default([]),
  natal_chart: z
    .object({
      context: z.string().max(MAX_CHART),
      parse_status: z.literal('parsed'),
    })
    .nullable()
    .default(null),
});
export type SoulMapDraft = z.infer<typeof soulMapDraftSchema>;

export const soulMapInputSchema = z.object({
  draft: soulMapDraftSchema,
  numerology: numerologySchema.nullable().default(null),
});

/**
 * The pool, by reference rather than by value.
 *
 * The candidates arrive as slugs and the function rehydrates them from its
 * own copy of `data/modalities.json`. Sending the modality objects would have
 * worked and would have let a caller describe a therapy that does not exist —
 * or quietly edit the contraindications of one that does, which the model
 * then reads out as ours.
 */
export const matchInputSchema = z
  .object({
    synthesis: soulMapSynthesisSchema,
    presentingNeedText: z.string().max(MAX_PROSE).default(''),
    candidateSlugs: slugs.min(1),
    strategy: filterStrategySchema,
    excludedForVulnerability: slugs.default([]),
    excludedForDismissal: slugs.default([]),
    droppedForSize: z.number().int().min(0).max(500).default(0),
    poolBeforeTruncation: z.number().int().min(0).max(500).default(0),
  })
  .superRefine((value, ctx) => {
    // Every slug must name a therapy that exists. A pool with a hole in it
    // would reach the model as a shorter list and come back as a ranking of
    // whatever was left, with nothing anywhere saying one went missing.
    for (const candidate of value.candidateSlugs) {
      if (!modalityBySlug(candidate)) {
        ctx.addIssue({ code: 'custom', message: `unknown modality: ${candidate}` });
      }
    }
  });

/** The bed catalogue is not in here either: the function reads its own. */
export const meditationInputSchema = z.object({
  intent: z.string().trim().min(1).max(MAX_TURN_CHARS),
  minutes: z.number().int().min(1).max(60),
  synthesis: soulMapSynthesisSchema.nullable().default(null),
  risk: z.enum(['none', 'elevated', 'high']).default('none'),
});

const chartPositionSchema = z.object({
  body: z.string().trim().min(1).max(60),
  sign: z.string().trim().min(1).max(60),
  house: z.number().int().min(1).max(12).nullable(),
});

const comparisonBirthSchema = z.object({
  year: z.number().int().min(1).max(3000),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  city: z.string().trim().min(1).max(120),
  nation: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/),
});

const comparisonSubjectSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  numerology: numerologySchema.nullable(),
  soul_map_themes: slugs,
  chart: z.object({
    available: z.boolean(),
    positions: z.array(chartPositionSchema).max(40),
  }),
  /** Goes to the ephemeris and stops there. No prompt reads it. */
  birth: comparisonBirthSchema.nullable().default(null),
});

const synastryAspectSchema = z.object({
  a_body: z.string().trim().min(1).max(60),
  b_body: z.string().trim().min(1).max(60),
  type: z.string().trim().min(1).max(60),
  orb: z.number(),
});

/**
 * Validated again on arrival, having already been built by
 * `buildComparisonPayload`'s allow-list. The two are not redundant: the
 * allow-list decides what may leave one browser, and this decides what the
 * deployment's key will pay to read. A payload that grew a field in transit
 * is refused here rather than forwarded.
 */
export const comparisonInputSchema = z.object({
  scope: z.object({
    numerology: z.boolean(),
    astro: z.boolean(),
    soul_map_themes: z.boolean(),
  }),
  a: comparisonSubjectSchema,
  b: comparisonSubjectSchema,
  /**
   * Must arrive empty, and `.max(0)` is what says so rather than a comment.
   *
   * The function fills this from the ephemeris. A caller who could supply
   * aspects would be handing the model a list of placements to read out as
   * fact — rule 5 of PDR 8.5 broken from outside the model, where the check
   * that guards it would never look.
   */
  aspects: z.array(synastryAspectSchema).max(0).default([]),
});
