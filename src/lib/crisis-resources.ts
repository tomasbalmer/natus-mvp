import { crisisResourcesFile } from './catalog';
import type { CrisisResource } from './schemas';

/**
 * Country lookup for crisis resources. Pure — no storage, no browser.
 *
 * PDR 6.4: the list is never empty. A country outside the MVP set falls back
 * to the international directory plus an instruction to call local emergency
 * services, and never to nothing.
 */

export const MVP_COUNTRIES = ['CL', 'MX', 'CO', 'AR', 'PE'] as const;

export type CrisisResourceSet = {
  country: string;
  resources: CrisisResource[];
  fallback: typeof crisisResourcesFile.fallback;
  /**
   * True when any listed number has not been verified by telephone. The screen
   * must say so. PDR 6.4 calls verification an absolute launch blocker and
   * notes a wrong number here would be the worst bug in the product; showing
   * numbers while quietly implying they were checked is the failure mode this
   * flag exists to prevent.
   */
  unverified: boolean;
};

export function resourcesForCountry(country: string | undefined): CrisisResourceSet {
  const code = (country ?? '').toUpperCase();
  const resources = crisisResourcesFile.resources
    .filter((r) => r.country === code && r.is_active)
    .sort((a, b) => a.priority - b.priority);

  return {
    country: code,
    resources,
    fallback: crisisResourcesFile.fallback,
    // An empty list is unverified by definition: there is nothing local to
    // stand behind, so the international fallback carries the whole screen.
    unverified: resources.length === 0 || resources.some((r) => r.verified_at === null),
  };
}

/** `tel:` href with everything a dialler would choke on removed. */
export function telHref(contact: string): string {
  return `tel:${contact.replace(/[^\d+]/g, '')}`;
}
