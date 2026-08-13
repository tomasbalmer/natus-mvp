/**
 * Which origin to allow, as a pure function.
 *
 * It lives here rather than in `supabase/functions/_shared/cors.ts` because
 * the local Supabase gateway rewrites CORS headers on the way out — every
 * response comes back `Access-Control-Allow-Origin: *` regardless of what the
 * function set. That makes the decision unobservable end-to-end on a laptop,
 * and an untested allow-list is how a wildcard reaches production.
 *
 * So the decision is separated from the delivery and tested here.
 *
 * **None of this is access control.** The site is served from
 * `https://<owner>.github.io/natus-mvp/`, and an origin is scheme, host and
 * port — the path is not part of it. The origin to allow is therefore the
 * whole `github.io` subdomain, shared with every other repository that owner
 * publishes. There is no narrower thing to name. The JWT check is the control;
 * this keeps honest browsers from making requests nobody intended.
 *
 * No React, no storage, no browser API.
 */

/**
 * The value for `Access-Control-Allow-Origin`.
 *
 * Returns null when the caller's origin is not on the list, and the caller
 * should then send no header at all rather than a fallback. Naming some other
 * origin would be a lie to the browser; naming `*` would be worse, since it
 * also makes the response readable by anything.
 */
export function allowOrigin(requestOrigin: string | null, allowed: readonly string[]): string | null {
  if (!requestOrigin) return null;
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

/** Parse the `ALLOWED_ORIGINS` environment value. Empty entries are dropped so
 *  that a trailing comma cannot produce an entry matching the empty origin. */
export function parseAllowedOrigins(configured: string | undefined | null): string[] {
  if (!configured) return [];
  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
