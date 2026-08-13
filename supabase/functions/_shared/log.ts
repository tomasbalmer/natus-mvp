import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * PDR 4. What happened, never what was said.
 *
 * The table has no column for the prompt or the completion, and this function
 * has no parameter for one. A log of what somebody asked a mental-health
 * product is a second copy of the most sensitive data in the system, kept
 * somewhere nobody thought to protect — and the whole point of
 * `claude_api_calls` is operational: what is this costing, what is failing, is
 * the quota holding.
 *
 * Written with the elevated client. A ledger the subject can edit is not a
 * ledger, and this one exists partly to notice abuse.
 *
 * Never throws. A failure to log must not fail the request the person is
 * waiting on — the record is for us, the answer is for them.
 */

export type CallOutcome =
  | 'ok'
  | 'invalid_json'
  | 'copy_violation'
  | 'api_error'
  | 'timeout'
  | 'refused_quota'
  | 'refused_crisis';

export type CallRecord = {
  userId: string;
  purpose: 'soul_map' | 'match' | 'chat' | 'meditation' | 'comparison';
  promptVersion: string;
  model: string;
  mode: 'fixture' | 'server';
  outcome: CallOutcome;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs: number;
  errorKind?: string | null;
};

export async function logCall(elevated: SupabaseClient, record: CallRecord): Promise<void> {
  try {
    await elevated.from('claude_api_calls').insert({
      user_id: record.userId,
      purpose: record.purpose,
      prompt_version: record.promptVersion,
      model: record.model,
      mode: record.mode,
      outcome: record.outcome,
      input_tokens: record.inputTokens ?? null,
      output_tokens: record.outputTokens ?? null,
      latency_ms: Math.round(record.latencyMs),
      error_kind: record.errorKind ?? null,
    });
  } catch {
    // See above. Deliberately silent.
  }
}
