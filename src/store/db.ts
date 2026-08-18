/**
 * The store's single frontier.
 *
 * One namespace per table from PDR section 5, so the call sites read like the
 * queries they became. `docs/MIGRATION.md` promised that this file is replaced
 * and its callers are not, and the reason that promise survives contact with a
 * network database is here: `read` and `write` are still synchronous.
 *
 * They can be because the reads never touch the network. The user's whole
 * dataset — one synthesis, a handful of matches, some messages, some
 * meditations — is loaded once at session start and held in memory.
 * `DECISIONS.md` section 12 records why, what was rejected, and the signal to
 * change approach.
 *
 * Three layers, in the order `read` consults them:
 *
 *   mirror        in memory, authoritative during a session
 *   localStorage  last known good, so a paused project still renders
 *   fallback      the caller's default
 *
 * A write updates all of the first two synchronously and sends the third copy
 * to Postgres behind the caller's back. Reads never throw and never wait.
 */

import type { Namespace } from './namespaces.ts';
export type { Namespace } from './namespaces.ts';

const PREFIX = 'natus:';

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

/**
 * Namespaces this application used to write and no longer reads.
 *
 * `ai_mode` held a pasted Anthropic key. Step 5.7 removed the path that used
 * it, which removes the *use* and not the credential: anybody who tried BYOK
 * still has a working key sitting in their browser, now with no screen that
 * would ever show it to them again. Deleting the feature and leaving the
 * secret behind would be the worse half of the change.
 *
 * Run on module load rather than behind a version flag. It is one `removeItem`
 * against a key nothing writes, so the cost of running it forever is lower
 * than the cost of deciding when it may stop.
 */
const RETIRED = ['ai_mode'];

export function purgeRetiredNamespaces(): void {
  const store = storage();
  if (!store) return;
  for (const ns of RETIRED) {
    try {
      store.removeItem(`${PREFIX}${ns}`);
    } catch {
      // A full or blocked store is not a reason to fail the application.
    }
  }
}

purgeRetiredNamespaces();

// ── the mirror ──────────────────────────────────────────────────────────────

const mirror = new Map<Namespace, unknown>();

/** Set once hydration has run, successfully or not. Before it, reads fall
 *  through to localStorage exactly as they did when there was no backend. */
let hydrated = false;

/** Where a write should go after the mirror. Null until a backend is wired,
 *  which keeps this module free of any import from `@/supabase`. */
let persist: ((ns: Namespace, value: unknown) => void) | null = null;

export function seedMirror(entries: Iterable<[Namespace, unknown]>): void {
  for (const [ns, value] of entries) mirror.set(ns, value);
  hydrated = true;
}

/** Marks hydration as attempted and failed. The mirror stays empty and reads
 *  fall through to localStorage, which is the last state this browser saw. */
export function markHydrationFailed(): void {
  hydrated = true;
}

export function setPersister(fn: (ns: Namespace, value: unknown) => void): void {
  persist = fn;
}

export function isHydrated(): boolean {
  return hydrated;
}

/** Test seam. Resets module state between cases. */
export function resetMirror(): void {
  mirror.clear();
  hydrated = false;
  persist = null;
}

// ── the interface the rest of the store uses, unchanged ─────────────────────

export function read<T>(ns: Namespace, fallback: T): T {
  if (mirror.has(ns)) return mirror.get(ns) as T;

  const raw = storage()?.getItem(key(ns));
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function write<T>(ns: Namespace, value: T): void {
  mirror.set(ns, value);

  try {
    storage()?.setItem(key(ns), JSON.stringify(value));
  } catch {
    // Out of quota, or storage disabled. The demo continues in memory for
    // this session rather than failing in front of whoever is watching.
  }

  // Deliberately not awaited. A screen that blocked on a round trip to São
  // Paulo before re-rendering would be a worse product than one that shows
  // the change and reports a failure if it comes.
  persist?.(ns, value);
}

export function remove(ns: Namespace): void {
  mirror.delete(ns);
  try {
    storage()?.removeItem(key(ns));
  } catch {
    /* see write */
  }
}

/** Every namespace this app owns, for the delete-my-data path of PDR 11.3. */
export function clearAll(): void {
  mirror.clear();

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
  const out: Record<string, unknown> = {};

  // localStorage first, then the mirror over the top: the mirror is the
  // authoritative copy during a session, and an export that disagreed with
  // what the person is looking at would be the wrong document.
  const store = storage();
  if (store) {
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
  }
  for (const [ns, value] of mirror) out[ns] = value;
  return out;
}
