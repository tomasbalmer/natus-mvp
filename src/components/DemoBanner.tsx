import { useState } from 'react';

/**
 * This demo asks people about anxiety, grief and suicidal ideation. It would
 * be dishonest to let it look like a running service, and dishonest to be
 * vague about where the text they type ends up.
 *
 * So the banner says two things plainly: this is a prototype, and here is
 * where your words go in the mode you are currently in. It is dismissible per
 * session but returns on reload — it is a disclosure, not a cookie notice.
 */
export function DemoBanner({ aiMode }: { aiMode: 'fixture' | 'byok' }) {
  const [open, setOpen] = useState(false);

  return (
    <div role="note" className="glass-chip relative z-50 rounded-[var(--radius-option)]">
      {/*
       * One line by default. The first draft ran to three and sat on top of
       * every screen's heading — a disclosure nobody can read past is worse
       * than a short one they can open.
       */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left"
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-tierra" />
        <span className="flex-1 truncate text-[11px] text-crema/75">
          <span className="font-medium tracking-wide uppercase">Demo</span> — prototipo, no es
          un servicio de salud
        </span>
        <span aria-hidden="true" className="shrink-0 text-[11px] text-crema/40">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <p className="px-3.5 pb-2.5 text-[11px] leading-relaxed text-crema/60">
          {aiMode === 'fixture'
            ? 'Las respuestas vienen de guiones escritos a mano. Lo que escribas queda en este navegador y no se envía a ningún servidor.'
            : 'Modo IA activo: lo que escribas se envía a la API de Anthropic usando tu propia clave.'}{' '}
          Los números de crisis todavía no fueron verificados uno por uno.
        </p>
      )}
    </div>
  );
}
