import { read, write } from './db';

/**
 * The `preferences` row of PDR 5.2.
 *
 * The language is honest about what it does: the demo's interface is written
 * in Spanish, so choosing English records the preference without translating
 * anything. PDR 11.3 lists the language choice as a data right alongside
 * export and deletion, which is why it is stored at all rather than being a UI
 * toggle.
 *
 * The two volumes are here rather than in component state because PDR 9.5
 * expects them to survive a reload — someone who turned the bed down did so
 * for a reason that is still true tomorrow.
 */

export type Locale = 'es' | 'en';

export type Preferences = {
  locale: Locale;
  voice_volume: number;
  bed_volume: number;
};

const DEFAULT: Preferences = { locale: 'es', voice_volume: 1, bed_volume: 0.45 };

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

export function getPreferences(): Preferences {
  const stored = read<Partial<Preferences>>('preferences', DEFAULT);
  return {
    locale: stored.locale === 'en' ? 'en' : 'es',
    voice_volume: clampVolume(stored.voice_volume, DEFAULT.voice_volume),
    bed_volume: clampVolume(stored.bed_volume, DEFAULT.bed_volume),
  };
}

export function setLocale(locale: Locale): Preferences {
  return patch({ locale });
}

export function setVolumes(volumes: { voice?: number; bed?: number }): Preferences {
  return patch({
    ...(volumes.voice === undefined ? {} : { voice_volume: clampVolume(volumes.voice, 1) }),
    ...(volumes.bed === undefined ? {} : { bed_volume: clampVolume(volumes.bed, 0.45) }),
  });
}

function patch(changes: Partial<Preferences>): Preferences {
  const next: Preferences = { ...getPreferences(), ...changes };
  write('preferences', next);
  return next;
}
