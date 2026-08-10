import { Route, Routes } from 'react-router-dom';
import { PhoneFrame } from '@/components/PhoneFrame';
import { DemoBanner } from '@/components/DemoBanner';
import { Screen } from '@/components/Screen';

/**
 * Shell only. Screens land in Phase 3 onwards; this establishes the frame,
 * the routing and the disclosure so Phase 0 ends on something deployable.
 */
function Placeholder() {
  return (
    <Screen backdrop="forest" scrim="bottom" opacity={0.9} focus="center 20%">
      <div className="mt-auto flex flex-col items-center px-7 pb-13 text-center">
        <div className="relative mb-5 flex size-16 items-center justify-center rounded-full border border-crema/35">
          <span
            aria-hidden="true"
            className="absolute inset-1.5 rounded-full border border-crema/15"
          />
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

        <p className="mb-8 max-w-[260px] text-sm leading-relaxed text-crema/65">
          Un espejo para lo que estás atravesando.
        </p>

        <button type="button" className="cta" disabled>
          <span>Comenzar</span>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-crema/15 text-sm"
          >
            →
          </span>
        </button>

        <p className="mt-4 text-[10px] tracking-wide text-crema/35 uppercase">
          Fase 0 — shell
        </p>
      </div>
    </Screen>
  );
}

export function App() {
  return (
    <PhoneFrame>
      <div className="absolute inset-x-0 top-0 z-50 p-2">
        <DemoBanner aiMode="fixture" />
      </div>
      <Routes>
        <Route path="/" element={<Placeholder />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </PhoneFrame>
  );
}
