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
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div
      role="note"
      className="glass-chip relative z-50 flex items-start gap-3 px-4 py-2.5 text-[11px] leading-relaxed text-crema/80"
    >
      <span aria-hidden="true" className="mt-[3px] size-1.5 shrink-0 rounded-full bg-tierra" />
      <p className="flex-1">
        <span className="font-medium tracking-wide uppercase">Demo</span> — prototipo de
        producto, no un servicio de salud.{' '}
        {aiMode === 'fixture'
          ? 'Lo que escribas queda en este navegador y no se envía a ningún servidor.'
          : 'Modo IA activo: lo que escribas se envía a la API de Anthropic con tu clave.'}
      </p>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Ocultar el aviso de demo"
        className="shrink-0 px-1 text-crema/50 hover:text-crema"
      >
        ×
      </button>
    </div>
  );
}
