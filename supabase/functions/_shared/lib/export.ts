/**
 * The take-my-data-with-me half of PDR 11.3.
 *
 * Pure on purpose, like everything else in `src/lib`: it takes a snapshot and
 * returns a document. Reading storage and handing the browser a file are the
 * caller's job, which is what lets the same function run server-side once
 * there is a server to run it on.
 *
 * The one rule with teeth is the redaction. A BYOK viewer's Anthropic key
 * lives in the same storage as everything else, and an export that swept it up
 * would put a working credential into a file people mail to themselves.
 * `src/ai/mode.ts` states that the key is never included in an export; this is
 * where that sentence is enforced rather than promised.
 */

export const EXPORT_FORMAT = 'natus-export';
export const EXPORT_FORMAT_VERSION = 1;

export const REDACTED = '[redactado]';

/** Compared lowercased, so `apiKey` and `api_key` are the same rule. */
const REDACTED_KEYS = new Set(['apikey', 'api_key', 'anthropic_api_key', 'key', 'token']);

export type ExportDocument = {
  format: typeof EXPORT_FORMAT;
  format_version: number;
  exported_at: string;
  source: 'browser_local_storage';
  notice: string;
  data: Record<string, unknown>;
};

const NOTICE =
  'Todo lo que Natus guardó de vos, tal como está en este navegador. Es una demo: ' +
  'nada de esto vive en un servidor. Si usaste tu propia clave de API, no está acá — ' +
  'se reemplazó por una marca.';

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? inner === null || inner === undefined
        ? inner
        : REDACTED
      : redact(inner);
  }
  return out;
}

export function buildExport(
  snapshot: Record<string, unknown>,
  options: { exportedAt: string },
): ExportDocument {
  return {
    format: EXPORT_FORMAT,
    format_version: EXPORT_FORMAT_VERSION,
    exported_at: options.exportedAt,
    source: 'browser_local_storage',
    notice: NOTICE,
    data: redact(snapshot) as Record<string, unknown>,
  };
}

/** `natus-export-2026-08-11.json`. Sorts sensibly in a downloads folder. */
export function exportFileName(exportedAt: string): string {
  const day = exportedAt.slice(0, 10);
  return `natus-export-${day}.json`;
}
