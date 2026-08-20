import keywords from '@data/crisis-keywords.json' with { type: 'json' };

/**
 * Layer 1 crisis detection — deterministic, PDR 6.4.
 *
 * Runs in front of every free-text surface (onboarding, chat, meditation
 * intent) before a single token is spent on the model. Layer 2 is the model
 * itself returning `detected_phase: 'crisis'` on subtler signals; this file
 * only implements Layer 1.
 *
 * No React, no storage, no browser API. Meant to be copied into
 * `supabase/functions/_shared/lib/safety.ts` unchanged.
 *
 * The matching algorithm is not in the vault. PDR 6.4 specifies it and notes
 * that without it the keyword list is unusable — a substring match turns
 * "mi terapeuta me sigue en Instagram" into a report of stalking.
 */

export type CrisisSeverity = 'high' | 'low';

/**
 * PDR 5.9 lists five categories. `indirecto` is added here because the low
 * severity path is raised by accumulated indirect markers that belong to no
 * single category, and recording one of the five would overclaim what was
 * actually detected. The SQL column is `text`, not an enum, so this widens
 * nothing in the eventual schema.
 */
export type CrisisCategory = 'ideacion' | 'autolesion' | 'abuso' | 'psicosis' | 'panico' | 'indirecto';

export type IdeationAnswer = 'no' | 'fugaces_sin_plan' | 'frecuentes' | 'plan_o_intencion';

export type ClinicalBasics = {
  ideation_6m?: IdeationAnswer;
  in_treatment?: boolean;
  psychiatric_medication?: boolean;
  prefer_not_to_say?: string[];
};

export type CrisisDetection = {
  severity: CrisisSeverity;
  category: CrisisCategory;
  layer: 'deterministic';
  /** Which terms fired. Useful for the false-positive review queue. */
  matched: string[];
  /**
   * PDR 5.9 privacy note: the vault stores the triggering text, which is
   * sensitive clinical data. Capped at 200 characters around the match.
   */
  excerpt: string;
  /** Set when the verdict came from the clinical answer, not from the text. */
  from_clinical_answer?: true;
};

export type SafetyVerdict = { crisis: false } | ({ crisis: true } & CrisisDetection);

const EXCERPT_MAX = 200;

/** Lowercase, strip diacritics, collapse whitespace. PDR 6.4 step 1. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

type Token = { value: string; start: number; end: number };

/**
 * Split into word tokens, keeping each token's offset in the normalised text
 * so an excerpt can be cut around a match.
 *
 * Tokenising rather than running a regex over the raw string is what gives
 * word-boundary matching for free, and makes "the four tokens before the
 * match" a countable thing rather than a character guess.
 */
function tokenize(normalized: string): Token[] {
  const tokens: Token[] = [];
  for (const match of normalized.matchAll(/[\p{L}\p{N}]+/gu)) {
    const value = match[0];
    const start = match.index;
    tokens.push({ value, start, end: start + value.length });
  }
  return tokens;
}

/** Index of the first token where `phrase` matches, or -1. */
function findPhrase(tokens: readonly Token[], phrase: readonly string[]): number {
  if (phrase.length === 0) return -1;
  outer: for (let i = 0; i + phrase.length <= tokens.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (tokens[i + j]?.value !== phrase[j]) continue outer;
    }
    return i;
  }
  return -1;
}

const WINDOW = keywords.suppressors.window_tokens;

const toPhrases = (terms: readonly string[]) => terms.map((t) => normalize(t).split(' '));

/** Always suppress: the person is denying it, or quoting fiction, a dream or
 *  a distant past. */
const ALWAYS_SUPPRESS = [
  ...toPhrases(keywords.suppressors.negation.terms),
  ...toPhrases(keywords.suppressors.reported_speech.terms),
];

/** Suppress only when the user is not the object of the matched term. */
const OTHER_SUBJECT = toPhrases(keywords.suppressors.other_subject.terms);

/**
 * A term whose first token is "me" puts the user on the receiving end. In
 * that position a nearby person reference names the *perpetrator*, not a
 * different subject — "mi ex me persigue" is a disclosure about the user.
 */
function userIsObject(phrase: readonly string[]): boolean {
  return phrase[0] === 'me';
}

/**
 * Whether a suppressor sits in the tokens immediately before a match.
 *
 * Only the tokens *before* the match are examined, never the match itself.
 * That matters because several ideation terms legitimately start with "no"
 * ("no quiero vivir"); reading that "no" as a negation would suppress exactly
 * the phrases the detector exists to catch.
 */
function isSuppressed(
  tokens: readonly Token[],
  matchIndex: number,
  phrase: readonly string[],
): boolean {
  const preceding = tokens.slice(Math.max(0, matchIndex - WINDOW), matchIndex);
  if (preceding.length === 0) return false;

  if (ALWAYS_SUPPRESS.some((s) => findPhrase(preceding, s) !== -1)) return true;
  if (userIsObject(phrase)) return false;
  return OTHER_SUBJECT.some((s) => findPhrase(preceding, s) !== -1);
}

function excerptAround(normalized: string, token: Token | undefined): string {
  if (!token) return normalized.slice(0, EXCERPT_MAX);
  const half = Math.floor(EXCERPT_MAX / 2);
  const start = Math.max(0, token.start - half);
  return normalized.slice(start, start + EXCERPT_MAX);
}

