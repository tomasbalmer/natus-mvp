import { describe, expect, it } from 'vitest';
import {
  NumerologyInputError,
  computeNumerology,
  lifePath,
  normalizeName,
  reduce,
} from './numerology';

/**
 * Expected values are computed by hand and the arithmetic is written out, so
 * a reviewer can check the test rather than the test checking the code
 * against itself. Snapshotting whatever the implementation produced would
 * assert nothing at all.
 */

describe('reduce', () => {
  it('reduces to a single digit', () => {
    expect(reduce(19)).toBe(1); // 1+9=10 -> 1+0=1
    expect(reduce(26)).toBe(8); // 2+6=8
    expect(reduce(118)).toBe(1); // 1+1+8=10 -> 1
  });

  it('leaves single digits alone', () => {
    expect(reduce(7)).toBe(7);
    expect(reduce(0)).toBe(0);
  });

  it('halts on master numbers', () => {
    expect(reduce(11)).toBe(11);
    expect(reduce(22)).toBe(22);
    expect(reduce(33)).toBe(33);
  });

  it('does not resurrect a master from a larger number', () => {
    // 29 -> 2+9 = 11, which is a master and stops there.
    expect(reduce(29)).toBe(11);
    // 92 -> 9+2 = 11 as well.
    expect(reduce(92)).toBe(11);
    // 47 -> 4+7 = 11.
    expect(reduce(47)).toBe(11);
  });
});

describe('name normalisation', () => {
  it('strips accents', () => {
    expect(normalizeName('José María')).toBe('JOSEMARIA');
  });

  it('folds the enye onto N, which gives it the value 5', () => {
    // PDR 6.2 rule 1. A convention, not a universal consensus — this test is
    // what stops it drifting silently.
    expect(normalizeName('Muñoz')).toBe('MUNOZ');
  });

  it('drops punctuation, spaces and digits', () => {
    expect(normalizeName("O'Brien-Smith 3rd")).toBe('OBRIENSMITHRD');
  });

  it('makes Muñoz and Munoz identical', () => {
    const a = computeNumerology({ legalBirthName: 'Muñoz', birthDate: '1990-01-01' });
    const b = computeNumerology({ legalBirthName: 'Munoz', birthDate: '1990-01-01' });
    expect(a).toEqual(b);
  });
});

describe('life path — reduced per component, PDR 6.2 rule 4', () => {
  it('1990-01-01 is 3', () => {
    // day 1 -> 1 · month 1 -> 1 · year 1+9+9+0=19 -> 10 -> 1
    // 1+1+1 = 3
    expect(lifePath('1990-01-01')).toBe(3);
  });

  it('1990-06-04 is a master 11', () => {
    // day 4 -> 4 · month 6 -> 6 · year 1990 -> 1
    // 4+6+1 = 11, a master, so reduction stops
    expect(lifePath('1990-06-04')).toBe(11);
  });

  it('2000-09-29 is a master 22', () => {
    // day 29 -> 2+9 = 11 · month 9 -> 9 · year 2+0+0+0 = 2
    // 11+9+2 = 22
    expect(lifePath('2000-09-29')).toBe(22);
  });

  it('1901-11-29 is a master 33', () => {
    // day 29 -> 11 · month 11 -> 11 · year 1+9+0+1 = 11
    // 11+11+11 = 33
    expect(lifePath('1901-11-29')).toBe(33);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(() => lifePath('04/06/1990')).toThrow(NumerologyInputError);
  });
});

