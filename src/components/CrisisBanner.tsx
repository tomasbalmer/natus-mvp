import { useState } from 'react';
import { CrisisResourceList } from './CrisisResourceList';

/**
 * Low severity. PDR 6.4: nothing is blocked, a persistent banner sits over the
 * normal content, removing modalities are excluded from the pool and the
 * `psicologica` family is prioritised.
 *
 * The PDR left the low-severity response undefined; this is the resolution
 * the plan proposes. Persistent, not dismissible for the session — it can be
 * collapsed, not removed, because the whole point is that it stays available
 * while the person keeps using the product.
 */
export function CrisisBanner({ country }: { country: string | undefined }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="glass-chip mx-2 rounded-[var(--radius-option)] px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-left"
      >
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-alerta shadow-[0_0_8px_var(--natus-alerta)]"
        />
        <span className="flex-1 text-[12px] leading-snug text-crema/80">
          Si en algún momento se pone difícil, hay a quién llamar.
        </span>
        <span aria-hidden="true" className="shrink-0 text-xs text-crema/50">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="pt-3">
          <CrisisResourceList country={country} compact />
        </div>
      )}
    </div>
  );
}
