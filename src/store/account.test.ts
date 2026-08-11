import { beforeEach, describe, expect, it } from 'vitest';
import {
  SignupError,
  activeProfile,
  attachSoulMapToClient,
  getClient,
  isPlausibleEmail,
  isSignedIn,
  signUp,
} from './account';
import { attachSoulMap, getOrCreateSession, getSession, updateDraft } from './session';
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

function completeOnboarding() {
  getOrCreateSession(T0);
  updateDraft(
    {
      legal_birth_name: 'Ana Perez',
      birth_date: '1990-06-04',
      presenting_need_text: 'algo tiene que cambiar',
      openness_to_modalities: ['terapia-somatica'],
      clinical_basics: { ideation_6m: 'no' },
    },
    T0,
  );
  attachSoulMap('synthesis-1', T0);
}

describe('US-1.1 CA4 — signing up claims what was answered anonymously', () => {
  it('carries the draft onto the account', () => {
    completeOnboarding();
    const client = signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    expect(client.profile.legal_birth_name).toBe('Ana Perez');
    expect(client.profile.openness_to_modalities).toEqual(['terapia-somatica']);
  });

  it('carries the Soul Map generated before the account existed', () => {
    completeOnboarding();
    const client = signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    expect(client.soul_map_id).toBe('synthesis-1');
    expect(client.claimed_session_id).toBe(getClient()?.claimed_session_id);
  });

  it('leaves the anonymous record claimed and unreadable', () => {
    completeOnboarding();
    signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    expect(getSession(T0 + 1000)).toBeNull();
  });

  it('keeps serving the answers afterwards, through the account instead', () => {
    completeOnboarding();
    signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    // The regression this guards: every screen downstream of the Soul Map
    // reads the draft. If signing up made it unreachable, creating an account
    // would silently empty the recommendations.
    const profile = activeProfile(T0 + 1000);
    expect(profile?.draft.presenting_need_text).toBe('algo tiene que cambiar');
    expect(profile?.clientId).not.toBeNull();
  });

  it('is idempotent — a second signup does not orphan the first account', () => {
    completeOnboarding();
    const first = signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });
    const second = signUp({ email: 'otra@ejemplo.cl', now: T0 + 2000 });

    expect(second.id).toBe(first.id);
    expect(second.email).toBe('ana@ejemplo.cl');
  });

  it('rejects an address that is not one', () => {
    completeOnboarding();
    expect(() => signUp({ email: 'ana', now: T0 })).toThrow(SignupError);
    expect(isSignedIn()).toBe(false);
  });
});

describe('activeProfile', () => {
  it('reads the anonymous session before there is an account', () => {
    completeOnboarding();
    const profile = activeProfile(T0);

    expect(profile?.clientId).toBeNull();
    expect(profile?.soulMapId).toBe('synthesis-1');
  });

  it('is null when there is neither an account nor a live session', () => {
    expect(activeProfile(T0)).toBeNull();
  });

  it('survives the session expiring, once there is an account', () => {
    completeOnboarding();
    signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    const wayLater = T0 + 400 * 24 * 60 * 60 * 1000;
    expect(activeProfile(wayLater)?.draft.legal_birth_name).toBe('Ana Perez');
  });
});

describe('regenerating after signup', () => {
  it('moves the account onto the new synthesis', () => {
    completeOnboarding();
    signUp({ email: 'ana@ejemplo.cl', now: T0 + 1000 });

    attachSoulMapToClient('synthesis-2');
    expect(activeProfile(T0 + 2000)?.soulMapId).toBe('synthesis-2');
  });

  it('does nothing when there is no account', () => {
    expect(attachSoulMapToClient('synthesis-2')).toBeNull();
  });
});

describe('email shape check', () => {
  it.each([
    ['ana@ejemplo.cl', true],
    ['ana.perez+natus@ejemplo.com.ar', true],
    ['ana@ejemplo', false],
    ['ana ejemplo@cl', false],
    ['', false],
  ])('%s -> %s', (email, expected) => {
    expect(isPlausibleEmail(email)).toBe(expected);
  });
});
