/**
 * What a free question is, and how many there are.
 *
 * This lives in `lib` rather than in `store/chat.ts` because both sides need
 * it and a constant duplicated across a network boundary is a constant that
 * drifts. The client uses it to render a counter; the Edge Function uses it to
 * refuse. If those two disagree, the person is shown a number that is not the
 * rule being enforced on them.
 *
 * `shared-parity.test.ts` fails if this file and its copy under
 * `supabase/functions/_shared/lib` differ.
 *
 * No React, no storage, no browser API.
 */

/**
 * PDR section 3 describes a free tier with a small number of questions and a
 * paywall after it; the exact figure was not to hand. Three is small enough
 * that the paywall is reachable in a demo and large enough to show the
 * conversation working first. One constant to change.
 */
export const FREE_QUESTIONS = 3;

export type QuotaState = {
  used: number;
  remaining: number;
  unlimited: boolean;
};

/**
 * Deliberately takes the count rather than fetching it.
 *
 * On the client the count comes from the mirror; in the Edge Function it comes
 * from a `select count(*) … where counted`, run under the service role so the
 * person cannot edit their own tally. Same arithmetic either way, and the rule
 * is testable without either.
 */
export function quotaState(used: number, subscribed: boolean): QuotaState {
  if (subscribed) return { used, remaining: Number.POSITIVE_INFINITY, unlimited: true };
  return { used, remaining: Math.max(0, FREE_QUESTIONS - used), unlimited: false };
}

/**
 * What a subscription buys, while the subscription is simulated.
 *
 * The paywall's button activates it for free — there is no payment provider —
 * and `quotaState` reads it as unlimited. Every question past the free three
 * is a real model call paid for by whoever holds the Anthropic key, so
 * "unlimited" was one person's way to spend the whole deployment budget.
 *
 * The number is not a product choice; it is what fits. `budget.test.ts` holds
 * one person's worst month under a third of the deployment budget, and with
 * every other purpose at its ceiling that leaves room for nine chat turns at
 * the output maximum: the three free ones and these six. Offering more means
 * raising the budget or lowering another ceiling, and that test says which.
 *
 * Thirty days, like every other ceiling: `budget.ts` records why daily
 * windows were a mistake.
 */
export const SUBSCRIBED_QUESTIONS = 6;
export const SUBSCRIBED_WINDOW_HOURS = 720;

export function hasQuestionsLeft(used: number, subscribed: boolean): boolean {
  return quotaState(used, subscribed).remaining > 0;
}

/**
 * Whether a produced answer spends one.
 *
 * A turn is charged when it produced a usable answer. A failed call is not the
 * person's problem, and a crisis turn must never be — charging someone for
 * being met with a hotline would be the single worst line item this product
 * could have. PDR 1.6 forbids meeting a person in crisis with a commercial
 * fallback, and this is half of how that is kept true; the other half is
 * ordering, in the function: safety runs before the quota check, so somebody
 * in crisis never reaches the paywall at all.
 */
export function isChargeable(responseType: string): boolean {
  return responseType !== 'crisis';
}
