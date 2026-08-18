import { read, write } from './db';
import type { ComparisonResult } from '@/lib/schemas';
import type { ComparisonScope } from '@/lib/comparison-payload';
import type { AiRunMode } from '@/ai/mode';

/**
 * `external_profiles`, `comparison_consents` and `chart_comparisons` from
 * PDR 5.8.
 *
 * The consent is the whole feature. In production it travels by email to a
 * real second person; here it is simulated between two local profiles, which
 * changes who clicks the button and nothing about the rule: no granted,
 * unexpired consent, no reading.
 *
 * That check is a function rather than a stored flag, and `readableComparison`
 * re-evaluates it on every call. A revoked consent therefore takes effect on
 * the next render, with no cached result surviving it — which is the property
 * the phase is verified on.
 */

export type ExternalProfile = {
  id: string;
  display_name: string;
  legal_birth_name: string;
  birth_date: string;
  birth_time: string;
  birth_city: string;
  created_at: number;
};

export type ConsentStatus = 'pending' | 'granted' | 'denied' | 'revoked';

export type ComparisonConsent = {
  id: string;
  external_profile_id: string;
  scope: ComparisonScope;
  status: ConsentStatus;
  requested_at: number;
  responded_at: number | null;
  /** PDR 8.2: a consent expires. Silence is not permission indefinitely. */
  expires_at: number;
};

export type StoredComparison = {
  id: string;
  external_profile_id: string;
  consent_id: string;
  prompt_version: string;
  result: ComparisonResult;
  mode: AiRunMode;
  created_at: number;
};

export const CONSENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function newId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Math.trunc(performance.now())}`;
}

export function listExternalProfiles(): ExternalProfile[] {
  return read<ExternalProfile[]>('external_profiles', []);
}

export function externalProfileById(id: string): ExternalProfile | undefined {
  return listExternalProfiles().find((p) => p.id === id);
}

export function saveExternalProfile(
  input: Omit<ExternalProfile, 'id' | 'created_at'>,
  now = Date.now(),
): ExternalProfile {
  const profile: ExternalProfile = { ...input, id: newId('external'), created_at: now };
  write('external_profiles', [...listExternalProfiles(), profile]);
  return profile;
}

/** PDR 8.2: the owner can delete the other person's data at any time, and
 *  deleting it takes the consents and the readings with it. */
export function deleteExternalProfile(id: string): void {
  write(
    'external_profiles',
    listExternalProfiles().filter((p) => p.id !== id),
  );
  write(
    'comparison_consents',
    listConsents().filter((c) => c.external_profile_id !== id),
  );
  write(
    'chart_comparisons',
    listComparisons().filter((c) => c.external_profile_id !== id),
  );
}

export function listConsents(): ComparisonConsent[] {
  return read<ComparisonConsent[]>('comparison_consents', []);
}

export function requestConsent(
  input: { externalProfileId: string; scope: ComparisonScope },
  now = Date.now(),
): ComparisonConsent {
  const consent: ComparisonConsent = {
    id: newId('consent'),
    external_profile_id: input.externalProfileId,
    scope: input.scope,
    status: 'pending',
    requested_at: now,
    responded_at: null,
    expires_at: now + CONSENT_TTL_MS,
  };
  // One live request per person: asking again replaces the old one rather than
  // leaving two answers to choose between.
  write('comparison_consents', [
    ...listConsents().filter((c) => c.external_profile_id !== input.externalProfileId),
    consent,
  ]);
  return consent;
}

export function respondToConsent(
  id: string,
  status: 'granted' | 'denied',
  now = Date.now(),
): void {
  write(
    'comparison_consents',
    listConsents().map((c) => (c.id === id ? { ...c, status, responded_at: now } : c)),
  );
}

export function revokeConsent(id: string, now = Date.now()): void {
  write(
    'comparison_consents',
    listConsents().map((c) => (c.id === id ? { ...c, status: 'revoked', responded_at: now } : c)),
  );
}

export function consentFor(externalProfileId: string): ComparisonConsent | undefined {
  return listConsents().find((c) => c.external_profile_id === externalProfileId);
}

/**
 * Deliberately not a type predicate. `active === false` says nothing about
 * whether a consent exists — a granted one that expired is both present and
 * inactive — and typing it as a guard narrowed the falsy branch to `never`,
 * which is exactly the branch that has to explain *why* it is inactive.
 */
export function isConsentActive(consent: ComparisonConsent | undefined, now = Date.now()): boolean {
  return consent !== undefined && consent.status === 'granted' && consent.expires_at > now;
}

export function listComparisons(): StoredComparison[] {
  return read<StoredComparison[]>('chart_comparisons', []);
}

export function saveComparison(input: {
  externalProfileId: string;
  consentId: string;
  result: ComparisonResult;
  promptVersion: string;
  mode: AiRunMode;
  now?: number;
}): StoredComparison {
  const record: StoredComparison = {
    id: newId('comparison'),
    external_profile_id: input.externalProfileId,
    consent_id: input.consentId,
    prompt_version: input.promptVersion,
    result: input.result,
    mode: input.mode,
    created_at: input.now ?? Date.now(),
  };
  write('chart_comparisons', [
    ...listComparisons().filter((c) => c.external_profile_id !== input.externalProfileId),
    record,
  ]);
  return record;
}

/**
 * The only way a stored comparison is ever read.
 *
 * The consent is re-checked here rather than at generation time, so revoking
 * makes an already-generated reading unreadable on the very next render. A
 * component caching the result in state would defeat that, which is why no
 * component does.
 */
export function readableComparison(
  externalProfileId: string,
  now = Date.now(),
): StoredComparison | undefined {
  if (!isConsentActive(consentFor(externalProfileId), now)) return undefined;
  return listComparisons().find((c) => c.external_profile_id === externalProfileId);
}
