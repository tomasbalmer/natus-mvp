import type { ComparisonBirth, SynastryAspect } from './lib/comparison-payload.ts';
export { parseAstrologerSubject, type AstrologerSubject } from './lib/astrology.ts';

const HOST = 'astrologer.p.rapidapi.com';
const GEOCODING_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const SYNASTRY_ENDPOINT = `https://${HOST}/api/v5/chart-data/synastry`;

export type Located = { latitude: number; longitude: number; timezone: string };

/** How many aspects reach the prompt. See the note where they are sorted. */
const MAX_ASPECTS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * City and ISO country to coordinates and an IANA timezone.
 *
 * Open-Meteo rather than a second astrology credential: the chart provider
 * would geocode too, through GeoNames, which is another account to hold and
 * another thing to be down. `DECISIONS.md` §11.
 *
 * Returns null rather than throwing. Every caller has the same recovery — say
 * the place could not be found and carry on without a chart — and an
 * exception would only make each of them write it out.
 */
export async function resolveLocation(
  city: string,
  nation: string,
  signal: AbortSignal,
): Promise<Located | null> {
  const url = new URL(GEOCODING_ENDPOINT);
  url.searchParams.set('name', city);
  url.searchParams.set('countryCode', nation);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'es');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload) || !Array.isArray(payload.results)) return null;
  const result = payload.results[0];
  if (!isRecord(result)) return null;

  const { latitude, longitude, timezone } = result;
  if (
    typeof latitude !== 'number' ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    longitude < -180 ||
    longitude > 180 ||
    typeof timezone !== 'string' ||
    timezone.trim() === ''
  ) {
    return null;
  }

  return { latitude, longitude, timezone };
}

/**
 * The aspects between two charts, from the ephemeris.
 *
 * **`include_relationship_score` is false and must stay false.** The same
 * endpoint will return a Ciro Discepolo compatibility number, and §7 forbids
 * match percentages anywhere in this product. §11 wrote the warning down
 * because `/compatibility-score` is the more obviously named of the two
 * routes; this is the same trap one field lower down, inside the route that
 * was chosen precisely to avoid it.
 *
 * `/chart-data/synastry` rather than `/context/synastry`, which would have
 * returned XML shaped for a model the way the natal chart does. The structure
 * is the point here: rule 5 is enforced by comparing what the model returned
 * against what the ephemeris sent, and that comparison needs a list, not
 * prose. The small serialiser it costs is written in `prompts/comparison.ts`.
 *
 * Names are labels. Astrologer puts `name` on the chart and does nothing else
 * with it, so two people's legal names have no reason to reach a third party
 * and do not.
 */
export async function synastryAspects(
  first: ComparisonBirth & Located,
  second: ComparisonBirth & Located,
  signal: AbortSignal,
): Promise<SynastryAspect[] | null> {
  const apiKey = Deno.env.get('RAPIDAPI_KEY');
  if (!apiKey) return null;

  const subject = (birth: ComparisonBirth & Located, label: string) => ({
    name: label,
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: birth.hour,
    minute: birth.minute,
    city: birth.city,
    nation: birth.nation,
    latitude: birth.latitude,
    longitude: birth.longitude,
    timezone: birth.timezone,
    // No `zodiac_type`. The first version sent 'Tropic' — the value
    // Kerykeion's own library uses — and the API wanted 'Tropical'; the
    // request was rejected and this function returned null, which the caller
    // reads as "no chart to cross". A wrong enum and no chart at all looked
    // identical from outside. The natal-chart function has never sent the
    // field and has always worked, so the default is the answer.
  });

  const response = await fetch(SYNASTRY_ENDPOINT, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': HOST,
    },
    body: JSON.stringify({
      first_subject: subject(first, 'A'),
      second_subject: subject(second, 'B'),
      include_house_comparison: false,
      // See above. Not a default being accepted — a decision being stated.
      include_relationship_score: false,
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.status !== 'OK') return null;
  if (!isRecord(payload.chart_data) || !Array.isArray(payload.chart_data.aspects)) return null;

  const aspects: SynastryAspect[] = [];
  for (const raw of payload.chart_data.aspects) {
    if (!isRecord(raw)) continue;
    const { p1_name, p2_name, aspect, orbit } = raw;
    if (
      typeof p1_name !== 'string' ||
      typeof p2_name !== 'string' ||
      typeof aspect !== 'string' ||
      typeof orbit !== 'number'
    ) {
      continue;
    }
    aspects.push({ a_body: p1_name, b_body: p2_name, type: aspect, orb: orbit });
  }

  // An empty list from a successful call is a real answer — two charts with
  // nothing inside orb — but it is indistinguishable here from a response
  // shape that changed under us. Null makes the caller say "no chart to
  // cross", which is true either way and never invents a reading.
  if (aspects.length === 0) return null;

  // The tightest few, not all of them.
  //
  // A full synastry returns thirty-odd aspects. Asking for a reading of each
  // produced two things that were both wrong: a model call that ran past its
  // forty-five second timeout, and — had it finished — a wall of thirty
  // paragraphs, which is a data dump rather than the material for a
  // conversation that PDR 8.5 asks for.
  //
  // Ordered by orb because that is what the tradition means by strength: an
  // aspect within a degree is exact, one at eight degrees is barely speaking.
  // Taking the tightest is the same choice an astrologer makes out loud.
  return [...aspects].sort((a, b) => Math.abs(a.orb) - Math.abs(b.orb)).slice(0, MAX_ASPECTS);
}
