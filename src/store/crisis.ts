import { read, write } from './db';
import { shouldNotifyAdmin, type CrisisDetection } from '@/lib/safety';

/**
 * Local stand-in for the `crisis_events` table of PDR 5.9.
 *
 * In production this row also triggers an email to an admin. There is no
 * server here, so the notification is recorded rather than sent, and the
 * six-hour deduplication of PDR 6.4 step 5 is applied exactly as it would be
 * — the point is that the rule is implemented and tested, not that mail goes
 * out from a static page.
 */

export type CrisisSurface = 'onboarding' | 'chat' | 'meditation_intent';

export type CrisisEvent = CrisisDetection & {
  id: string;
  source_surface: CrisisSurface;
  created_at: number;
  admin_notified_at: number | null;
  /** Set by the "esto no aplica a mi caso" link. PDR 6.4. */
  false_positive: boolean | null;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `crisis-${performance.now()}`;
}

export function listCrisisEvents(): CrisisEvent[] {
  return read<CrisisEvent[]>('crisis_events', []);
}

export function recordCrisisEvent(
  detection: CrisisDetection,
  surface: CrisisSurface,
  now = Date.now(),
): CrisisEvent {
  const events = listCrisisEvents();
  const lastNotified = events.reduce<number | null>(
    (latest, e) => (e.admin_notified_at && e.admin_notified_at > (latest ?? 0) ? e.admin_notified_at : latest),
    null,
  );

  const notify = shouldNotifyAdmin(lastNotified, now);

  const event: CrisisEvent = {
    ...detection,
    id: newId(),
    source_surface: surface,
    created_at: now,
    admin_notified_at: notify ? now : null,
    false_positive: null,
  };

  write('crisis_events', [...events, event]);
  return event;
}

/**
 * The false-positive escape hatch of PDR 6.4.
 *
 * Without it, someone who wrote "ya no aguanto este trabajo" is locked out of
 * the product with no way back. Marking the event unblocks the flow and
 * leaves it flagged for review.
 */
export function markFalsePositive(id: string): void {
  write(
    'crisis_events',
    listCrisisEvents().map((e) => (e.id === id ? { ...e, false_positive: true } : e)),
  );
}

/** The active block, if any. A dismissed false positive stops blocking. */
export function activeHighSeverityEvent(now = Date.now()): CrisisEvent | undefined {
  return listCrisisEvents()
    .filter((e) => e.severity === 'high' && e.false_positive !== true)
    .sort((a, b) => b.created_at - a.created_at)
    .find((e) => now - e.created_at < THIRTY_DAYS_MS);
}

export function hasRecentLowSeverity(now = Date.now()): boolean {
  return listCrisisEvents().some(
    (e) => e.severity === 'low' && e.false_positive !== true && now - e.created_at < THIRTY_DAYS_MS,
  );
}

/** Feeds `$clinically_vulnerable` in the hard filter. PDR 7.2. */
export function hadCrisisWithin30Days(now = Date.now()): boolean {
  return listCrisisEvents().some(
    (e) => e.false_positive !== true && now - e.created_at < THIRTY_DAYS_MS,
  );
}
