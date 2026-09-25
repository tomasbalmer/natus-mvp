import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { quotaState, type QuotaState } from './lib/quota.ts';

/**
 * The quota, counted where the person cannot reach it.
 *
 * `DECISIONS.md` §3 rejected a server-side proxy partly because it "puts a
 * spend-anything endpoint on a public URL". §10 supersedes the first half of
 * that objection and explicitly does not supersede this one — this file is the
 * answer to it, and the chat does not open to users until it exists.
 *
 * Counted from `claude_api_calls`, which only the functions write. It used to
 * count `messages where counted` — rows the browser writes and may delete, so
 * deleting your own messages gave the free questions back. Running that
 * select with the service role made it look protected; it was not. The chat
 * function marks a call `charged` where the model answered, and nowhere else.
 */

export async function currentQuota(
  elevated: SupabaseClient,
  userId: string,
): Promise<QuotaState> {
  const [{ count }, { data: subscription }] = await Promise.all([
    elevated
      .from('claude_api_calls')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('purpose', 'chat')
      .eq('charged', true),
    elevated.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
  ]);

  return quotaState(count ?? 0, subscription?.status === 'active');
}
