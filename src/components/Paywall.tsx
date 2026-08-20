/**
 * The end of the free questions. PDR section 3.
 *
 * Two rules shape this component. It never appears over a crisis turn — the
 * caller checks safety first, and PDR 1.6 forbids a commercial fallback in
 * that moment. And it does not take the screen: what the person typed is still
 * in the box behind it, still theirs, and comes back untouched if they close
 * this.
 *
 * Nothing is charged. Saying so on the button itself is the honest version of
 * a simulated paywall — a demo that mimics a checkout teaches whoever is
 * watching something false about what was built.
 */
export function Paywall({
  used,
  onSimulate,
  onDismiss,
}: {
  used: number;
  onSimulate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label="Se terminaron tus preguntas incluidas"
      className="glass rounded-[var(--radius-option)] px-4 py-4"
    >
      <p className="eyebrow mb-2">Hasta acá llega lo incluido</p>
      <h2 className="mb-2 text-[length:var(--fs-heading-17)] leading-snug text-blanco">
        Usaste tus {used} preguntas.
      </h2>
      <p className="mb-3.5 text-[length:var(--fs-body-12)] leading-relaxed text-crema/55">
        Lo que escribiste sigue guardado en el cuadro de abajo. Tu mapa, tus caminos y tu
        rutina siguen disponibles sin pagar nada.
      </p>

      <div className="flex flex-col gap-2">
        <button type="button" className="cta" onClick={onSimulate}>
          Simular acceso completo
        </button>
        <p className="px-1 text-[length:var(--fs-body-10_5)] leading-relaxed text-crema/55">
          Esto no cobra nada. No hay pasarela de pago en esta demo: el botón sólo cambia el
          estado para que puedas seguir viendo cómo funciona.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="glass-chip rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/60 uppercase"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
