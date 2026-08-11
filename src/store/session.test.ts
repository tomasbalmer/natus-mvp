import { beforeEach, describe, expect, it } from 'vitest';
import {
  SESSION_TTL_MS,
  attachSoulMap,
  claimSession,
  emptyDraft,
  getOrCreateSession,
  getSession,
  isDraftComplete,
  setStep,
  updateDraft,
} from './session';
import { clearAll } from './db';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  [name: string]: unknown;
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
  clearAll();
});

const T0 = 1_000_000;

describe('US-1.1 — reaching the Soul Map without an account', () => {
  it('CA2: a session with a soul map exists by the end of onboarding', () => {
    getOrCreateSession(T0);
    updateDraft({ legal_birth_name: 'Ana Perez' }, T0);
    const session = attachSoulMap('soul-map-1', T0);
    expect(session.soul_map_id).toBe('soul-map-1');
  });

  it('CA3: the session survives a closed browser inside seven days', () => {
    getOrCreateSession(T0);
    updateDraft({ presenting_need_text: 'no se por donde empezar' }, T0);

    const later = getSession(T0 + SESSION_TTL_MS - 1);
    expect(later?.draft.presenting_need_text).toBe('no se por donde empezar');
  });

  it('CA3: and is gone once seven days have passed', () => {
    getOrCreateSession(T0);
    expect(getSession(T0 + SESSION_TTL_MS)).toBeNull();
  });

  it('CA4: claiming at signup makes the anonymous record unusable', () => {
    getOrCreateSession(T0);
    const claimed = claimSession('client-1', T0 + 1000);

    expect(claimed?.claimed_by).toBe('client-1');
    // Reads stop serving it immediately — the row exists, claimed, and no
    // longer answers. Deleting it would lose the fact that it was claimed.
    expect(getSession(T0 + 1000)).toBeNull();
  });

  it('claiming when there is nothing to claim is a no-op', () => {
    expect(claimSession('client-1', T0)).toBeNull();
  });
});

describe('US-1.2 — skipping birth time and city must not block', () => {
  const base = {
    ...emptyDraft(),
    legal_birth_name: 'Ana Perez',
    birth_date: '1990-06-04',
    presenting_need_text: 'algo tiene que cambiar',
    openness_to_modalities: ['terapia-somatica'],
    clinical_basics: { ideation_6m: 'no' as const },
  };

  it('CA1: a draft with no birth time or city is complete', () => {
    expect(isDraftComplete({ ...base, birth_time: '', birth_city: '' })).toBe(true);
  });

  it('is incomplete without a name', () => {
    expect(isDraftComplete({ ...base, legal_birth_name: '  ' })).toBe(false);
  });

  it('is incomplete without an ideation answer', () => {
    expect(isDraftComplete({ ...base, clinical_basics: {} })).toBe(false);
  });

  it('accepts a shortcut instead of free text', () => {
    expect(
      isDraftComplete({ ...base, presenting_need_text: '', presenting_need_slugs: ['perdida'] }),
    ).toBe(true);
  });

  it('rejects a malformed date', () => {
    expect(isDraftComplete({ ...base, birth_date: '04/06/1990' })).toBe(false);
  });
});

describe('step tracking', () => {
  it('only ever advances, so reviewing an earlier answer loses nothing', () => {
    getOrCreateSession(T0);
    setStep(4, T0);
    const back = setStep(1, T0);
    expect(back.step).toBe(4);
  });
});