describe('the five numbers', () => {
  it('computes a three-letter name by hand', () => {
    // ANA: A=1 N=5 A=1
    // expression 7 · vowels A,A = 2 · consonants N = 5
    const n = computeNumerology({ legalBirthName: 'Ana', birthDate: '1990-01-01' });
    expect(n.expression).toBe(7);
    expect(n.soul_urge).toBe(2);
    expect(n.personality).toBe(5);
  });

  it('treats Y as a consonant, always', () => {
    // MARY: M=4 A=1 R=9 Y=7 -> 21 -> 3
    // vowels: A only = 1 · consonants: M,R,Y = 4+9+7 = 20 -> 2
    const n = computeNumerology({ legalBirthName: 'Mary', birthDate: '1990-01-01' });
    expect(n.expression).toBe(3);
    expect(n.soul_urge).toBe(1);
    expect(n.personality).toBe(2);
  });

  it('handles the enye as N, value 5', () => {
    // MUNOZ: M=4 U=3 N=5 O=6 Z=8 -> 26 -> 8
    // vowels U,O = 3+6 = 9 · consonants M,N,Z = 4+5+8 = 17 -> 8
    const n = computeNumerology({ legalBirthName: 'Muñoz', birthDate: '1990-01-01' });
    expect(n.expression).toBe(8);
    expect(n.soul_urge).toBe(9);
    expect(n.personality).toBe(8);
  });

  it('finds a master in the soul urge of an accented name', () => {
    // JOSEMARIA: J=1 O=6 S=1 E=5 M=4 A=1 R=9 I=9 A=1 -> 37 -> 10 -> 1
    // vowels O,E,A,I,A = 6+5+1+9+1 = 22, a master
    // consonants J,S,M,R = 1+1+4+9 = 15 -> 6
    const n = computeNumerology({ legalBirthName: 'José María', birthDate: '1990-01-01' });
    expect(n.expression).toBe(1);
    expect(n.soul_urge).toBe(22);
    expect(n.personality).toBe(6);
  });

  it('handles a five-word compound name', () => {
    // MARIADELOSANGELESFERNANDEZ
    //   MARIA     4+1+9+9+1 = 24
    //   DE        4+5       = 9
    //   LOS       3+6+1     = 10
    //   ANGELES   1+5+7+5+3+5+1 = 27
    //   FERNANDEZ 6+5+9+5+1+5+4+5+8 = 48
    //   total 118 -> 10 -> 1
    // vowels 11+5+6+11+11 = 44 -> 8
    // consonants 118-44 = 74 -> 11, a master
    const n = computeNumerology({
      legalBirthName: 'María de los Ángeles Fernández',
      birthDate: '1990-01-01',
    });
    expect(n.expression).toBe(1);
    expect(n.soul_urge).toBe(8);
    expect(n.personality).toBe(11);
  });

  it('reduces the birthday number from the day of the month', () => {
    expect(
      computeNumerology({ legalBirthName: 'Ana', birthDate: '1990-01-29' }).birthday,
    ).toBe(11); // 2+9 = 11, a master
    expect(
      computeNumerology({ legalBirthName: 'Ana', birthDate: '1990-06-04' }).birthday,
    ).toBe(4);
  });
});

describe('the result as a whole', () => {
  it('collects every master present, deduplicated and sorted', () => {
    // 1901-11-29 gives life path 33 and birthday 11.
    const n = computeNumerology({ legalBirthName: 'José María', birthDate: '1901-11-29' });
    expect(n.life_path).toBe(33);
    expect(n.birthday).toBe(11);
    expect(n.soul_urge).toBe(22);
    expect(n.master_numbers_present).toEqual([11, 22, 33]);
  });

  it('reports no masters when there are none', () => {
    const n = computeNumerology({ legalBirthName: 'Ana', birthDate: '1990-01-01' });
    expect(n.master_numbers_present).toEqual([]);
  });

  it('stamps the algorithm version so a later change is detectable', () => {
    const n = computeNumerology({ legalBirthName: 'Ana', birthDate: '1990-01-01' });
    expect(n.algorithm_version).toBe('pythagorean-v1');
  });

  it('refuses a name the Pythagorean table cannot read', () => {
    // Rather than returning zeros, which would validate against the schema
    // and quietly present a meaningless reading.
    expect(() => computeNumerology({ legalBirthName: '   ', birthDate: '1990-01-01' })).toThrow(
      NumerologyInputError,
    );
    expect(() => computeNumerology({ legalBirthName: '陳', birthDate: '1990-01-01' })).toThrow(
      NumerologyInputError,
    );
  });
});
