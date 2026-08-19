/**
 * What a deployment is willing to spend, and what one person is allowed to
 * cost it.
 *
 * These are **abuse ceilings, not product rules.** The only quota the PDR
 * states is the chat's three free questions, and that one lives in
 * `quota.ts` where it belongs. Nothing here is meant to be reached by
 * somebody using the product: the numbers are set far above ordinary use, and
 * a person who hits one has either found a loop or is trying to.
 *
 * The distinction matters for what happens at the boundary. A spent chat
 * quota shows a paywall, because being out of free questions is a state the
 * product has an answer for. Hitting one of these shows an error, because it
 * is not a state anybody was supposed to be in.
 *
 * Everything is counted from `claude_api_calls`, which already records the
 * user, the purpose and the tokens of every server call. Counting from the
 * ledger rather than from a counter means there is nothing to keep in step
 * and nothing a client can write.
 */

export type Purpose = 'soul_map' | 'match' | 'chat' | 'meditation' | 'comparison';

/**
 * Claude Opus 5, US dollars per million tokens. Kept beside the ceiling it
 * feeds so a model change and a budget change are one edit.
 *
 * Four rates, not two. Writing to the prompt cache costs 1.25× the input
 * rate and reading from it costs 0.1×, and both were being counted as zero:
 * the response carries `cache_creation_input_tokens` and
 * `cache_read_input_tokens` alongside `input_tokens`, and only the last was
 * being read. Every call therefore under-reported, which means the ceiling
 * below would have fired later than it was set to.
 */
export const PRICE_PER_MTOK = {
  input: 5,
  output: 25,
  cacheWrite: 6.25,
  cacheRead: 0.5,
} as const;

/**
 * The four counts a call is billed on. Nullable because a call that never
 * reached the model has none, and zero would be a claim rather than an
 * absence.
 */
export type Usage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  /** Billed at 1.25×. Charged the first time a prefix is cached. */
  cacheWriteTokens?: number | null;
  /** Billed at 0.1×. The saving, when the cache is still warm. */
  cacheReadTokens?: number | null;
};

export function costUsd(usage: Usage): number {
  return (
    ((usage.inputTokens ?? 0) * PRICE_PER_MTOK.input +
      (usage.outputTokens ?? 0) * PRICE_PER_MTOK.output +
      (usage.cacheWriteTokens ?? 0) * PRICE_PER_MTOK.cacheWrite +
      (usage.cacheReadTokens ?? 0) * PRICE_PER_MTOK.cacheRead) /
    1_000_000
  );
}

/**
 * Two attempts, added.
 *
 * A retry is billed on top of the attempt that failed, so a record that keeps
 * only the last one under-reports by exactly the amount that made retrying
 * expensive. Null plus null stays null — the absence survives — while null
 * plus a number is that number, because one attempt reaching the model and
 * the other not is still one attempt's worth of tokens.
 */
export function addUsage(a: Usage | undefined, b: Usage | undefined): Usage | undefined {
  if (!a) return b;
  if (!b) return a;
  const sum = (x: number | null | undefined, y: number | null | undefined) =>
    x === null || x === undefined ? (y ?? null) : (x ?? 0) + (y ?? 0);
  return {
    inputTokens: sum(a.inputTokens, b.inputTokens),
    outputTokens: sum(a.outputTokens, b.outputTokens),
    cacheWriteTokens: sum(a.cacheWriteTokens, b.cacheWriteTokens),
    cacheReadTokens: sum(a.cacheReadTokens, b.cacheReadTokens),
  };
}

export type PurposeLimit = {
  /** Calls one person may make in the window. */
  calls: number;
  windowHours: number;
};

/**
 * Per person, per purpose.
 *
 * `chat` is absent deliberately: its limit is `FREE_QUESTIONS`, it is a
 * product rule, and giving it a second ceiling here would mean two numbers
 * that can disagree about the same refusal.
 *
 * The Soul Map is the expensive one — it carries the natal chart — and it is
 * also the one somebody has a real reason to regenerate after editing their
 * answers. Ten in thirty days is roughly ten times what that takes.
 *
 * **Every window is thirty days, and the first draft's daily windows were a
 * mistake worth recording.** Twenty meditations a day reads as a modest
 * number and is six hundred a month; priced at the output ceiling it came to
 * more than a hundred dollars from one person, against a deployment budget of
 * fifty. A daily limit also protects against a burst, which a monthly one
 * does not — but a burst is bounded by the budget below, and the budget is
 * the number these have to add up against. One unit of time for every
 * ceiling is what makes that sum checkable, and `budget.test.ts` checks it.
 */
export const PURPOSE_LIMITS: Record<Exclude<Purpose, 'chat'>, PurposeLimit> = {
  soul_map: { calls: 10, windowHours: 720 },
  match: { calls: 20, windowHours: 720 },
  meditation: { calls: 40, windowHours: 720 },
  comparison: { calls: 20, windowHours: 720 },
};

/**
 * What the whole deployment may spend in a rolling thirty days.
 *
 * The last line of defence, and the only one that holds when the failure is
 * not one person looping but fifty people costing more than expected. Set
 * `MONTHLY_BUDGET_USD` on the project to change it.
 *
 * Fifty people generating a Soul Map each and spending their three chat
 * questions costs a few dollars. The default is two orders of magnitude above
 * that, so reaching it means something is wrong rather than popular.
 */
export const DEFAULT_MONTHLY_BUDGET_USD = 50;

export function monthlyBudgetUsd(configured: string | undefined): number {
  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_BUDGET_USD;
}

/**
 * `max_tokens` per purpose.
 *
 * One ceiling for every call meant a two-sentence chat reply shared a limit
 * with a Soul Map document, and the limit had to fit the document. These are
 * the sizes each contract can actually need, with room for the thinking
 * tokens that count against the same budget.
 *
 * Too low truncates mid-answer and the schema then rejects it, costing the
 * call and producing nothing — so these err upward. They are a ceiling on the
 * worst case, not a target.
 */
export const MAX_OUTPUT_TOKENS: Record<Purpose, number> = {
  soul_map: 8000,
  match: 4000,
  chat: 3000,
  meditation: 6000,
  // Raised from 4000 after the first synastry came back as truncated JSON.
  // The contract is the longest one — a headline, a pair per number, a
  // reading per aspect, flow, friction, questions and a disclaimer — and
  // thinking tokens count against the same ceiling, so 4000 left the answer
  // cut off mid-object. Too low does not save money: it spends the whole call
  // and returns nothing parseable.
  comparison: 8000,
};
