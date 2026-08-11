import { read, write } from './db';

/**
 * The `subscription` row of PDR 5.2, simulated.
 *
 * No gateway, no webhook, no charge — a static page cannot take money and
 * should not pretend to. What is implemented is the state the rest of the
 * product reads: whether the quota applies. The screen that flips it says
 * plainly that nothing was billed, so nobody can walk away from the demo
 * thinking a payment was processed.
 */

export type Subscription = {
  status: 'none' | 'active';
  /** Simulated, so there is no provider and no transaction to point at. */
  activated_at: number | null;
};

const DEFAULT: Subscription = { status: 'none', activated_at: null };

export function getSubscription(): Subscription {
  const stored = read<Partial<Subscription>>('subscription', DEFAULT);
  return stored.status === 'active'
    ? { status: 'active', activated_at: stored.activated_at ?? null }
    : DEFAULT;
}

export function isSubscribed(): boolean {
  return getSubscription().status === 'active';
}

export function simulateSubscribe(now = Date.now()): Subscription {
  const next: Subscription = { status: 'active', activated_at: now };
  write('subscription', next);
  return next;
}

export function cancelSubscription(): void {
  write('subscription', DEFAULT);
}
