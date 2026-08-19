import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import {
  PURPOSE_LIMITS,
  costUsd,
  monthlyBudgetUsd,
  type Purpose,
} from './lib/budget.ts';

/**
 * The two questions asked before a token is spent: has this person had too
 * many, and has the deployment.
 *
 * Both are read with the elevated client, for the reason `quota.ts` gives
 * about the chat: under RLS a person can read their own rows, which means a
 * limit derived from anything they can reach is a suggestion. Here the count
 * is a `select` the caller has no hand in.
 *
 * Both fail **open** on an error. That is the opposite of the safety check,
 * and deliberately so: a spend ceiling exists to stop a runaway, and a
 * database hiccup is not a runaway. Refusing every request because a count
 * could not be read would turn a monitoring failure into an outage, and the
 * ledger still records what was spent either way.
 */

export type SpendRefusal = { reason: 'person' | 'deployment' };

/** Rolling window, counted from the ledger rather than from a stored total. */
export async function overPersonalLimit(
  elevated: SupabaseClient,
  userId: string,
  purpose: Purpose,
): Promise<boolean> {
  const limit = PURPOSE_LIMITS[purpose as Exclude<Purpose, 'chat'>];
  // `chat` has no entry: its limit is FREE_QUESTIONS, enforced in its own
  // function, and a second ceiling here would be a second answer to the same
  // question.
  if (!limit) return false;

  const since = new Date(Date.now() - limit.windowHours * 3_600_000).toISOString();

  try {
    const { count, error } = await elevated
      .from('claude_api_calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .eq('mode', 'server')
      // Anything that reached the model, not only what came back usable.
      // Counting successes alone let somebody loop a request the model
      // cannot satisfy without ever consuming their allowance — the platform
      // paying for every attempt while the person's counter stayed at zero.
      // Rows that never reached it have null tokens and are not theirs to
      // answer for: an outage must not spend somebody's quota.
      .not('output_tokens', 'is', null)
      .gte('created_at', since);

    if (error) return false;
    return (count ?? 0) >= limit.calls;
  } catch {
    return false;
  }
}

/**
 * What the deployment has spent in the last thirty days, against its budget.
 *
 * **Every server row, not only the successful ones.** A call that reached the
 * model and then failed its schema generated a full answer and was billed for
 * it; counting only `ok` meant the most expensive failure mode — a contract
 * the model cannot satisfy, retried, over and over — was the one the ceiling
 * could not see. Rows that never reached the model carry null tokens and
 * contribute nothing, which is the correct answer for them.
 */
export async function overDeploymentBudget(elevated: SupabaseClient): Promise<boolean> {
  const budget = monthlyBudgetUsd(Deno.env.get('MONTHLY_BUDGET_USD'));
  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

  try {
    const { data, error } = await elevated
      .from('claude_api_calls')
      .select('input_tokens,output_tokens,cache_write_tokens,cache_read_tokens')
      .eq('mode', 'server')
      .gte('created_at', since);

    if (error || !data) return false;

    let spent = 0;
    for (const row of data) {
      spent += costUsd({
        inputTokens: row.input_tokens ?? 0,
        outputTokens: row.output_tokens ?? 0,
        cacheWriteTokens: row.cache_write_tokens ?? 0,
        cacheReadTokens: row.cache_read_tokens ?? 0,
      });
    }
    return spent >= budget;
  } catch {
    return false;
  }
}

/** Both checks, in the order they get cheaper to be wrong about. */
export async function refuseForSpend(
  elevated: SupabaseClient,
  userId: string,
  purpose: Purpose,
): Promise<SpendRefusal | null> {
  if (await overPersonalLimit(elevated, userId, purpose)) return { reason: 'person' };
  if (await overDeploymentBudget(elevated)) return { reason: 'deployment' };
  return null;
}
