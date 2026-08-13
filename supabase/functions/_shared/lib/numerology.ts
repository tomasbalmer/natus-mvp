import type { Numerology } from './schemas/index.ts';

/**
 * Pythagorean numerology, PDR 6.2.
 *
 * Calculated here and handed to the model as settled facts, with the
 * instruction not to recompute them. Models are unreliable at arithmetic and
 * these numbers are the one part of the Soul Map that has a right answer.
 *
 * No React, no storage, no browser API — copied into
 * `supabase/functions/_shared/lib/numerology.ts` unchanged.
 */

export class NumerologyInputError extends Error {}

/** PDR 6.2. 1: A J S · 2: B K T · 3: C L U · 4: D M V · 5: E N W · 6: F O X · 7: G P Y · 8: H Q Z · 9: I R */
const LETTER_VALUES: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9,
};

/** A E I O U. Y is always a consonant — a deterministic rule, chosen over the
 *  positional heuristic some traditions use, because a demo that gives
 *  different numbers for the same name is worse than one that picks a
 *  convention and documents it. PDR 6.2 rule 2. */
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

const MASTERS = new Set([11, 22, 33]);

/** PDR 6.2, transcribed. Reduction halts on a master number. */
export function reduce(n: number): number {
  while (n > 9 && !MASTERS.has(n)) {
    n = String(n)
      .split('')
      .reduce((a, d) => a + Number(d), 0);
  }
  return n;
}

/**
 * Uppercase, strip diacritics, drop everything outside A-Z.
 *
 * This folds N-with-tilde onto N, which gives it the value 5. That is a
 * convention rather than a universal consensus — Spanish numerology
 * traditions differ — and PDR 6.2 rule 1 settles it this way. Documented
 * because someone will eventually ask why Muñoz and Munoz agree.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

function sumLetters(letters: string, filter?: (ch: string) => boolean): number {
  let total = 0;
  for (const ch of letters) {
    if (filter && !filter(ch)) continue;
    total += LETTER_VALUES[ch] ?? 0;
  }
  return total;
}

/**
 * Life path, reduced per component. PDR 6.2 rule 4: day, month and year are
 * each reduced before being summed, then the total is reduced. That variant
 * preserves the most master numbers, which is the whole reason the tradition
 * cares about the order of operations.
 */
export function lifePath(isoDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new NumerologyInputError(`Expected YYYY-MM-DD, received "${isoDate}"`);

  const [, year, month, day] = match as unknown as [string, string, string, string];
  const digitSum = (s: string) => s.split('').reduce((a, d) => a + Number(d), 0);

  const parts = [reduce(Number(day)), reduce(Number(month)), reduce(digitSum(year))];
  return reduce(parts.reduce((a, b) => a + b, 0));
}

export function computeNumerology(input: {
  legalBirthName: string;
  birthDate: string;
}): Numerology {
  const letters = normalizeName(input.legalBirthName);
  if (letters.length === 0) {
    throw new NumerologyInputError('The name has no letters the Pythagorean table can read');
  }

  const life_path = lifePath(input.birthDate);
  const expression = reduce(sumLetters(letters));
  const soul_urge = reduce(sumLetters(letters, (ch) => VOWELS.has(ch)));
  const personality = reduce(sumLetters(letters, (ch) => !VOWELS.has(ch)));
  const birthday = reduce(Number(input.birthDate.slice(8, 10)));

  const all = [life_path, expression, soul_urge, personality, birthday];

  return {
    life_path,
    expression,
    soul_urge,
    personality,
    birthday,
    master_numbers_present: [...new Set(all.filter((n) => MASTERS.has(n)))].sort((a, b) => a - b),
    algorithm_version: 'pythagorean-v1',
  };
}

/** Display labels for the five numbers. Spanish, because they are shown. */
export const NUMBER_LABELS: Record<keyof Omit<Numerology, 'master_numbers_present' | 'algorithm_version'>, string> = {
  life_path: 'Camino de vida',
  expression: 'Expresión',
  soul_urge: 'Alma',
  personality: 'Personalidad',
  birthday: 'Cumpleaños',
};
