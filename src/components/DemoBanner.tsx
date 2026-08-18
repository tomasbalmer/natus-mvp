import { useState } from 'react';
import { isBackendConfigured } from '@/supabase/client';

/**
 * This demo asks people about anxiety, grief and suicidal ideation. It would
 * be dishonest to let it look like a running service, and dishonest to be
 * vague about where the text they type ends up.
 *
 * So the banner says two things plainly: this is a prototype, and here is
 * where your words go. It is dismissible per session but returns on reload —
 * it is a disclosure, not a cookie notice.
 *
 * It reads the build rather than a stored preference, because the preference
 * is gone. Until step 5.7 a viewer chose between hand-written fixtures and
 * their own pasted key, and the banner named whichever was live. Now the
 * answer is a property of the deployment: without a backend nothing leaves
 * the browser at all, and with one, a signed-in person's words reach our
 * servers and Anthropic. Saying "no se envía a ningún servidor" on a build
 * that has one would be the exact dishonesty this component exists against.
 */
export function DemoBanner() {
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
        <span aria-hidden="true" className="shrink-0 text-[11px] text-crema/55">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <p className="px-3.5 pb-2.5 text-[11px] leading-relaxed text-crema/60">
          {isBackendConfigured
            ? 'Si iniciaste sesión, lo que escribas se envía a los servidores de Natus y desde ahí a la API de Anthropic. Sin sesión, las respuestas vienen de guiones escritos a mano y nada sale de este navegador.'
            : 'Las respuestas vienen de guiones escritos a mano. Lo que escribas queda en este navegador y no se envía a ningún servidor.'}{' '}
          Los números de crisis todavía no fueron verificados uno por uno.
        </p>
      )}
    </div>
  );
}
