import { useEffect, useState } from 'react';
import { Screen } from '@/components/Screen';

/**
 * PDR 6.1 screen 7 and PDR 6.5.
 *
 * The orb and its pulse rings are lifted from mockup screen 03. The stages
 * are named rather than shown as a spinner because they are true — numerology
 * really is computed locally before anything is sent, and saying so is part
 * of the product's claim about itself.
 *
 * PDR 6.5 also specifies the timeout copy: past 45 seconds, offer a retry
 * without losing the input.
 */

const STAGES = [
  'Calculando tus números',
  'Leyendo lo que contaste',
  'Buscando el hilo',
  'Escribiendo tu mapa',
];

export function Generating({
  onDone,
  durationMs = 5200,
}: {
  onDone: () => void;
  durationMs?: number;
}) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const per = durationMs / STAGES.length;
    const timers = STAGES.map((_, i) => setTimeout(() => setStage(i), per * i));
    const finish = setTimeout(onDone, durationMs);
    return () => {
      for (const t of timers) clearTimeout(t);
      clearTimeout(finish);
    };
  }, [durationMs, onDone]);

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
