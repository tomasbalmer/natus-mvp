import { json, preflight } from '../_shared/cors.ts';
import { authenticate, Unauthorized } from '../_shared/auth.ts';
import { currentQuota } from '../_shared/quota.ts';
import { logCall } from '../_shared/log.ts';
import { scanText } from '../_shared/lib/safety.ts';
import { resourcesForCountry } from '../_shared/lib/crisis-resources.ts';

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
 *   5. Model                 — not yet wired; see the note at step 5
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

const MODEL = 'claude-sonnet-4-6';
const PROMPT_VERSION = 'chat-v1-reconstructed';

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

  let body: { message?: unknown; country?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'invalid_body' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message : '';
  const country = typeof body.country === 'string' ? body.country : 'CL';
  if (message.trim() === '') return json(request, { error: 'empty_message' }, 400);

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
  // Not wired. The Anthropic key is not configured in any environment yet, and
  // the prompts still live in `src/ai/prompts`, which does not cross into
  // `_shared` — bringing them over is part of finishing this phase.
  //
  // Answering with a made-up reply would be worse than answering with nothing:
  // the client already holds curated fixtures and a `runAi` that falls back to
  // them, so `no_model` routes the turn down the path that has always worked
  // rather than inventing a second, lower-quality one here.
  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return json(
      request,
      { error: 'no_model', remaining: quota.remaining, unlimited: quota.unlimited },
      503,
    );
  }

  return json(request, { error: 'not_implemented' }, 501);
});
