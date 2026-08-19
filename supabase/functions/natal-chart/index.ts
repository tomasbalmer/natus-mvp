import { json, preflight } from '../_shared/cors.ts';
import { authenticate, Unauthorized } from '../_shared/auth.ts';
import { parseAstrologerSubject, resolveLocation } from '../_shared/astrology.ts';

const ENDPOINT = 'https://astrologer.p.rapidapi.com/api/v5/context/birth-chart';
const HOST = 'astrologer.p.rapidapi.com';
const TIMEOUT_MS = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

Deno.serve(async (request) => {
  const cors = preflight(request);
  if (cors) return cors;
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);

  try {
    await authenticate(request);
  } catch (error) {
    if (error instanceof Unauthorized) return json(request, { error: 'unauthorized' }, 401);
    return json(request, { error: 'misconfigured' }, 500);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'invalid_body' }, 400);
  }

  const subject = parseAstrologerSubject(isRecord(body) ? body.subject : null);
  if (!subject) return json(request, { error: 'invalid_birth_data' }, 400);

  const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
  if (!rapidApiKey) {
    return json(request, { error: 'astrologer_not_configured' }, 503);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const location = await resolveLocation(subject.city, subject.nation, controller.signal);
    if (!location) return json(request, { error: 'birth_place_not_found' }, 422);

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': HOST,
      },
      body: JSON.stringify({
        subject: { ...subject, ...location },
      }),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.status !== 'OK') {
      // Do not pass provider details through: they can reveal configuration,
      // and the UI has one useful recovery for every provider-side failure.
      return json(request, { error: 'astrologer_error' }, 502);
    }

    const context = payload.context;
    if (typeof context !== 'string' || context.trim() === '' || context.length > 250_000) {
      return json(request, { error: 'invalid_astrologer_response' }, 502);
    }

    return json(request, { status: 'OK', api_version: 'v5', context });
  } catch (error) {
    return json(
      request,
      { error: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network_error' },
      504,
    );
  } finally {
    clearTimeout(timer);
  }
});
