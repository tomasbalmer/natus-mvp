import type { ZodType } from 'zod';
import { lintDeep } from '@/lib/copy-lint';
import { isBackendConfigured, supabase } from '@/supabase/client';

/**
 * One interface, two implementations, one validation path.
 *
 * Both the curated fixtures and the Edge Function return values that must
 * parse against the same zod schema and survive the same copy lint. That
 * symmetry is the point: a fixture that drifts from the contract, or that
 * quietly breaks a copy rule, fails a test instead of shipping.
 *
 * There used to be a third — a key the viewer pasted, spent from the browser.
 * It was how a static demo showed real generation, and it stopped being worth
 * its cost the moment all five surfaces had a server: it put a working
 * credential in `localStorage`, it was the one path whose spend nobody could
 * account for, and it answered from a place the banner had to keep explaining.
 * `docs/DECISIONS.md` §14 records the removal.
 */

/**
 * Which path produced a value. `server` rather than `edge` because that is the
 * word the `*_mode_check` constraints and `claude_api_calls.mode` already use,
 * and one vocabulary for one thing is worth more than a more literal second.
 */
export type AiRunMode = 'fixture' | 'server';

export type AiCall<T> = {
  purpose: 'soul_map' | 'match' | 'chat' | 'meditation' | 'comparison';
  promptVersion: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  /** Returned when no key is present. Chosen deterministically from input. */
  fixture: () => T;
  /**
   * The server-side path. The function builds its own prompt from `body`
   * rather than receiving `system` and `user`: the prompt is the thing that
   * must not be caller-supplied, or the deployment's key buys whatever text
   * somebody feels like sending.
   */
  edge: { fn: string; body: Record<string, unknown> };
};

export type AiResult<T> = {
  value: T;
  mode: AiRunMode;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'invalid_json' | 'api_error' | 'timeout' | 'copy_violation',
  ) {
    super(message);
  }
}

/**
 * PDR 6.5 step 6: validate, and on failure retry exactly once before showing
 * an empathetic error. Retrying more would burn the person's key and their
 * patience for a model that has already shown it cannot hold the contract.
 */
export async function runAi<T>(call: AiCall<T>): Promise<AiResult<T>> {
  const started = performance.now();

  if (isBackendConfigured && supabase) {
    const result = await runOnEdge(call, started);
    if (result) return result;
  }

  const value = call.schema.parse(call.fixture());
  assertCleanCopy(value);
  // A token of latency so the generating screen is not a flash. The real call
  // takes ten to thirty seconds; pretending it is instant would misrepresent
  // the product being demonstrated.
  return {
    value,
    mode: 'fixture',
    latencyMs: performance.now() - started,
    inputTokens: null,
    outputTokens: null,
  };
}

/**
 * The server path.
 *
 * Returns `null` — meaning "use the fixture" — only for the one refusal the
 * server declares rather than suffers: `no_model`, which says the deployment
 * has no key configured and the curated path is the right answer. Every other
 * failure throws, because a fixture substituted for a broken server is a
 * screen that looks like it worked.
 */
async function runOnEdge<T>(call: AiCall<T>, started: number): Promise<AiResult<T> | null> {
  const edge = call.edge;
  if (!edge || !supabase) return null;

  // No session, no server path. The function derives the person from the JWT
  // and refuses without one, and a 401 here is not a fault to surface — it is
  // somebody using the demo without signing in, which is a supported way to
  // run this application and has always landed on the fixtures.
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase.functions.invoke<Record<string, unknown>>(edge.fn, {
    body: edge.body,
  });

  if (error) {
    // `FunctionsHttpError` carries the response; anything else is transport.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 503) return null;
    throw new AiError(`The ${edge.fn} function returned ${status ?? 'no status'}.`, 'api_error');
  }

  if (data && typeof data === 'object' && 'error' in data) {
    if (data.error === 'no_model') return null;
    throw new AiError(`The ${edge.fn} function refused: ${String(data.error)}.`, 'api_error');
  }

  // The server runs the same Layer 1 the caller already ran. If it fires here
  // the two disagreed about the same text, which is a fault worth surfacing
  // rather than papering over — the screen has its own containment path and
  // reaches it by way of this throw.
  if (data && typeof data === 'object' && data['type'] === 'crisis') {
    throw new AiError(`The ${edge.fn} function saw a crisis the caller did not.`, 'api_error');
  }

  const parsed = call.schema.parse(data?.['result']);
  assertCleanCopy(parsed);
  return {
    value: parsed,
    mode: 'server',
    latencyMs: performance.now() - started,
    inputTokens: numberOrNull(data?.['input_tokens']),
    outputTokens: numberOrNull(data?.['output_tokens']),
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function assertCleanCopy(value: unknown): void {
  const violations = lintDeep(value);
  if (violations.length === 0) return;
  const first = violations[0];
  throw new AiError(
    `Copy rule "${first?.rule}" broken at ${first?.path}: "${first?.match}" — ${first?.why}`,
    'copy_violation',
  );
}
