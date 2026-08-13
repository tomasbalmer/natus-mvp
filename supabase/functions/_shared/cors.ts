import { allowOrigin, parseAllowedOrigins } from './lib/cors.ts';

/**
 * CORS, and why it is not the security boundary.
 *
 * The site is served from `https://<owner>.github.io/natus-mvp/`, but an
 * origin is scheme, host and port — the path is not part of it. So the origin
 * this allows is `https://<owner>.github.io`, the **whole** subdomain, shared
 * with every other repository that owner publishes to Pages. Allowing it
 * authorises all of them equally, and there is no narrower thing to allow.
 *
 * Therefore: CORS keeps honest browsers from making requests nobody intended.
 * It stops nothing else — it is a browser convention, and `curl` has never
 * heard of it. **The JWT check in `auth.ts` is the access control.** Every
 * function must call it. This file is hygiene.
 *
 * The decision itself lives in `lib/cors.ts` and is unit-tested there, because
 * the local Supabase gateway rewrites these headers on the way out: every
 * response on a laptop comes back `Access-Control-Allow-Origin: *` whatever
 * the function set. That makes this file's effect unobservable locally, which
 * is exactly the condition under which a wildcard reaches production.
 *
 * The Edge runtime also answers no preflights for you. A function that omits
 * the OPTIONS branch below fails in a way that looks like it is down.
 */

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173'];

/**
 * Set `ALLOWED_ORIGINS` (comma-separated) per environment rather than editing
 * the default. Changing repository owner changes the origin, and
 * `docs/HANDOFF.md` keeps that class of thing as configuration — the same
 * reasoning that keeps `VITE_BASE` out of `vite.config.ts`.
 */
function allowed(): string[] {
  const configured = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
  return configured.length > 0 ? configured : DEFAULT_ORIGINS;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowOrigin(request.headers.get('Origin'), allowed());

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  // Omitted entirely when the origin is not allowed. Sending a different
  // origin would be a lie to the browser and `*` would be worse, since it
  // makes the response readable by anything.
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** The preflight. Returns null when the request is not one. */
export function preflight(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}
