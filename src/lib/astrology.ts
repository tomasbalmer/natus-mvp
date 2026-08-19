/**
 * Narrowing an untrusted birth subject before it can consume a provider call.
 *
 * Pure, and here rather than beside the Edge Function because the browser
 * validates the same shape before sending it and the server validates it
 * again on arrival. Two copies of a bounds check drift, and the one that
 * drifts loose is the one that spends money.
 */

export type AstrologerSubject = {
  name: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  city: string;
  nation: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): number | null {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : null;
}

/** Narrows an untrusted request body before it can consume a provider call. */
export function parseAstrologerSubject(value: unknown): AstrologerSubject | null {
  if (!isRecord(value)) return null;

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const city = typeof value.city === 'string' ? value.city.trim() : '';
  const nation = typeof value.nation === 'string' ? value.nation.trim().toUpperCase() : '';
  const year = integer(value.year, 1, 3000);
  const month = integer(value.month, 1, 12);
  const day = integer(value.day, 1, 31);
  const hour = integer(value.hour, 0, 23);
  const minute = integer(value.minute, 0, 59);

  if (
    !name ||
    name.length > 160 ||
    !city ||
    city.length > 120 ||
    !/^[A-Z]{2}$/.test(nation) ||
    year === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null
  ) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { name, year, month, day, hour, minute, city, nation };
}
