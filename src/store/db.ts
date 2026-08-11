/**
 * The browser standing in for Postgres.
 *
 * One namespace per table from PDR section 5, so the call sites read like the
 * queries they will eventually become. Everything is synchronous and local;
 * the migration to Supabase replaces this file, not its callers.
 *
 * Reads never throw. A quota-exceeded write, a private-browsing window, or a
 * user who cleared storage mid-session should degrade the demo, not break it.
 */

const PREFIX = 'natus:';

export type Namespace =
  | 'anonymous_session'
  | 'client'
  | 'soul_map'
  | 'soul_map_synthesis'
  | 'recommendations'
  | 'recommendation_checkins'
  | 'modality_matches'
  | 'conversations'
  | 'messages'
  | 'meditations'
  | 'external_profiles'
  | 'comparison_consents'
  | 'chart_comparisons'
  | 'crisis_events'
  | 'subscription'
  | 'preferences'
  | 'ai_mode';

function key(ns: Namespace): string {
  return `${PREFIX}${ns}`;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Access itself throws in some privacy configurations.
    return null;
  }
}

export function read<T>(ns: Namespace, fallback: T): T {
  const raw = storage()?.getItem(key(ns));
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write<T>(ns: Namespace, value: T): void {
  try {
    storage()?.setItem(key(ns), JSON.stringify(value));
  } catch {
    // Out of quota, or storage disabled. The demo continues in memory for
    // this session rather than failing in front of whoever is watching.
  }
}

export function remove(ns: Namespace): void {
  try {
    storage()?.removeItem(key(ns));
  } catch {
    /* see write */
  }
}

/** Every namespace this app owns, for the delete-my-data path of PDR 11.3. */
export function clearAll(): void {
  const store = storage();
  if (!store) return;
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  for (const k of keys) {
    try {
      store.removeItem(k);
    } catch {
      /* see write */
    }
  }
}

/** Snapshot of everything stored, for the export path of PDR 11.3. */
export function exportAll(): Record<string, unknown> {
  const store = storage();
  const out: Record<string, unknown> = {};
  if (!store) return out;
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    const raw = store.getItem(k);
    if (raw == null) continue;
    try {
      out[k.slice(PREFIX.length)] = JSON.parse(raw);
    } catch {
      out[k.slice(PREFIX.length)] = raw;
    }
  }
  return out;
}
