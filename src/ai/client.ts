import type { ZodType } from 'zod';
import { getAiMode } from './mode';
import { lintDeep } from '@/lib/copy-lint';

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
};

export type AiResult<T> = {
  value: T;
  mode: 'fixture' | 'byok';
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

const MODEL = 'claude-sonnet-4-6';
const TIMEOUT_MS = 45_000;

/**
 * PDR 6.5 step 6: validate, and on failure retry exactly once before showing
 * an empathetic error. Retrying more would burn the person's key and their
 * patience for a model that has already shown it cannot hold the contract.
 */
export async function runAi<T>(call: AiCall<T>): Promise<AiResult<T>> {
  const { mode, apiKey } = getAiMode();
  const started = performance.now();

  if (mode === 'fixture' || !apiKey) {
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
  }

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
      json: parseJsonLoosely(text),
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

/**
 * Models wrap JSON in prose or a code fence often enough that refusing to
 * cope is a worse contract than tolerating it. The schema still decides
 * whether the result is usable.
 */
export function parseJsonLoosely(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new AiError('The model did not return JSON', 'invalid_json');
    }
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      throw new AiError('The model returned malformed JSON', 'invalid_json');
    }
  }
}
