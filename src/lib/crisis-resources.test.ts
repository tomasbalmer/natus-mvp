import { describe, expect, it } from 'vitest';
import { MVP_COUNTRIES, resourcesForCountry, telHref } from './crisis-resources.ts';

/**
 * The honest-framing criterion of Phase 10, over the one screen where being
 * wrong costs the most.
 *
 * Two properties, checked for every country and for the countries that are not
 * one: there is always something to call, and the screen never implies the
 * numbers were verified when they were not.
 */

const OUTSIDE = ['ES', 'BR', 'US', 'xx', '', undefined];

describe('there is always somewhere to call', () => {
  it.each([...MVP_COUNTRIES, ...OUTSIDE])('%s reaches the international directory', (country) => {
    const set = resourcesForCountry(country);
    expect(set.fallback.url).toContain('findahelpline');
    expect(set.fallback.name.length).toBeGreaterThan(0);
  });

  it.each(MVP_COUNTRIES)('%s has local numbers, including an emergency one', (country) => {
    const set = resourcesForCountry(country);
    expect(set.resources.length).toBeGreaterThan(0);
    expect(set.resources.some((r) => r.type === 'emergency')).toBe(true);
  });

  it.each(OUTSIDE)('%s has no local numbers and does not pretend otherwise', (country) => {
    expect(resourcesForCountry(country).resources).toEqual([]);
  });
});

describe('the unverified notice', () => {
  it.each(MVP_COUNTRIES)('%s reports unverified while verified_at is null', (country) => {
    // PDR 6.4 calls telephone verification an absolute launch blocker. Showing
    // numbers while quietly implying they were checked is the failure this
    // flag exists to prevent, so it stays true until the data changes.
    expect(resourcesForCountry(country).unverified).toBe(true);
  });

  it.each(OUTSIDE)('%s reports unverified because there is nothing local to stand behind', (country) => {
    expect(resourcesForCountry(country).unverified).toBe(true);
  });

  it('is case-insensitive about the country code', () => {
    expect(resourcesForCountry('cl').resources).toEqual(resourcesForCountry('CL').resources);
  });
});

describe('the dial link', () => {
  it.each([
    ['600 360 7777', 'tel:6003607777'],
    ['+54 11 5275-1135', 'tel:+541152751135'],
    ['135', 'tel:135'],
  ])('%s dials %s', (contact, expected) => {
    expect(telHref(contact)).toBe(expected);
  });
});
