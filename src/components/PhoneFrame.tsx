import type { ReactNode } from 'react';

/**
 * The mockups are drawn as 335x726 phone frames on a dark page. That framing
 * is right for a demo shown on a laptop, and wrong on an actual phone, where
 * a bezel around a bezel is absurd.
 *
 * So: full-bleed below the `sm` breakpoint, framed above it.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-fondo sm:p-8">
      <div
        className={[
          'relative w-full overflow-hidden bg-black',
          'min-h-dvh',
          // Framed presentation on anything wider than a phone.
          'sm:h-[726px] sm:max-w-[335px] sm:min-h-0 sm:rounded-[var(--radius-frame)]',
          'sm:shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_40px_120px_rgb(0_0_0/0.8),0_0_80px_rgb(28_56_41/0.15)]',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
