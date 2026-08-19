/**
 * The IndexedDB half of the delete-everything path in PDR 11.3.
 *
 * Nothing writes blobs yet — the natal-chart PDF is held in session state
 * because the demo never re-reads its bytes, and meditation audio is
 * synthesised at playback rather than stored. The deletion path is written
 * anyway: a delete that
 * quietly misses a store is the failure nobody notices, and the point of the
 * two-step confirmation is that afterwards there really is nothing left.
 *
 * `indexedDB.databases()` is not universally available. Where it is missing,
 * the known names are deleted by name, which covers everything this app
 * creates — it only ever creates names it declares here.
 */

export const BLOB_DB_PREFIX = 'natus';

/** Databases this app creates. Add to this list when a new store appears. */
export const KNOWN_BLOB_DATABASES = ['natus-blobs'];

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = factory.deleteDatabase(name);
    // Resolve on every outcome, including `blocked`, which means another tab
    // holds a connection. Failing the whole delete over that would leave the
    // person staring at an error for data that is already gone locally.
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Returns the names it deleted, so the confirmation can be specific. */
export async function clearStoredBlobs(): Promise<string[]> {
  const factory = globalThis.indexedDB as IDBFactory | undefined;
  if (!factory) return [];

  let names: string[] = KNOWN_BLOB_DATABASES;
  try {
    const listed = await factory.databases?.();
    if (listed) {
      names = listed
        .map((info) => info.name)
        .filter((name): name is string => typeof name === 'string' && name.startsWith(BLOB_DB_PREFIX));
    }
  } catch {
    // Enumeration is blocked in some privacy configurations. Fall back to the
    // declared names.
  }

  await Promise.all(names.map((name) => deleteDatabase(factory, name)));
  return names;
}
