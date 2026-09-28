import { json, preflight } from '../_shared/cors.ts';
import { authenticate, Unauthorized } from '../_shared/auth.ts';

const PER_USER_PER_HOUR = 20;
const KINDS = new Set(['render', 'error', 'rejection']);

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, max) : null;
}

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

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== 'object' || parsed === null) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json(request, { error: 'invalid_body' }, 400);
  }

  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : null;
  const message = text(body.message, 500);
  if (!kind || !message) return json(request, { error: 'invalid_body' }, 400);

  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await elevated
    .from('client_errors')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if ((count ?? 0) >= PER_USER_PER_HOUR) return json(request, { stored: false }, 429);

  const { error } = await elevated.from('client_errors').insert({
    user_id: userId,
    kind,
    message,
    stack: text(body.stack, 4_000),
    path: text(body.path, 200),
    user_agent: text(request.headers.get('User-Agent'), 300),
    release: text(body.release, 40),
  });
  if (error) return json(request, { error: 'store_failed' }, 500);

  return json(request, { stored: true });
});
