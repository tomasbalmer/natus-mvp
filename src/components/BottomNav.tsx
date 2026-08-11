import { NavLink } from 'react-router-dom';

/**
 * The glass navigation of the mockups, extended past their three icons.
 *
 * The mockup drew three, because the May scope had three destinations. The
 * PDR's journey has six that matter once the Soul Map exists, and six fits
 * across 335px if the glyphs stay small and the labels stay short.
 *
 * The glyphs are decorative and marked as such: they are abstract marks, not
 * pictograms anyone can read cold, so the label carries the meaning and the
 * accessible name. No emoji — a row of them undoes the register the
 * photography and the serif set up.
 */

const ITEMS: { to: string; label: string; glyph: string }[] = [
  { to: '/inicio', label: 'Inicio', glyph: '◯' },
  { to: '/mapa', label: 'Mapa', glyph: '✦' },
  { to: '/recomendaciones', label: 'Caminos', glyph: '◈' },
  // A list mark, not a chevron: `❯` read as "next" in the browser check and
  // made the nav item look like a step in a flow.
  { to: '/rutina', label: 'Rutina', glyph: '≡' },
  { to: '/chat', label: 'Chat', glyph: '△' },
  { to: '/cuenta', label: 'Cuenta', glyph: '⌾' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Secciones"
      className="glass-chip pointer-events-auto flex items-stretch justify-between gap-1 rounded-[var(--radius-pill)] px-1.5 py-1.5"
    >
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [
              'flex flex-1 flex-col items-center gap-1 rounded-[18px] px-1 py-2 no-underline transition-colors',
              isActive ? 'bg-crema/12 text-crema' : 'text-crema/55 hover:text-crema/75',
            ].join(' ')
          }
        >
          <span aria-hidden="true" className="text-[13px] leading-none">
            {item.glyph}
          </span>
          <span className="text-[9px] leading-none tracking-[0.14em] uppercase">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
