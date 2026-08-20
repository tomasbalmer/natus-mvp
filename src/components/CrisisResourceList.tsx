import { resourcesForCountry, telHref } from '@/lib/crisis-resources';

/**
 * The list of places to call. Shared by the full-screen takeover and the
 * banner so the two can never drift apart.
 */
export function CrisisResourceList({
  country,
  compact = false,
}: {
  country: string | undefined;
  compact?: boolean;
}) {
  const set = resourcesForCountry(country);

  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2'}>
      {set.resources.map((r) => (
        <a
          key={`${r.country}-${r.name}`}
          href={telHref(r.contact)}
          className="glass flex items-center gap-3 rounded-[var(--radius-option)] px-4 py-3 no-underline"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[length:var(--fs-body-14)] leading-5 text-blanco">{r.name}</p>
            {r.note && <p className="truncate text-[length:var(--fs-body-11)] text-crema/55">{r.note}</p>}
          </div>
          <span className="shrink-0 font-serif text-[length:var(--fs-numeral-18)] leading-7 text-crema">{r.contact}</span>
        </a>
      ))}

      {/* PDR 6.4: never leave the list empty, and always offer a way out of
          the five MVP countries. */}
      <a
        href={set.fallback.url}
        target="_blank"
        rel="noreferrer noopener"
        className="glass flex items-center gap-3 rounded-[var(--radius-option)] px-4 py-3 no-underline"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--fs-body-14)] leading-5 text-blanco">{set.fallback.name}</p>
          <p className="truncate text-[length:var(--fs-body-11)] text-crema/55">{set.fallback.note}</p>
        </div>
        <span aria-hidden="true" className="shrink-0 text-crema/60">
          ↗
        </span>
      </a>

      {set.unverified && (
        /*
         * Honesty about the state of the data. PDR 6.4 makes telephone
         * verification an absolute launch blocker; until `verified_at` is set
         * in data/crisis-resources.json, saying nothing would let a demo imply
         * these numbers were checked. Deleting this notice is not the fix —
         * verifying the numbers is.
         */
        <p className="px-1 pt-1 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
          Estos números están tomados de fuentes públicas y todavía no fueron
          verificados uno por uno. Si alguno no responde, entrá a{' '}
          <span className="text-crema/70">findahelpline.com</span> o llamá al número de
          emergencias de tu país.
        </p>
      )}
    </div>
  );
}
