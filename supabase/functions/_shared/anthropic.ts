import type { ZodType } from 'zod';
import { lintDeep } from './lib/copy-lint.ts';
import { MalformedJson, parseJsonLoosely } from './lib/model-json.ts';

/**
 * The model call, held where the key is.
 *
 * `DECISIONS.md` §3 rejected a server-side proxy on two grounds. §10 answered
 * the first — a Supabase function is not an unauthenticated proxy, it is an
 * authenticated one behind a JWT check. This file is the second half of the
 * answer: the key never leaves the deployment, and every call is validated,
 * linted and logged before its text reaches a person.
 *
 * The validation is deliberately the *same* validation the browser runs. Both
 * paths parse the same zod schema and both pass the same copy lint, because
 * the copy rules are product rules and a rule that only applies to one of two
 * code paths is not a rule. `src/lib/shared-parity.test.ts` fails if the two
 * copies of either drift.
 */

/**
 * Kept identical to `src/ai/client.ts`. Somebody on their own key and somebody
 * on the server should be reading the same product, not two products that
 * happen to share a prompt.
 */
export const MODEL = 'claude-opus-5';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
/**
 * Ninety seconds, raised from forty-five.
 *
 * The comparison contract is the long one — a headline, a numerology pair per
 * number, a reading per aspect, where it flows, where it rubs, and the
 * questions to close on — and it took thirty-eight seconds before the
 * ephemeris started supplying aspects to narrate. Forty-five was not a
 * considered ceiling for that; it was the browser's number, copied over when
 * the call moved to the server, where nobody is watching a spinner.
 */
const TIMEOUT_MS = 90_000;

/** Aligned with `CallOutcome` in `log.ts`, so a failure logs as what it was. */
export type ModelErrorKind = 'invalid_json' | 'api_error' | 'timeout' | 'copy_violation';

export class ModelError extends Error {
  constructor(
    message: string,
    readonly kind: ModelErrorKind,
    /**
     * The upstream error *class*, when there is one — `authentication_error`,
     * `not_found_error`, `rate_limit_error`. Never the message, which can
     * quote the request back.
     *
     * It exists because `api_error` alone is undiagnosable from outside: the
     * function deliberately does not pass the provider's detail to the
     * caller, so without this the only way to tell a bad key from a model the
     * account cannot reach is to have the deployment's logs open. This lands
     * in `claude_api_calls.error_kind`, which is already documented as "the
     * error class, never the payload".
     */
    readonly detail?: string,
  ) {
    super(message);
  }
}

export type Generation<T> = {
  value: T;
  inputTokens: number | null;
  outputTokens: number | null;
};

export function hasKey(): boolean {
  return Boolean(Deno.env.get('ANTHROPIC_API_KEY'));
}

/**
 * PDR 6.5 step 6: validate, and on failure retry exactly once.
 *
 * The retry is the same shape as the browser's and stops for the same reason.
 * A copy violation is a property of the prompt rather than of a bad roll, so
 * asking again buys the same answer and a second charge.
 */
export async function generate<T>(call: {
  system: string;
  user: string;
  schema: ZodType<T>;
  /**
   * Thinking depth. `medium` for conversational turns: the contract is three
   * fields and a handful of sentences, and the rules that matter are enforced
   * downstream by the lint rather than by the model reasoning harder about
   * them. Raise it for anything that produces a document.
   */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /**
   * The ceiling for this contract, from `lib/budget.ts`. One number for every
   * purpose meant a two-sentence chat reply shared a limit with a Soul Map
   * document, and the limit had to fit the document.
   */
  maxTokens: number;
}): Promise<Generation<T>> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new ModelError('No key is configured.', 'api_error');

  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await post(call.system, call.user, call.effort ?? 'medium', call.maxTokens, apiKey);
      const json = readJson(response.text);

      // Parsed separately from the JSON read so the two failures stop being
      // one. A schema mismatch was reporting as `invalid_json`, which is what
      // a model returning prose reports as — and the difference is the whole
      // diagnosis. The first synastry returned valid, complete JSON that was
      // missing two fields, and `invalid_json` sent the search in exactly the
      // wrong direction, twice, at the cost of a call each time.
      const parsed = call.schema.safeParse(json);
      if (!parsed.success) {
        // Field paths, never values. `astro_dialogue.aspects.2.a_body` names
        // the shape that was wrong and quotes nothing anybody wrote.
        const paths = [...new Set(parsed.error.issues.map((i) => i.path.join('.') || '(root)'))];
        throw new ModelError(
          `The answer did not match the contract: ${paths.join(', ')}`,
          'invalid_json',
          `schema:${paths.slice(0, 4).join(',')}`,
        );
      }

      assertCleanCopy(parsed.data);
      return { value: parsed.data, inputTokens: response.inputTokens, outputTokens: response.outputTokens };
    } catch (error) {
      last = error;
      // Neither of these is a bad roll, and retrying both wastes a full
      // second generation. A copy violation is a property of the prompt. A
      // timeout is a property of the contract's length — the second attempt
      // takes as long as the first and ends the same way, having billed for
      // every token it produced before being cut off.
      if (error instanceof ModelError && (error.kind === 'copy_violation' || error.kind === 'timeout')) {
        break;
      }
    }
  }

  throw last instanceof ModelError ? last : new ModelError(String(last), 'invalid_json');
}

function readJson(text: string): unknown {
  try {
    return parseJsonLoosely(text);
  } catch (error) {
    if (error instanceof MalformedJson) throw new ModelError(error.message, 'invalid_json');
    throw error;
  }
}

function assertCleanCopy(value: unknown): void {
  const violations = lintDeep(value);
  if (violations.length === 0) return;
  const first = violations[0];
  throw new ModelError(
    `Copy rule "${first?.rule}" broken at ${first?.path}: "${first?.match}" — ${first?.why}`,
    'copy_violation',
  );
}

async function post(
  system: string,
  user: string,
  effort: string,
  maxTokens: number,
  apiKey: string,
): Promise<{ text: string; inputTokens: number | null; outputTokens: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        // Adaptive is the default on this model; stating it keeps the next
        // reader from assuming the omission means thinking is off.
        thinking: { type: 'adaptive' },
        output_config: { effort },
        // The prompt is stable across every turn and every person, so it is
        // the whole cacheable prefix. The volatile half is the user message,
        // which is why it is not in here.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      let type: string | undefined;
      try {
        const parsed = JSON.parse(raw) as { error?: { type?: unknown } };
        if (typeof parsed.error?.type === 'string') type = parsed.error.type;
      } catch {
        // A non-JSON body from a gateway. The status is the class then.
      }
      throw new ModelError(
        `Anthropic returned ${response.status}. ${raw.slice(0, 200)}`,
        'api_error',
        type ?? `http_${response.status}`,
      );
    }

    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    // `find` rather than `[0]`: with thinking on, the first block is a
    // thinking block and indexing would read an empty string.
    return {
      text: body.content?.find((block) => block.type === 'text')?.text ?? '',
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ModelError('The model took longer than 45 seconds.', 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
