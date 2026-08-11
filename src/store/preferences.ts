import { read, write } from './db';

/**
 * The `preferences` row of PDR 5.2.
 *
 * Only the language lives here so far, and it is honest about what it does:
 * the demo's interface is written in Spanish, so choosing English records the
 * preference without translating anything. PDR 11.3 lists the language choice
 * as a data right alongside export and deletion, which is why it is stored at
 * all rather than being a UI toggle.
 */

export type Locale = 'es' | 'en';

export type Preferences = {
  locale: Locale;
};

const DEFAULT: Preferences = { locale: 'es' };

export function getPreferences(): Preferences {
  const stored = read<Partial<Preferences>>('preferences', DEFAULT);
  return { locale: stored.locale === 'en' ? 'en' : 'es' };
}

export function setLocale(locale: Locale): Preferences {
  const next: Preferences = { ...getPreferences(), locale };
  write('preferences', next);
  return next;
}
