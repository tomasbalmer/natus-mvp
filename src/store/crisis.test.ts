import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeHighSeverityEvent,
  hadCrisisWithin30Days,
  listCrisisEvents,
  markFalsePositive,
  recordCrisisEvent,
} from './crisis';
import { clearAll } from './db';
import type { CrisisDetection } from '@/lib/safety';
import { installMemoryStorage } from './memory-storage.testing.ts';

/**
 * A Map-backed `localStorage` so these run in the fast node environment
 * rather than pulling in a DOM. The store only uses get/set/remove/key/length,
 * which is exactly what a Map gives.
 */
const HIGH: CrisisDetection = {
  severity: 'high',
  category: 'ideacion',
  layer: 'deterministic',
  matched: ['quiero morirme'],
  excerpt: 'quiero morirme',
};

const LOW: CrisisDetection = {
  severity: 'low',
  category: 'indirecto',
  layer: 'deterministic',
  matched: ['ya no aguanto', 'nada tiene sentido'],
  excerpt: 'ya no aguanto',
};

const SIX_HOURS = 6 * 60 * 60 * 1000;

beforeEach(() => {
  installMemoryStorage();
  clearAll();
});

describe('recording crisis events', () => {
  it('notifies the admin on the first event', () => {
    const event = recordCrisisEvent(HIGH, 'onboarding', 1_000);
    expect(event.admin_notified_at).toBe(1_000);
  });

  it('records but does not re-notify inside six hours', () => {
    recordCrisisEvent(HIGH, 'onboarding', 1_000);
    const second = recordCrisisEvent(HIGH, 'chat', 1_000 + SIX_HOURS - 1);

    // PDR 6.4 step 5: the event is still stored — suppressing the record
    // would lose the history. Only the notification is deduplicated.
    expect(listCrisisEvents()).toHaveLength(2);
    expect(second.admin_notified_at).toBeNull();
  });

  it('notifies again once the window has passed', () => {
    recordCrisisEvent(HIGH, 'onboarding', 1_000);
    const later = recordCrisisEvent(HIGH, 'chat', 1_000 + SIX_HOURS);
    expect(later.admin_notified_at).toBe(1_000 + SIX_HOURS);
  });

  it('keeps the excerpt within the privacy cap', () => {
    const event = recordCrisisEvent(HIGH, 'onboarding');
    expect(event.excerpt.length).toBeLessThanOrEqual(200);
  });
});

describe('blocking and the false-positive escape hatch', () => {
  it('blocks while a high-severity event is active', () => {
    recordCrisisEvent(HIGH, 'onboarding');
    expect(activeHighSeverityEvent()).toBeDefined();
  });

  it('stops blocking once marked a false positive', () => {
    const event = recordCrisisEvent(HIGH, 'onboarding');
    markFalsePositive(event.id);
    expect(activeHighSeverityEvent()).toBeUndefined();
  });

  it('keeps the event on record after dismissal, flagged for review', () => {
    const event = recordCrisisEvent(HIGH, 'onboarding');
    markFalsePositive(event.id);
    expect(listCrisisEvents()[0]?.false_positive).toBe(true);
  });

  it('does not block on low severity', () => {
    recordCrisisEvent(LOW, 'chat');
    expect(activeHighSeverityEvent()).toBeUndefined();
  });

  it('lets a high-severity event expire after 30 days', () => {
    const now = 100 * 24 * 60 * 60 * 1000;
    recordCrisisEvent(HIGH, 'onboarding', now - 31 * 24 * 60 * 60 * 1000);
    expect(activeHighSeverityEvent(now)).toBeUndefined();
  });
});

describe('feeding the hard filter', () => {
  it('reports a recent crisis so removing modalities are excluded', () => {
    recordCrisisEvent(LOW, 'chat');
    expect(hadCrisisWithin30Days()).toBe(true);
  });

  it('does not count a dismissed false positive as vulnerability', () => {
    const event = recordCrisisEvent(HIGH, 'onboarding');
    markFalsePositive(event.id);
    expect(hadCrisisWithin30Days()).toBe(false);
  });
});
