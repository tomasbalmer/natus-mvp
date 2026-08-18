import { json, preflight } from '../_shared/cors.ts';
import { authenticate, Unauthorized } from '../_shared/auth.ts';
import { currentQuota } from '../_shared/quota.ts';
import { logCall } from '../_shared/log.ts';
import { scanText } from '../_shared/lib/safety.ts';
import { resourcesForCountry } from '../_shared/lib/crisis-resources.ts';
import { chatContextSchema, chatEnvelopeSchema } from '../_shared/chat-request.ts';
import { MODEL, ModelError, generate, hasKey } from '../_shared/anthropic.ts';
import { chatResponseSchema } from '../_shared/lib/schemas/index.ts';
import {
  CHAT_PROMPT_VERSION,
  CHAT_SYSTEM_PROMPT,
  buildChatUserMessage,
} from '../_shared/prompts/chat.ts';

/**
 * The chat turn, server-side.
 *
 * The ordering below is the product, not an implementation detail:
 *
 *   1. CORS preflight        — hygiene, not access control. See cors.ts
 *   2. JWT                   — the access control. The user is derived from
 *                              the token, never read from the body
 *   3. Layer 1 safety        — deterministic, before anything else can answer
 *   4. Quota                 — after safety, never before
 *   5. Model                 — the key lives here and nowhere else
 *
 * **Safety precedes the quota and that ordering is load-bearing.** PDR 1.6
 * forbids meeting someone in crisis with a commercial fallback. If the quota
 * ran first, a person at zero remaining who typed something desperate would be
 * shown a payment screen instead of a hotline. `DECISIONS.md` §5 makes safety
 * deterministic and in front of everything; this is what "in front" means when
 * there is a paywall behind it.
 *
 * A crisis turn also costs nothing, enforced here rather than trusted to the
 * client: `refused_crisis` is logged and the quota is never consulted.
 */

/**
 * Read from the prompt rather than restated. A version that has to be kept in
 * step by hand is a version that eventually labels the ledger with the wrong
 * prompt, and the ledger is what says which prompt produced which cost.
 */
const PROMPT_VERSION = CHAT_PROMPT_VERSION;

Deno.serve(async (request) => {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'invalid_body' }, 400);
  }

  // Only what safety needs. The model context is parsed at step 5, so that a
  // malformed one cannot come between a person and a hotline.
  const envelope = chatEnvelopeSchema.safeParse(body);
  if (!envelope.success) return json(request, { error: 'invalid_body' }, 400);

  const { message, country } = envelope.data;

  // ── 3. Safety, deterministically, in front ────────────────────────────────
  const verdict = scanText(message);
  if (verdict.crisis) {
    await logCall(elevated, {
      userId,
      purpose: 'chat',
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      mode: 'fixture',
      outcome: 'refused_crisis',
      latencyMs: Date.now() - started,
    });

    // No model call, no quota consulted, nothing charged. The response is
    // containment and the resources for the person's country, with the
    // international fallback that `resourcesForCountry` always includes.
    return json(request, {
      type: 'crisis',
      severity: verdict.severity,
      category: verdict.category,
      resources: resourcesForCountry(country),
      counted: false,
    });
  }

  // ── 4. Quota, after safety ────────────────────────────────────────────────
  const quota = await currentQuota(elevated, userId);
  if (quota.remaining <= 0) {
    await logCall(elevated, {
      userId,
      purpose: 'chat',
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      mode: 'fixture',
      outcome: 'refused_quota',
      latencyMs: Date.now() - started,
    });
    return json(request, { error: 'quota_exhausted', used: quota.used, remaining: 0 }, 402);
  }

  // ── 5. The model ──────────────────────────────────────────────────────────
  //
  // `no_model` is a declared state, not a failure. A deployment without a key
  // is the fixture demo, which runs every screen offline and has always
  // worked; `runAi` reads this exact code and falls back to the curated path.
  // Answering with something invented here would be worse than answering with
  // nothing, because the person could not tell the difference.
  if (!hasKey()) {
    return json(
      request,
      { error: 'no_model', remaining: quota.remaining, unlimited: quota.unlimited },
      503,
    );
  }

  const context = chatContextSchema.safeParse(body);
  if (!context.success) return json(request, { error: 'invalid_context' }, 400);

  // The prompt is built here, from the contract in `_shared/prompts`, and
  // never accepted from the caller. A function that takes a system prompt in
  // its body is a general-purpose model endpoint with somebody else's key in
  // it, whatever the rest of the file says it is.
  try {
    const generated = await generate({
      system: CHAT_SYSTEM_PROMPT,
      user: buildChatUserMessage({
        question: message,
        synthesis: context.data.synthesis,
        numerology: context.data.numerology,
        risk: context.data.risk,
        recommendedSlugs: context.data.recommendedSlugs,
        history: context.data.history,
      }),
      schema: chatResponseSchema,
    });

    await logCall(elevated, {
      userId,
      purpose: 'chat',
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      mode: 'server',
      outcome: 'ok',
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      latencyMs: Date.now() - started,
    });

    return json(request, {
      result: generated.value,
      input_tokens: generated.inputTokens,
      output_tokens: generated.outputTokens,
      remaining: quota.remaining - 1,
      unlimited: quota.unlimited,
    });
  } catch (error) {
    const kind = error instanceof ModelError ? error.kind : 'api_error';

    await logCall(elevated, {
      userId,
      purpose: 'chat',
      promptVersion: PROMPT_VERSION,
      model: MODEL,
      mode: 'server',
      outcome: kind,
      latencyMs: Date.now() - started,
      errorKind: kind,
    });

    // The turn is not charged and the detail does not travel: an upstream
    // error message can carry the request back to the caller, and the request
    // is what this whole file exists to keep from leaking.
    return json(request, { error: 'model_failed', kind }, 502);
  }
});
