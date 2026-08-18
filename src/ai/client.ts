import type { ZodType } from 'zod';
import { getAiMode, type AiRunMode } from './mode';
import { lintDeep } from '@/lib/copy-lint';
import { MalformedJson, parseJsonLoosely } from '@/lib/model-json';
import { isBackendConfigured, supabase } from '@/supabase/client';

/**
 * One interface, two implementations, one validation path.
 *
 * Both the curated fixtures and the live API return values that must parse
 * against the same zod schema and survive the same copy lint. That symmetry
 * is the point: a fixture that drifts from the contract, or that quietly
 * breaks a copy rule, fails a test instead of shipping.
 */

export type AiCall<T> = {
  purpose: 'soul_map' | 'match' | 'chat' | 'meditation' | 'comparison';
  promptVersion: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  /** Returned when no key is present. Chosen deterministically from input. */
  fixture: () => T;
  /**
   * The server-side path, for the surfaces that have an Edge Function.
   *
   * Absent means this purpose has no server implementation yet, which is the
   * state four of the five are still in. The function builds its own prompt
   * from `body` rather than receiving `system` and `user`: the prompt is the
   * thing that must not be caller-supplied, or the quota buys whatever text
   * somebody feels like sending.
   */
  edge?: { fn: string; body: Record<string, unknown> };
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
 * Kept identical to the model the Edge Functions call, in
 * `supabase/functions/_shared/anthropic.ts`. A person on their own key and a
 * person on the server should be reading the same product.
 */
const MODEL = 'claude-opus-5';
const TIMEOUT_MS = 45_000;

/**
 * PDR 6.5 step 6: validate, and on failure retry exactly once before showing
 * an empathetic error. Retrying more would burn the person's key and their
 * patience for a model that has already shown it cannot hold the contract.
 */
export async function runAi<T>(call: AiCall<T>): Promise<AiResult<T>> {
  const { mode, apiKey } = getAiMode();
  const started = performance.now();

  const fixture = (): AiResult<T> => {
    const value = call.schema.parse(call.fixture());
    assertCleanCopy(value);
    // A token of latency so the generating screen is not a flash. The real
    // call takes ten to thirty seconds; pretending it is instant would
    // misrepresent the product being demonstrated.
    return {
      value,
      mode: 'fixture',
      latencyMs: performance.now() - started,
      inputTokens: null,
      outputTokens: null,
    };
  };

  // Three paths, in this order, and the order is a decision.
  //
  // A pasted key wins. Someone who went to Ajustes and typed their own
  // credential asked for their own credential to be spent; quietly routing
  // them through our server instead would make that switch a lie.
  //
  // The server comes next, and it is what the deployed product runs on. It
  // holds the key, counts the quota where the person cannot reach it, and
  // writes the ledger — none of which the browser can be trusted to do.
  //
  // Fixtures are last and are not a failure state. They are the offline demo,
  // and they are what a server that says `no_model` is asking for.
  if (mode !== 'fixture' && apiKey) return await byok(call, apiKey, started);

  if (call.edge && isBackendConfigured && supabase) {
    const result = await runOnEdge(call, started);
    if (result) return result;
  }

  return fixture();
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

async function byok<T>(call: AiCall<T>, apiKey: string, started: number): Promise<AiResult<T>> {

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callAnthropic(call, apiKey);
      const parsed = call.schema.parse(response.json);
      assertCleanCopy(parsed);
      return {
        value: parsed,
        mode: 'byok',
        latencyMs: performance.now() - started,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      };
    } catch (error) {
      lastError = error;
      // A copy violation is a property of the prompt, not of a bad roll.
      // Retrying it wastes a call to get the same answer.
      if (error instanceof AiError && error.kind === 'copy_violation') break;
    }
  }

  throw lastError instanceof AiError
    ? lastError
    : new AiError(String(lastError), 'invalid_json');
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

async function callAnthropic<T>(
  call: AiCall<T>,
  apiKey: string,
): Promise<{ json: unknown; inputTokens: number | null; outputTokens: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Without this header the browser call is refused. Its name is a
        // warning worth keeping in view: the key is exposed to whoever holds
        // this browser, which is why BYOK is opt-in and never a default.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0.7,
        system: [{ type: 'text', text: call.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: call.user }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AiError(`Anthropic returned ${response.status}. ${detail.slice(0, 200)}`, 'api_error');
    }

    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = body.content?.find((c) => c.type === 'text')?.text ?? '';
    return {
      json: readModelJson(text),
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiError('The model took longer than 45 seconds', 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** `@/lib/model-json` holds the parser so the server shares it verbatim. */
function readModelJson(text: string): unknown {
  try {
    return parseJsonLoosely(text);
  } catch (error) {
    if (error instanceof MalformedJson) throw new AiError(error.message, 'invalid_json');
    throw error;
  }
}
