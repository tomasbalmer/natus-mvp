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
 * Counted with the elevated client on purpose. Under RLS the person can read
 * their own messages, which means they can also write them, which means a
 * quota derived from a client-side count is a suggestion. Here the count is a
 * `select` the caller has no hand in.
 */

export async function currentQuota(
  elevated: SupabaseClient,
  userId: string,
): Promise<QuotaState> {
  const [{ count }, { data: subscription }] = await Promise.all([
    elevated
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('counted', true),
    elevated.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
  ]);

  return quotaState(count ?? 0, subscription?.status === 'active');
}
