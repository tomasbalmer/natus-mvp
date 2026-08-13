import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  exportAll,
  isHydrated,
  markHydrationFailed,
  read,
  remove,
  resetMirror,
  seedMirror,
  setPersister,
  write,
} from './db.ts';
import { installMemoryStorage } from './memory-storage.testing.ts';

/**
 * The three layers, and which one wins.
 *
 * The existing store tests exercise behaviour through `session.ts`,
 * `chat.ts` and the rest, and they were written against `localStorage`. They
 * still pass unchanged, which is the point — the backing moved and the
 * behaviour did not. What they cannot cover is the layering itself, because
 * they never see a hydrated mirror.
 *
 * That is what is here: which layer answers a read, what a write touches, and
 * the degraded path that a paused project lands on.
 */

beforeEach(() => {
  installMemoryStorage();
  resetMirror();
});

afterEach(() => {
  resetMirror();
});

describe('read', () => {
  it('falls through to localStorage before hydration', () => {
    localStorage.setItem('natus:preferences', JSON.stringify({ locale: 'en' }));
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'en' });
  });

  it('returns the fallback when nothing is stored anywhere', () => {
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'es' });
  });

  it('prefers the mirror over localStorage once hydrated', () => {
    // The case that matters: this browser holds a stale copy from a previous
    // session and Postgres holds the current one. The mirror has to win, or
    // the person sees data they already changed on another device.
    localStorage.setItem('natus:preferences', JSON.stringify({ locale: 'en' }));
    seedMirror([['preferences', { locale: 'es' }]]);
    expect(read('preferences', { locale: 'en' })).toEqual({ locale: 'es' });
  });

  it('honours a hydrated null rather than treating it as absent', () => {
    // A person with no client row yet. Postgres said null and meant it; the
    // fallback must not resurrect a stale local value.
    localStorage.setItem('natus:client', JSON.stringify({ id: 'stale' }));
    seedMirror([['client', null]]);
    expect(read('client', { id: 'fallback' })).toBeNull();
  });

  it('survives corrupted localStorage', () => {
    localStorage.setItem('natus:preferences', 'not json{');
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'es' });
  });
});

describe('write', () => {
  it('updates the mirror and localStorage together', () => {
    write('preferences', { locale: 'en' });
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'en' });
    expect(JSON.parse(localStorage.getItem('natus:preferences') ?? 'null')).toEqual({
      locale: 'en',
    });
  });

  it('hands the value to the persister', () => {
    const persist = vi.fn();
    setPersister(persist);
    write('preferences', { locale: 'en' });
    expect(persist).toHaveBeenCalledWith('preferences', { locale: 'en' });
  });

  it('does not wait for the persister', () => {
    // Fire and forget: a screen that blocked on a round trip before
    // re-rendering would be a worse product than one that shows the change.
    setPersister(() => {
      throw new Error('the network is on fire');
    });
    expect(() => write('preferences', { locale: 'en' })).toThrow();
    // ...and the local copy landed first, so the value is not lost.
    expect(JSON.parse(localStorage.getItem('natus:preferences') ?? 'null')).toEqual({
      locale: 'en',
    });
  });
});

describe('the degraded path', () => {
  it('reports hydration as done even when it failed', () => {
    expect(isHydrated()).toBe(false);
    markHydrationFailed();
    expect(isHydrated()).toBe(true);
  });

  it('reads the last known good copy after a failed hydration', () => {
    // A paused free-tier project. The demo has to keep rendering whatever this
    // browser last saw rather than showing an empty account.
    localStorage.setItem('natus:preferences', JSON.stringify({ locale: 'en' }));
    markHydrationFailed();
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'en' });
  });
});

describe('the data rights paths', () => {
  it('clearAll empties both layers', () => {
    seedMirror([['preferences', { locale: 'en' }]]);
    localStorage.setItem('natus:client', JSON.stringify({ id: 'x' }));
    clearAll();
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'es' });
    expect(localStorage.getItem('natus:client')).toBeNull();
  });

  it('remove takes the namespace out of the mirror too', () => {
    // Deleting from localStorage alone would leave the mirror answering reads
    // with the value that was just deleted.
    seedMirror([['preferences', { locale: 'en' }]]);
    remove('preferences');
    expect(read('preferences', { locale: 'es' })).toEqual({ locale: 'es' });
  });

  it('exportAll prefers the mirror over a stale local copy', () => {
    // PDR 11.3. An export that disagreed with what the person is looking at
    // would be the wrong document.
    localStorage.setItem('natus:preferences', JSON.stringify({ locale: 'en' }));
    seedMirror([['preferences', { locale: 'es' }]]);
    expect(exportAll()['preferences']).toEqual({ locale: 'es' });
  });

  it('exportAll includes namespaces held only locally', () => {
    // `ai_mode` is never hydrated — it holds a pasted key and must not reach
    // the server — so an export built from the mirror alone would omit it.
    localStorage.setItem('natus:ai_mode', JSON.stringify({ mode: 'fixture' }));
    seedMirror([['preferences', { locale: 'es' }]]);
    expect(exportAll()['ai_mode']).toEqual({ mode: 'fixture' });
  });
});