type CategoryKey = keyof typeof keywords.categories;

const CATEGORY_KEYS = Object.keys(keywords.categories) as CategoryKey[];

const DIRECT = CATEGORY_KEYS.map((key) => ({
  category: key as CrisisCategory,
  terms: keywords.categories[key].terms.map((term) => ({
    raw: term,
    phrase: normalize(term).split(' '),
  })),
}));

const INDIRECT = keywords.indirect.terms.map((term) => ({
  raw: term,
  phrase: normalize(term).split(' '),
}));

/**
 * Scan a single piece of free text.
 *
 * One direct term raises high severity. Two *distinct* indirect terms in the
 * same text raise low severity — PDR 6.4 step 4 is explicit that indirect
 * markers do not accumulate across screens, which is what stops a slow drip
 * of ordinary weariness from eventually locking someone out.
 */
export function scanText(text: string): SafetyVerdict {
  const normalized = normalize(text);
  if (!normalized) return { crisis: false };
  const tokens = tokenize(normalized);

  for (const { category, terms } of DIRECT) {
    for (const term of terms) {
      const at = findPhrase(tokens, term.phrase);
      if (at === -1 || isSuppressed(tokens, at, term.phrase)) continue;
      return {
        crisis: true,
        severity: 'high',
        category,
        layer: 'deterministic',
        matched: [term.raw],
        excerpt: excerptAround(normalized, tokens[at]),
      };
    }
  }

  const hits: { raw: string; at: number }[] = [];
  for (const term of INDIRECT) {
    const at = findPhrase(tokens, term.phrase);
    if (at === -1 || isSuppressed(tokens, at, term.phrase)) continue;
    hits.push({ raw: term.raw, at });
  }

  if (hits.length >= keywords.indirect.min_distinct) {
    const first = hits[0];
    return {
      crisis: true,
      severity: 'low',
      category: 'indirecto',
      layer: 'deterministic',
      matched: hits.map((h) => h.raw),
      excerpt: excerptAround(normalized, first ? tokens[first.at] : undefined),
    };
  }

  return { crisis: false };
}

/**
 * The clinical screen's ideation answer, which bypasses the text scan
 * entirely. PDR 6.4: `plan_o_intencion` is high severity on its own.
 */
export function scanClinicalBasics(basics: ClinicalBasics | undefined): SafetyVerdict {
  if (basics?.ideation_6m !== 'plan_o_intencion') return { crisis: false };
  return {
    crisis: true,
    severity: 'high',
    category: 'ideacion',
    layer: 'deterministic',
    matched: ['clinical_basics.ideation_6m=plan_o_intencion'],
    excerpt: '',
    from_clinical_answer: true,
  };
}

/**
 * Layer 1 over everything a surface collected. The clinical answer is checked
 * first: it is an explicit statement, not an inference from phrasing, and
 * should not be outranked by a keyword hit.
 */
export function detectCrisis(input: {
  texts?: readonly (string | undefined | null)[];
  clinicalBasics?: ClinicalBasics;
}): SafetyVerdict {
  const clinical = scanClinicalBasics(input.clinicalBasics);
  if (clinical.crisis) return clinical;

  let lowest: SafetyVerdict = { crisis: false };
  for (const text of input.texts ?? []) {
    if (!text) continue;
    const verdict = scanText(text);
    if (!verdict.crisis) continue;
    if (verdict.severity === 'high') return verdict;
    if (!lowest.crisis) lowest = verdict;
  }
  return lowest;
}

/**
 * PDR 7.2: whether the person's clinical picture should exclude removing
 * modalities from the pool.
 *
 * Note that this is deliberately broader than the crisis check — `frecuentes`
 * ideation is not a crisis but is a reason not to recommend constellations.
 */
export function isClinicallyVulnerable(input: {
  clinicalBasics?: ClinicalBasics;
  recentCrisisWithin30Days?: boolean;
}): boolean {
  const ideation = input.clinicalBasics?.ideation_6m;
  return (
    ideation === 'frecuentes' ||
    ideation === 'plan_o_intencion' ||
    input.clinicalBasics?.psychiatric_medication === true ||
    input.recentCrisisWithin30Days === true
  );
}

/**
 * Derived risk level passed into the chat context. PDR 10.2: the raw clinical
 * text is never handed to the model on every turn — fewer tokens, and less
 * surface for it to leak back out.
 */
export function riskLevel(input: {
  clinicalBasics?: ClinicalBasics;
  recentCrisisWithin30Days?: boolean;
}): 'none' | 'elevated' | 'high' {
  if (input.clinicalBasics?.ideation_6m === 'plan_o_intencion') return 'high';
  if (isClinicallyVulnerable(input)) return 'elevated';
  if (input.clinicalBasics?.ideation_6m === 'fugaces_sin_plan') return 'elevated';
  return 'none';
}

/** PDR 6.4 step 5: one admin notification per person per 6 hours. */
export const CRISIS_NOTIFICATION_WINDOW_MS = 6 * 60 * 60 * 1000;

export function shouldNotifyAdmin(lastNotifiedAt: number | null, now: number): boolean {
  if (lastNotifiedAt === null) return true;
  return now - lastNotifiedAt >= CRISIS_NOTIFICATION_WINDOW_MS;
}
