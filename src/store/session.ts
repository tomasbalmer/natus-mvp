import { read, write } from './db';
import type { ClinicalBasics } from '@/lib/safety';

/**
 * The anonymous session of PDR 5.1.
 *
 * The conversion decision this exists to serve: the account is asked for
 * *after* the Soul Map is shown, never before. Until then the person is
 * anonymous, their answers live here, and the record is claimed at signup.
 *
 * Seven-day expiry, as the SQL specifies. In production a nightly job deletes
 * expired unclaimed rows along with the orphaned soul map and the stored PDF;
 * here the read path treats an expired session as absent and clears it.
 */

export type NatalChartDraft = {
  provider: 'astrologer';
  api_version: 'v5';
  context: string;
  calculated_at: number;
  parse_status: 'parsed';
};

export type OnboardingDraft = {
  legal_birth_name: string;
  birth_date: string;
  /** PDR US-1.2: optional, and skipping them must not block. */
  birth_time: string;
  birth_city: string;
  birth_country: string;
  country: string;
  locale: 'es' | 'en';
  presenting_need_text: string;
  presenting_need_slugs: string[];
  /** Stored as modality slugs, per PDR 5.2, after the family-level screen is
   *  expanded by `expandOpenness`. */
  openness_to_modalities: string[];
  clinical_basics: ClinicalBasics;
  natal_chart: NatalChartDraft | null;
};

export type AnonymousSession = {
  id: string;
  created_at: number;
  expires_at: number;
  /** Furthest step reached, so a returning visitor lands where they left off. */
  step: number;
  draft: OnboardingDraft;
  soul_map_id: string | null;
  claimed_by: string | null;
};

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function emptyDraft(): OnboardingDraft {
  return {
    legal_birth_name: '',
    birth_date: '',
    birth_time: '',
    birth_city: '',
    birth_country: '',
    country: 'CL',
    locale: 'es',
    presenting_need_text: '',
    presenting_need_slugs: [],
    openness_to_modalities: [],
    clinical_basics: {},
    natal_chart: null,
  };
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `session-${Math.trunc(performance.now())}`;
}

function isExpired(session: AnonymousSession, now: number): boolean {
  return session.expires_at <= now;
}

/** Returns the live session, or null if there is none or it has expired. */
export function getSession(now = Date.now()): AnonymousSession | null {
  const session = read<AnonymousSession | null>('anonymous_session', null);
  if (!session) return null;
  if (isExpired(session, now)) {
    write('anonymous_session', null);
    return null;
  }
  return session;
}

export function getOrCreateSession(now = Date.now()): AnonymousSession {
  const existing = getSession(now);
  if (existing) return existing;

  const session: AnonymousSession = {
    id: newId(),
    created_at: now,
    expires_at: now + SESSION_TTL_MS,
    step: 0,
    draft: emptyDraft(),
    soul_map_id: null,
    claimed_by: null,
  };
  write('anonymous_session', session);
  return session;
}

export function updateDraft(patch: Partial<OnboardingDraft>, now = Date.now()): AnonymousSession {
  const session = getOrCreateSession(now);
  const next: AnonymousSession = { ...session, draft: { ...session.draft, ...patch } };
  write('anonymous_session', next);
  return next;
}

export function setStep(step: number, now = Date.now()): AnonymousSession {
  const session = getOrCreateSession(now);
  // Only ever advances. Stepping back to review an answer should not lose the
  // fact that later screens were already completed.
  const next: AnonymousSession = { ...session, step: Math.max(session.step, step) };
  write('anonymous_session', next);
  return next;
}

export function attachSoulMap(soulMapId: string, now = Date.now()): AnonymousSession {
  const session = getOrCreateSession(now);
  const next: AnonymousSession = { ...session, soul_map_id: soulMapId };
  write('anonymous_session', next);
  return next;
}

/**
 * PDR US-1.1 CA4: at signup the record is claimed and the anonymous one
 * becomes unusable. Expiring it rather than deleting it keeps the shape
 * honest — the row exists, claimed, and no longer serves reads.
 */
export function claimSession(clientId: string, now = Date.now()): AnonymousSession | null {
  const session = getSession(now);
  if (!session) return null;
  const claimed: AnonymousSession = { ...session, claimed_by: clientId, expires_at: now };
  write('anonymous_session', claimed);
  return claimed;
}

export function clearSession(): void {
  write('anonymous_session', null);
}

/** Whether the draft holds enough to generate a Soul Map. Birth time and city
 *  are deliberately absent from this check — PDR US-1.2. */
export function isDraftComplete(draft: OnboardingDraft): boolean {
  return (
    draft.legal_birth_name.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.birth_date) &&
    (draft.presenting_need_text.trim().length > 0 || draft.presenting_need_slugs.length > 0) &&
    draft.openness_to_modalities.length > 0 &&
    draft.clinical_basics.ideation_6m !== undefined
  );
}
