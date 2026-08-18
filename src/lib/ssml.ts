/**
 * SSML in, an ordered queue of utterances and timed pauses out.
 *
 * PDR 9.5 has a server provider that speaks SSML directly. The browser's
 * SpeechSynthesis does not: it takes plain strings and has no concept of a
 * pause. In a guided meditation the pauses are not decoration — the four
 * seconds after "notá dónde apoya tu espalda" is where the practice actually
 * happens — so they have to survive the crossing, which is what this file is
 * for.
 *
 * Written as a tokeniser rather than with DOMParser so it runs unchanged in a
 * test process, in a worker, and eventually server-side. The grammar it has to
 * cope with is small and fixed by our own prompt.
 */

export type SsmlSegment =
  | { kind: 'speak'; text: string; rate: number }
  | { kind: 'pause'; ms: number };

/** PDR 9.4: slower than conversational speech, and not so slow it stalls. */
export const RATE_MIN = 0.78;
export const RATE_MAX = 0.88;
export const RATE_DEFAULT = 0.82;

/** PDR 9.4: silences long enough to be a breath, short enough not to be a gap. */
export const BREAK_MIN_MS = 2000;
export const BREAK_MAX_MS = 5000;

const TOKEN =
  /<break\s+time\s*=\s*"([\d.]+)\s*(ms|s)"\s*\/?>|<prosody\b([^>]*)>|<\/prosody\s*>|<\/?(?:speak|emphasis|p|s)\b[^>]*>/gi;

const RATE_ATTR = /rate\s*=\s*"([\d.]+)%"/i;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function clean(raw: string): string {
  return raw
    .replace(/&(?:amp|lt|gt|quot|apos);/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSsml(ssml: string): SsmlSegment[] {
  const segments: SsmlSegment[] = [];
  // A stack, because prosody nests: a slower passage inside an already slow
  // script has to return to the outer rate when it closes, not to the default.
  const rates: number[] = [RATE_DEFAULT];
  let cursor = 0;

  const flush = (upTo: number) => {
    const text = clean(ssml.slice(cursor, upTo));
    if (text) segments.push({ kind: 'speak', text, rate: rates[rates.length - 1] ?? RATE_DEFAULT });
  };

  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(ssml); match; match = TOKEN.exec(ssml)) {
    flush(match.index);
    cursor = match.index + match[0].length;

    const [, breakValue, breakUnit, prosodyAttrs] = match;

    if (breakValue !== undefined) {
      const value = Number(breakValue);
      segments.push({ kind: 'pause', ms: Math.round(breakUnit === 's' ? value * 1000 : value) });
      continue;
    }

    if (prosodyAttrs !== undefined) {
      const rate = RATE_ATTR.exec(prosodyAttrs)?.[1];
      rates.push(rate ? Number(rate) / 100 : (rates[rates.length - 1] ?? RATE_DEFAULT));
      continue;
    }

    // A closing prosody. Never empty the stack — a stray `</prosody>` in model
    // output should not leave the rest of the script speechless.
    if (/^<\/prosody/i.test(match[0]) && rates.length > 1) rates.pop();
  }

  flush(ssml.length);
  return segments;
}

/** How long the whole thing takes, for the duration choice and the progress
 *  bar. Spoken Spanish sits near 150 words per minute; the rate scales it. */
export function estimateDurationMs(segments: readonly SsmlSegment[], wordsPerMinute = 150): number {
  return segments.reduce((total, segment) => {
    if (segment.kind === 'pause') return total + segment.ms;
    const words = segment.text.split(/\s+/).filter(Boolean).length;
    return total + (words / (wordsPerMinute * segment.rate)) * 60_000;
  }, 0);
}

/** The plain transcript, for the text shown beside the audio. */
export function transcriptOf(segments: readonly SsmlSegment[]): string {
  return segments
    .filter((s): s is Extract<SsmlSegment, { kind: 'speak' }> => s.kind === 'speak')
    .map((s) => s.text)
    .join(' ');
}

export type SsmlProblem = { kind: 'rate' | 'break' | 'empty'; detail: string };

/**
 * The generation rules of PDR 9.4, checked against a parsed script.
 *
 * Kept separate from parsing: the player has to cope with whatever it is
 * given, while generation has to be held to the contract. The fixtures are
 * run through this in their tests, so a hand-written script that drifts out of
 * the prosody band fails rather than shipping.
 */
export function validateMeditation(segments: readonly SsmlSegment[]): SsmlProblem[] {
  const problems: SsmlProblem[] = [];

  if (segments.filter((s) => s.kind === 'speak').length === 0) {
    problems.push({ kind: 'empty', detail: 'the script has nothing to say' });
  }

  for (const segment of segments) {
    if (segment.kind === 'speak') {
      if (segment.rate < RATE_MIN || segment.rate > RATE_MAX) {
        problems.push({
          kind: 'rate',
          detail: `rate ${Math.round(segment.rate * 100)}% is outside ${RATE_MIN * 100}-${RATE_MAX * 100}%`,
        });
      }
      continue;
    }
    if (segment.ms < BREAK_MIN_MS || segment.ms > BREAK_MAX_MS) {
      problems.push({
        kind: 'break',
        detail: `break of ${segment.ms}ms is outside ${BREAK_MIN_MS}-${BREAK_MAX_MS}ms`,
      });
    }
  }

  return problems;
}
