import type { ZodType } from 'zod';
import { json, preflight } from './cors.ts';
import { authenticate, Unauthorized } from './auth.ts';
import { logCall, type CallRecord } from './log.ts';
import { MODEL, ModelError, generate, hasKey } from './anthropic.ts';
import { scanText } from './lib/safety.ts';
import { MAX_OUTPUT_TOKENS } from './lib/budget.ts';
import { refuseForSpend } from './spend.ts';

/**
 * The shape four of the five functions share.
 *
 * Not a router. Each purpose still gets its own directory, its own URL and its
 * own worker, which is what step 5.1 asked for and what keeps a broken
 * meditation prompt from taking the Soul Map down. What is shared is the
 * sequence every one of them has to get right — authenticate, refuse to spend
 * a token on somebody in crisis, call, validate, log — because four
 * hand-written copies of that sequence is four chances to put the safety check
 * in the wrong place.
 *
 * `chat` deliberately does not use this. It has a quota to consult between
 * safety and the model, and a crisis reply that is a product surface rather
 * than a refusal, so bending this to fit it would have made both worse.
 */

export type ModelRoute<I, O> = {
  purpose: CallRecord['purpose'];
  promptVersion: string;
  /** What the browser may say about itself. */
  input: ZodType<I>;
  /** What the model must answer with. */
  output: ZodType<O>;
  system: string;
  user: (input: I) => string;
  /**
   * Free prose the person typed, if this surface has any.
   *
   * `DECISIONS.md` §5: the deterministic scan runs in front of the model,
   * everywhere a person writes in their own words. Two of these four do —
   * the Soul Map's presenting need and the meditation's intent — and both
   * are read by the model, so both are scanned before a token is spent.
   */
  prose?: (input: I) => string;
  /**
   * Anything that has to be fetched before the prompt can be built.
   *
   * Runs after the crisis scan and after the key check, so a refused turn and
   * a deployment with no model both cost nothing upstream. `comparison` uses
   * it to compute the synastry aspects: they are the one part of that prompt
   * the caller must not supply, because a caller who could supply them would
   * be telling the model which placements to read out.
   */
  enrich?: (input: I) => Promise<I>;
  /**
   * A rule about the answer that the schema cannot express. Returns a reason
   * to reject, or null to accept. Rejection is logged as `copy_violation` —
   * the model held the contract and broke the product rule.
   */
  check?: (output: O, input: I) => string | null;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
};

export function serveModel<I, O>(route: ModelRoute<I, O>): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const cors = preflight(request);
    if (cors) return cors;
    if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

    let auth;
    try {
      auth = await authenticate(request);
    } catch (error) {
      if (error instanceof Unauthorized) return json(request, { error: 'unauthorized' }, 401);
      return json(request, { error: 'misconfigured' }, 500);
    }

    const { userId, elevated } = auth;
    const started = Date.now();
    const record = {
      userId,
      purpose: route.purpose,
      promptVersion: route.promptVersion,
      model: MODEL,
      mode: 'server' as const,
    };

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: 'invalid_body' }, 400);
    }

    const parsed = route.input.safeParse(body);
    if (!parsed.success) return json(request, { error: 'invalid_body' }, 400);

    // Before the key check, not after: a deployment without a model still must
    // not be the thing that decides whether somebody in crisis is noticed.
    const prose = route.prose?.(parsed.data) ?? '';
    if (prose.trim() !== '' && scanText(prose).crisis) {
      await logCall(elevated, {
        ...record,
        outcome: 'refused_crisis',
        latencyMs: Date.now() - started,
      });
      // The caller ran the same scan before it got here and has its own
      // containment path. Reaching this means the two disagreed, which
      // `runAi` surfaces rather than papers over.
      return json(request, { error: 'refused_crisis' }, 403);
    }

    // A declared state, not a failure: `runAi` reads this and falls back to
    // the curated fixtures, which is a supported way to run a deployment.
    if (!hasKey()) return json(request, { error: 'no_model' }, 503);

    // Before `enrich`, so a refused turn does not spend an ephemeris call
    // either. After the key check, so a deployment with no model is not asked
    // to run two queries to say so.
    const refusal = await refuseForSpend(elevated, userId, route.purpose);
    if (refusal) {
      await logCall(elevated, {
        ...record,
        outcome: 'refused_quota',
        latencyMs: Date.now() - started,
        errorKind: refusal.reason,
      });
      return json(request, { error: 'spend_limit', scope: refusal.reason }, 429);
    }

    try {
      const input = route.enrich ? await route.enrich(parsed.data) : parsed.data;
      const generated = await generate({
        system: route.system,
        user: route.user(input),
        schema: route.output,
        maxTokens: MAX_OUTPUT_TOKENS[route.purpose],
        ...(route.effort ? { effort: route.effort } : {}),
      });

      const rejection = route.check?.(generated.value, input);
      if (rejection) throw new ModelError(rejection, 'copy_violation');

      await logCall(elevated, {
        ...record,
        outcome: 'ok',
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        latencyMs: Date.now() - started,
      });

      return json(request, {
        result: generated.value,
        input_tokens: generated.inputTokens,
        output_tokens: generated.outputTokens,
      });
    } catch (error) {
      const kind = error instanceof ModelError ? error.kind : 'api_error';
    const detail = error instanceof ModelError && error.detail ? `${kind}:${error.detail}` : kind;
      // `api_error:authentication_error` rather than `api_error`, so a bad
      // key and an unreachable model are distinguishable from the ledger.
      const detail = error instanceof ModelError && error.detail ? `${kind}:${error.detail}` : kind;
      await logCall(elevated, {
        ...record,
        outcome: kind,
        latencyMs: Date.now() - started,
        errorKind: detail,
      });
      // The detail does not travel: an upstream error message can carry the
      // request back out, and the request is what these functions exist to
      // keep from leaking.
      return json(request, { error: 'model_failed', kind }, 502);
    }
  };
}
