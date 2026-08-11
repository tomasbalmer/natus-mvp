import { read, write } from './db';
import type { MeditationScript } from '@/lib/schemas';

/**
 * The `meditations` table of PDR 5.7.
 *
 * PDR 5.7 stores an `audio_url` pointing at a private bucket. Nothing here
 * does: the audio is synthesised at play time from the script and the bed
 * descriptor, so there is no file to keep and none to delete. Deleting a
 * meditation therefore removes exactly one row, and `store/blobs.ts` still
 * sweeps IndexedDB on the account-wide delete so that stays true if a later
 * phase does start caching audio.
 */

export type StoredMeditation = {
  id: string;
  /** What the person asked for, in their words. */
  intent: string;
  requested_minutes: number;
  /** What the script actually came out at. The two differ, and the second one
   *  is the honest number to show. */
  estimated_minutes: number;
  script: MeditationScript;
  prompt_version: string;
  mode: 'fixture' | 'byok';
  created_at: number;
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `meditation-${Math.trunc(performance.now())}`;
}

export function listMeditations(): StoredMeditation[] {
  return read<StoredMeditation[]>('meditations', []).sort((a, b) => b.created_at - a.created_at);
}

export function meditationById(id: string): StoredMeditation | undefined {
  return listMeditations().find((m) => m.id === id);
}

export function saveMeditation(input: {
  intent: string;
  requestedMinutes: number;
  estimatedMinutes: number;
  script: MeditationScript;
  promptVersion: string;
  mode: 'fixture' | 'byok';
  now?: number;
}): StoredMeditation {
  const record: StoredMeditation = {
    id: newId(),
    intent: input.intent,
    requested_minutes: input.requestedMinutes,
    estimated_minutes: input.estimatedMinutes,
    script: input.script,
    prompt_version: input.promptVersion,
    mode: input.mode,
    created_at: input.now ?? Date.now(),
  };
  write('meditations', [...listMeditations(), record]);
  return record;
}

export function deleteMeditation(id: string): void {
  write(
    'meditations',
    listMeditations().filter((m) => m.id !== id),
  );
}
