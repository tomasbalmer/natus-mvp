import { describe, expect, it } from 'vitest';
import { emptyDraft } from '@/store/session';
import { hasNatalChartInput, NatalChartError, natalChartInput } from './natal-chart';
import { parseAstrologerSubject } from '@/lib/astrology';

describe('Astrologer natal chart input', () => {
  it('maps the onboarding fields to the provider subject', () => {
    const subject = natalChartInput({
      ...emptyDraft(),
      legal_birth_name: '  Ana Pérez  ',
      birth_date: '1990-06-04',
      birth_time: '08:05',
      birth_city: '  Santiago  ',
      birth_country: 'cl',
    });

    expect(subject).toEqual({
      name: 'Ana Pérez',
      year: 1990,
      month: 6,
      day: 4,
      hour: 8,
      minute: 5,
      city: 'Santiago',
      nation: 'CL',
    });
  });

  it.each([
    { legal_birth_name: '' },
    { birth_time: '' },
    { birth_city: '  ' },
    { birth_country: '' },
    { birth_country: 'Chile' },
  ])('refuses incomplete birth data: %o', (patch) => {
    const draft = {
      ...emptyDraft(),
      legal_birth_name: 'Ana Pérez',
      birth_date: '1990-06-04',
      birth_time: '08:05',
      birth_city: 'Santiago',
      birth_country: 'CL',
      ...patch,
    };

    expect(() => natalChartInput(draft)).toThrow(NatalChartError);
    expect(hasNatalChartInput(draft)).toBe(false);
  });

  it('recognizes when automatic calculation can run', () => {
    expect(
      hasNatalChartInput({
        ...emptyDraft(),
        legal_birth_name: 'Ana Pérez',
        birth_date: '1990-06-04',
        birth_time: '08:05',
        birth_city: 'Santiago',
        birth_country: 'CL',
      }),
    ).toBe(true);
  });
});

describe('Edge Function birth-data boundary', () => {
  const valid = {
    name: 'Ana Pérez',
    year: 1990,
    month: 6,
    day: 4,
    hour: 8,
    minute: 5,
    city: 'Santiago',
    nation: 'CL',
  };

  it('accepts and normalizes the exact provider shape', () => {
    expect(parseAstrologerSubject({ ...valid, nation: ' cl ' })).toEqual(valid);
  });

  it.each([
    { day: 31, month: 2 },
    { hour: 24 },
    { minute: 60 },
    { nation: 'Chile' },
    { city: '' },
    { longitude: -70.6 },
  ])('rejects invalid or incomplete provider input: %o', (patch) => {
    const input = patch.longitude ? patch : { ...valid, ...patch };
    expect(parseAstrologerSubject(input)).toBeNull();
  });
});
