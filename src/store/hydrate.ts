import { supabase, type TypedClient } from '@/supabase/client.ts';
import { currentSession } from '@/supabase/session.ts';
import { markHydrationFailed, seedMirror, setPersister } from './db.ts';
import { ADAPTERS, type RemoteNamespace } from './remote.ts';
import { REMOTE_NAMESPACES } from './namespaces.ts';

/**
 * One round trip, at the start, and then the store is synchronous again.
 *
 * This is the whole of approach A from `DECISIONS.md` section 12. The screens
 * call `activeProfile()` and `currentSynthesis()` from their render bodies, and
 * a React component cannot await; rather than rewrite twenty-eight files into
 * hooks, the dataset is small enough to load once and hold.
 *
 * Failure is not an error state. A paused free-tier project, a dead network or
 * a build with no backend configured all land in the same place: the mirror
 * stays empty, `read` falls through to `localStorage`, and the demo runs on
 * whatever this browser last saw. That path is not a fallback bolted on — it
 * is the path the whole application used until this phase.
 */

export type HydrationResult =
  | { kind: 'local'; reason: 'unconfigured' | 'no-session' | 'failed' }
  | { kind: 'remote'; userId: string; namespaces: number };

/** Surfaced so a failed write can be shown rather than swallowed. */
export type WriteFailure = { namespace: string; message: string };

let onWriteFailure: ((failure: WriteFailure) => void) | null = null;

/**
 * The signed-in identity, kept so the delete path can reach Postgres.
 *
 * `clearAll` in `db.ts` clears the mirror and `localStorage` directly rather
 * than going through `write`, which is what makes it fast and what makes it
 * local. That was invisible for as long as nothing else existed; with a
 * backend behind the mirror it meant "delete everything" emptied the browser
 * and left every row in place, and the next hydration brought all of it back.
 */
let identity: { client: TypedClient; userId: string } | null = null;

/** Whether there is a Postgres side to delete from at all. */
export function hasRemoteIdentity(): boolean {
  return identity !== null;
}

/**
 * Delete this person's rows, everywhere.
 *
 * In reverse namespace order, because the schema cascades parent to child and
 * the list is written parent first: `messages` before `conversations`,
 * `chart_comparisons` before the consents and profiles it points at. Cascade
 * would cover most of it, but relying on that means the delete is correct by
 * accident of schema rather than by what this function does.
 *
 * Sequential, and it throws on the first failure. Fourteen parallel deletes
 * that half succeed leave an account nobody can describe, and the caller has
 * to be able to tell somebody the truth about what is gone.
 */
export async function purgeRemote(): Promise<void> {
  if (!identity) return;
  const { client, userId } = identity;

  for (const ns of [...REMOTE_NAMESPACES].reverse()) {
    await ADAPTERS[ns].save(client, userId, null);
  }

  identity = null;
}

export function setWriteFailureHandler(handler: (failure: WriteFailure) => void): void {
  onWriteFailure = handler;
}

export async function hydrate(): Promise<HydrationResult> {
  if (!supabase) {
    markHydrationFailed();
    return { kind: 'local', reason: 'unconfigured' };
  }

  const session = await currentSession();
  if (!session) {
    markHydrationFailed();
    // Not an error: the person has not walked through the door yet.
    return { kind: 'local', reason: 'no-session' };
  }

  const userId = session.user.id;
  const client = supabase;

  try {
    // In parallel: fourteen small selects against one Postgres, none of which
    // depends on another. Sequentially this would be fourteen round trips to
    // São Paulo before the first screen painted.
    const loaded = await Promise.all(
      REMOTE_NAMESPACES.map(async (ns) => {
        const value: unknown = await ADAPTERS[ns].load(client, userId);
        return [ns, value] as [RemoteNamespace, unknown];
      }),
    );

    seedMirror(loaded);
    setPersister(makePersister(client, userId));
    identity = { client, userId };
    return { kind: 'remote', userId, namespaces: loaded.length };
  } catch {
    // Deliberately not partial. Seeding some namespaces from Postgres and
    // leaving the rest on localStorage would produce a session that is
    // half one person's data and half another's — the worst outcome
    // available here, and worse than simply being offline.
    markHydrationFailed();
    return { kind: 'local', reason: 'failed' };
  }
}

/**
 * Writes are fire-and-forget by design, but not silent.
 *
 * `store/db.ts` swallows a `localStorage` quota error on purpose: the demo
 * should degrade rather than break. A dropped network write is a different
 * thing — the person believes their data was saved. `DECISIONS.md` section 12
 * records that these surface, and this is where.
 *
 * Serialised per namespace. Two writes to the same namespace in flight at once
 * can land out of order, and the later value is a whole-array replacement, so
 * losing the race means losing a row.
 */
function makePersister(
  client: TypedClient,
  userId: string,
): (ns: string, value: unknown) => void {
  const queues = new Map<string, Promise<void>>();

  return (ns, value) => {
    const adapter = ADAPTERS[ns as RemoteNamespace];
    if (!adapter) return; // ai_mode, and anything else local by design.

    const previous = queues.get(ns) ?? Promise.resolve();
    const next = previous
      .then(() => adapter.save(client, userId, value))
      .catch((error: unknown) => {
        onWriteFailure?.({
          namespace: ns,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    queues.set(ns, next);
  };
}
