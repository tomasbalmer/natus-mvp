import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { AiModeToggle } from '@/components/AiModeToggle';
import type { AiMode } from '@/ai/mode';

/** Screen 1 of PDR 6.1, built from mockup screen 01. */
export function Landing({
  onAiModeChange,
}: {
  onAiModeChange?: ((mode: AiMode) => void) | undefined;
}) {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <Screen backdrop="forest" scrim="bottom" opacity={0.9} focus="center 20%">
      <div className="mt-auto flex flex-col items-center px-7 pb-13 text-center">
        <div className="relative mb-5 flex size-16 items-center justify-center rounded-full border border-crema/35">
          <span aria-hidden="true" className="absolute inset-1.5 rounded-full border border-crema/15" />
          <span className="font-serif text-[22px] font-light tracking-wide text-crema">◯</span>
        </div>

        <p className="eyebrow mb-3">Bienvenido a tu camino</p>

        <h1 className="mb-3.5 text-[40px] leading-[1.12] text-blanco">
          El Inicio
          <br />
          de Una
          <br />
          Nueva Vida
        </h1>

        {/*
         * The mockup read "Tu carta astral. Tu dolor. El terapeuta que te
         * entiende." Two problems with it, both from PDR 1.1: "tu dolor" casts
         * the person as a patient rather than the protagonist, and promising
         * "el terapeuta que te entiende" is a prediction of alliance the MVP
         * cannot make — it recommends modalities, not people.
         */}
        <p className="mb-8 max-w-[268px] text-sm leading-relaxed text-crema/65">
          Un espejo para lo que estás atravesando. Sin cuenta, sin diagnóstico.
        </p>

        <button type="button" className="cta" onClick={() => navigate('/onboarding')}>
          <span>Comenzar</span>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-crema/15 text-sm"
          >
            →
          </span>
        </button>

        {showSettings && (
          <div className="mt-4 w-full text-left">
            <AiModeToggle onChange={onAiModeChange} />
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[10px] tracking-wide uppercase">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="text-crema/30 hover:text-crema/60"
          >
            Modo IA
          </button>
          <span aria-hidden="true" className="text-crema/15">
            ·
          </span>
          <Link to="/lab/safety" className="text-crema/30 no-underline hover:text-crema/60">
            Safety
          </Link>
        </div>
      </div>
    </Screen>
  );
}
