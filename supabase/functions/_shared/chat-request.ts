import { z } from 'zod';
import { numerologySchema, soulMapSynthesisSchema } from './lib/schemas/index.ts';
import type { ChatTurn } from './prompts/chat.ts';

/**
 * What the browser is allowed to say about itself.
 *
 * The context in this body is the person's own data, echoed back from their
 * own device, and that is why it is accepted rather than re-read from
 * Postgres. Someone who edits their synthesis before sending it changes only
 * the reading they get about themselves; there is no other subject to reach
 * and no privilege to gain. The two things they must *not* be able to state —
 * whether they are in crisis, and how much quota is left — are not in here.
 * Both are decided server-side, in that order, before this is ever used.
 *
 * The bounds are not validation for its own sake. Every field below becomes
 * prompt tokens charged to the deployment's key, so an unbounded history is a
 * way to spend somebody else's money one request at a time.
 */

const MAX_TURNS = 8;
const MAX_TURN_CHARS = 4_000;

/**
 * Split in two, and the split is the same decision the rest of the file makes.
 *
 * Safety runs before anything else can answer, so what safety needs must be
 * validated before anything else can reject. A person in crisis whose context
 * is half-built — a stale synthesis, a field this deployment has not shipped
 * yet — must still be met with a hotline, not with a 400. So the envelope is
 * the message and the country, and it is all that stands between the request
 * and `scanText`.
 *
 * The model context is parsed afterwards, once safety and the quota have both
 * had their say, because that is the first moment it is needed.
 */
export const chatEnvelopeSchema = z.object({
  message: z.string().trim().min(1).max(MAX_TURN_CHARS),
  /** Chooses the crisis resource list. Not trusted for anything else. */
  country: z.string().trim().length(2).default('CL'),
});

export const chatContextSchema = z.object({
  synthesis: soulMapSynthesisSchema,
  numerology: numerologySchema.nullable().default(null),
  /**
   * PDR 10.2. A level, never the answers it came from — this schema is the
   * boundary that makes "raw `clinical_basics` never enters a model payload"
   * enforceable rather than merely intended. There is no field for it, so
   * there is nowhere for it to arrive.
   */
  risk: z.enum(['none', 'elevated', 'high']).default('none'),
  recommendedSlugs: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(MAX_TURN_CHARS),
      }),
    )
    .max(MAX_TURNS)
    .default([]),
});

export type ChatContext = z.infer<typeof chatContextSchema> & { history: ChatTurn[] };
