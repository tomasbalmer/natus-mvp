import { useEffect, useRef, useState } from 'react';
import { Screen } from '@/components/Screen';
import { generateSoulMap } from '@/ai/soul-map';
import { saveSynthesis } from '@/store/soulMap';
import { AiError } from '@/ai/client';
import type { Numerology } from '@/lib/schemas';
import type { OnboardingDraft } from '@/store/session';
import { SOUL_MAP_PROMPT_VERSION } from '@/ai/prompts/soul-map';

/**
 * PDR 6.1 screen 7 and PDR 6.5.
 *
 * The orb and its pulse rings come from mockup screen 03. The stages are
 * named rather than shown as a spinner because they are true — the numbers
 * really are computed locally before anything is sent — and saying so is part
 * of the product's claim about itself.
 *
 * In fixture mode the work finishes almost instantly, and the screen still
 * takes a few seconds on purpose. Showing an instant result would
 * misrepresent a product whose real generation takes ten to thirty seconds.
 */

const STAGES = [
  'Calculando tus números',
  'Leyendo lo que contaste',
  'Buscando el hilo',
  'Escribiendo tu mapa',
];

const MINIMUM_MS = 4800;

export function Generating({
  draft,
  numerology,
  onDone,
  onFailed,
}: {
  draft: OnboardingDraft;
  numerology: Numerology | null;
  onDone: () => void;
  onFailed: (message: string) => void;
}) {
  const [stage, setStage] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in development; generating twice
    // would burn two API calls on someone else's key.
    if (started.current) return;
    started.current = true;

    const timers = STAGES.map((_, i) =>
      setTimeout(() => setStage(i), (MINIMUM_MS / STAGES.length) * i),
    );

    const run = async () => {
      const floor = new Promise((resolve) => setTimeout(resolve, MINIMUM_MS));
      try {
        const [result] = await Promise.all([generateSoulMap({ draft, numerology }), floor]);
        saveSynthesis({
          synthesis: result.value,
          numerology,
          promptVersion: SOUL_MAP_PROMPT_VERSION,
          mode: result.mode,
          latencyMs: result.latencyMs,
        });
        onDone();
      } catch (error) {
        await floor;
        onFailed(messageFor(error));
      }
    };

    void run();
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [draft, numerology, onDone, onFailed]);

  return (
    <Screen backdrop="surf" scrim="diagonal" opacity={0.7}>
      <div className="flex min-h-dvh flex-col items-center justify-center gap-9 px-8 text-center sm:min-h-0">
        <div className="relative flex size-30 items-center justify-center">
          <span className="orb-pulse" aria-hidden="true" />
          <span className="orb-pulse orb-pulse-2" aria-hidden="true" />
          <span className="glass relative z-10 flex size-18 items-center justify-center rounded-full shadow-[0_0_40px_rgb(28_56_41/0.4)]">
            <span className="flex items-center gap-[3px]" aria-hidden="true">
              {[10, 18, 24, 18, 10].map((h, i) => (
                <span
                  key={i}
                  className="wave-bar w-[3px] rounded-sm bg-crema"
                  style={{ height: `${h}px`, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </span>
        </div>

        <div aria-live="polite" className="min-h-12">
          <p className="font-serif text-[22px] leading-snug font-light text-blanco">
            {STAGES[stage]}
          </p>
          <p className="mt-2 text-[11px] tracking-wide text-crema/40">
            Esto puede tardar un momento
          </p>
        </div>
      </div>
    </Screen>
  );
}

/** PDR 6.5: empathetic copy, never a technical error, and the input is kept. */
function messageFor(error: unknown): string {
  if (!(error instanceof AiError)) {
    return 'Algo se cortó en el camino. Nada de lo que escribiste se perdió.';
  }
  switch (error.kind) {
    case 'timeout':
      return 'Esto está tardando más de lo normal. Nada se perdió: podemos reintentar.';
    case 'api_error':
      return 'No pudimos completar la generación. Revisá tu clave y reintentamos.';
    case 'copy_violation':
      // Worth being specific: this one means the model broke a product rule
      // rather than failing technically, and that is a prompt problem.
      return 'La respuesta no cumplió las reglas de lenguaje del producto y se descartó. Podemos reintentar.';
    default:
      return 'La respuesta llegó incompleta. Nada se perdió: podemos reintentar.';
  }
}
