import { read, write } from '@/store/db';

/**
 * Which AI implementation is live, and the key if the viewer supplied one.
 *
 * The key is held in this browser and sent to exactly one place: Anthropic.
 * It is never logged, never included in an export, and never leaves in any
 * other request — there is no server here to send it to.
 *
 * Fixture is the default on purpose. A live demo that depends on a network
 * call and someone else's API quota is a demo that fails in the room.
 */

export type AiMode = 'fixture' | 'byok';

type StoredMode = { mode: AiMode; apiKey: string | null };

const DEFAULT: StoredMode = { mode: 'fixture', apiKey: null };

export function getAiMode(): StoredMode {
  const stored = read<StoredMode>('ai_mode', DEFAULT);
  // A stored `byok` with no key would fail on the first call; treat it as
  // fixture until a key is actually present.
  if (stored.mode === 'byok' && !stored.apiKey) return DEFAULT;
  return stored;
}

export function setFixtureMode(): void {
  write<StoredMode>('ai_mode', DEFAULT);
}

export function setByokMode(apiKey: string): void {
  write<StoredMode>('ai_mode', { mode: 'byok', apiKey: apiKey.trim() });
}

/** Anthropic keys start with `sk-ant-`. A shape check, not a validation. */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[\w-]{20,}$/.test(key.trim());
}
