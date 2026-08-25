/**
 * The 52px glass row from mockup screen 02.
 *
 * The mockup put an emoji at the head of each row. Dropped: Cormorant
 * Garamond over desaturated photography is a sober register, and a row of
 * emoji pulls it toward a generic wellness app. The check mark on the right
 * carries the selected state on its own.
 */
export function OptionItem({
  label,
  hint,
  selected,
  onToggle,
  multi = true,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onToggle: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={[
        'option flex w-full items-center gap-3 text-left transition-colors',
        hint ? 'min-h-[var(--h-option)] py-2.5' : 'h-[var(--h-option)]',
        selected
          ? 'border-tierra/50 bg-verde/60 text-crema'
          : 'option-glass text-blanco/85',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--fs-body-13)] leading-snug">{label}</span>
        {hint && <span className="mt-0.5 block text-[length:var(--fs-body-11)] leading-snug text-crema/55">{hint}</span>}
      </span>

      <span
        aria-hidden="true"
        className={[
          'flex size-[18px] shrink-0 items-center justify-center rounded-full border text-[length:var(--fs-micro-10)]',
          selected ? 'border-tierra bg-tierra text-white' : 'border-crema/30',
        ].join(' ')}
      >
        {selected ? '✓' : ''}
      </span>
    </button>
  );
}
