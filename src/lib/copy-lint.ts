/**
 * The product's copy rules, made executable.
 *
 * PDR sections 1 and 7.5 state them as prose: never certainty, never an
 * order, never a promise of cure, never a percentage, and the chart suggests
 * rather than states. Prose rules get eroded — by a model on a bad day, by a
 * fixture written in a hurry, by whoever edits the prompt next.
 *
 * So they run as a lint, over model output and over the hand-written fixtures
 * alike. A fixture of mine that breaks a rule fails a test, which is the only
 * version of this that stays true.
 *
 * No React, no storage — copied into `_shared/lib` unchanged.
 */

export type CopyViolation = {
  rule: string;
  match: string;
  why: string;
};

type Rule = {
  id: string;
  pattern: RegExp;
  why: string;
};

const RULES: Rule[] = [
  {
    id: 'certainty',
    // PDR 7.5: never "esta es la terapia ideal para vos".
    pattern:
      /\b(?:la\s+)?(?:terapia|modalidad|pr[aá]ctica)\s+(?:ideal|perfecta|indicada|correcta)\b|\bes\s+lo\s+que\s+necesit[aá]s\b|\bsin\s+duda\b|\bdefinitivamente\b|\bte\s+garantiz/i,
    why: 'Absolute certainty. Modalities are possible paths, never the right answer.',
  },
  {
    id: 'cure',
    // PDR 7.5: never "esto va a resolver tu problema" / "esto te va a curar".
    pattern:
      /\b(?:va|van|vas)\s+a\s+(?:curar|sanar|resolver|solucionar|eliminar)\b|\bte\s+cura\b|\bcura\s+(?:la|el|tu)\b/i,
    why: 'A promise of cure. Nothing here treats anything.',
  },
  {
    id: 'command',
    // PDR 7.5 anti-pattern: "Debes meditar 10 minutos al día" is an order,
    // not an invitation. Every tip closes on a question instead.
    pattern: /\b(?:deb[eé]s|debes|ten[eé]s\s+que|tienes\s+que|hac[eé]lo\s+ya|es\s+obligatorio)\b/i,
    why: 'An order. Recommendations are invitations — PDR 1.5.',
  },
  {
    id: 'percentage',
    // The mockup's "98% match". A score implies a computed confidence that
    // does not exist, and PDR 7.3 is explicit that the ranking is ordered by
    // priority rather than arithmetic.
    pattern: /\b\d{1,3}\s*%/,
    why: 'A numeric score implies a precision the ranking does not have.',
  },
  {
    id: 'chart-determinism',
    // PDR 1.3: "tu carta sugiere", never "tu carta dice que".
    pattern:
      /\b(?:tu|la)\s+carta\s+(?:dice|indica|determina|confirma|demuestra|predice)\b|\bvas\s+a\s+conocer\b|\bte\s+va\s+a\s+pasar\b/i,
    why: 'Astrology as prediction. It is a lens for self-knowledge — PDR 1.3.',
  },
  {
    id: 'diagnosis',
    // PDR 1.2: the AI never diagnoses.
    pattern:
      /\b(?:ten[eé]s|tienes|sufr[ií]s|sufres|padec[eé]s)\s+(?:un|una|de)\s+(?:trastorno|depresi[oó]n|ansiedad\s+generalizada|tdah|toc|bipolaridad)\b|\btu\s+diagn[oó]stico\b/i,
    why: 'A diagnosis. The AI is a mirror, never a clinician — PDR 1.2.',
  },
  {
    id: 'first-person-emotion',
    // PDR 1.2: the AI never speaks in the first person with emotions.
    pattern: /\b(?:me\s+(?:emociona|entristece|alegra|conmueve|duele)|siento\s+mucho\s+que)\b/i,
    why: 'The AI speaking as if it felt something — PDR 1.2.',
  },
];

/**
 * Markup is not copy.
 *
 * Meditation scripts arrive as SSML, and `<prosody rate="82%">` is a speech
 * parameter, not a claim made to a person. Linting it as prose failed every
 * meditation on the percentage rule — in the fixture tests *and* in `runAi`,
 * so a real generated meditation would have been rejected too. Stripping tags
 * first costs nothing elsewhere: every rule here is about Spanish sentences,
 * and the words inside the tags are still linted.
 */
function prose(text: string): string {
  return text.replace(/<[^>]*>/g, ' ');
}

export function lintCopy(text: string): CopyViolation[] {
  const subject = prose(text);
  const violations: CopyViolation[] = [];
  for (const rule of RULES) {
    const match = rule.pattern.exec(subject);
    if (match) violations.push({ rule: rule.id, match: match[0], why: rule.why });
  }
  return violations;
}

/** Lint every string in a nested structure. Used over whole model payloads. */
export function lintDeep(value: unknown, path = '$'): (CopyViolation & { path: string })[] {
  if (typeof value === 'string') {
    return lintCopy(value).map((v) => ({ ...v, path }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => lintDeep(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => lintDeep(item, `${path}.${key}`));
  }
  return [];
}

/**
 * PDR 1.5 and 7.5: a tip closes on a micro-invitation phrased as a question.
 * Separate from the violation rules because it is a shape requirement rather
 * than a forbidden phrase.
 */
export function isInvitation(text: string): boolean {
  return text.trim().endsWith('?');
}

/** PDR 7.5: reasoning is two to four sentences. Not more, not less. */
export function countSentences(text: string): number {
  return text.split(/[.!?…]+(?:\s|$)/).filter((s) => s.trim().length > 0).length;
}
