import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONSENT_TTL_MS,
  consentFor,
  deleteExternalProfile,
  isConsentActive,
  listComparisons,
  listConsents,
  listExternalProfiles,
  readableComparison,
  requestConsent,
  respondToConsent,
  revokeConsent,
  saveComparison,
  saveExternalProfile,
} from './comparison';
import { clearAll } from './db';
import type { ComparisonResult } from '@/lib/schemas';
import { installMemoryStorage } from './memory-storage.testing.ts';

beforeEach(() => {
  installMemoryStorage();
  clearAll();
});

const T0 = 1_000_000;
const SCOPE = { numerology: true, astro: false, soul_map_themes: true };

const RESULT = { prompt_version: 'test', headline: 'x' } as unknown as ComparisonResult;

function setup(now = T0) {
  const profile = saveExternalProfile(
    {
      display_name: 'Nico',
      legal_birth_name: 'Nicolas Perez',
      birth_date: '1988-02-09',
      birth_time: '',
      birth_city: '',
    },
    now,
  );
  const consent = requestConsent({ externalProfileId: profile.id, scope: SCOPE }, now);
  return { profile, consent };
}

describe('consent gates every read', () => {
  it('a pending request is not permission', () => {
    const { profile } = setup();
    saveComparison({
      externalProfileId: profile.id,
      consentId: 'c',
      result: RESULT,
      promptVersion: 'test',
      mode: 'fixture',
      now: T0,
    });
    expect(readableComparison(profile.id, T0)).toBeUndefined();
  });

  it('a granted consent opens it', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'granted', T0);
    saveComparison({
      externalProfileId: profile.id,
      consentId: consent.id,
      result: RESULT,
      promptVersion: 'test',
      mode: 'fixture',
      now: T0,
    });
    expect(readableComparison(profile.id, T0)?.external_profile_id).toBe(profile.id);
  });

  it('revoking closes it on the very next read', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'granted', T0);
    saveComparison({
      externalProfileId: profile.id,
      consentId: consent.id,
      result: RESULT,
      promptVersion: 'test',
      mode: 'fixture',
      now: T0,
    });
    revokeConsent(consent.id, T0 + 10);

    // The reading still exists in storage; what changed is that nothing will
    // hand it over. Re-checking on read is what makes revocation immediate
    // rather than eventual.
    expect(listComparisons()).toHaveLength(1);
    expect(readableComparison(profile.id, T0 + 11)).toBeUndefined();
  });

  it('a denial closes it too', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'denied', T0);
    expect(readableComparison(profile.id, T0)).toBeUndefined();
  });
});

describe('consent expires', () => {
  it('holds for fourteen days', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'granted', T0);
    expect(isConsentActive(consentFor(profile.id), T0 + CONSENT_TTL_MS - 1)).toBe(true);
  });

  it('and stops the day it runs out', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'granted', T0);
    // Silence is not permission indefinitely — PDR 8.2.
    expect(isConsentActive(consentFor(profile.id), T0 + CONSENT_TTL_MS)).toBe(false);
    expect(readableComparison(profile.id, T0 + CONSENT_TTL_MS)).toBeUndefined();
  });
});

describe('asking again', () => {
  it('replaces the previous request rather than leaving two answers', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'denied', T0);
    requestConsent({ externalProfileId: profile.id, scope: SCOPE }, T0 + 100);

    expect(listConsents()).toHaveLength(1);
    expect(consentFor(profile.id)?.status).toBe('pending');
  });
});

describe('the owner can delete the other person', () => {
  it('takes the consent and the reading with it', () => {
    const { profile, consent } = setup();
    respondToConsent(consent.id, 'granted', T0);
    saveComparison({
      externalProfileId: profile.id,
      consentId: consent.id,
      result: RESULT,
      promptVersion: 'test',
      mode: 'fixture',
      now: T0,
    });

    deleteExternalProfile(profile.id);

    expect(listExternalProfiles()).toHaveLength(0);
    expect(listConsents()).toHaveLength(0);
    expect(listComparisons()).toHaveLength(0);
  });
});
