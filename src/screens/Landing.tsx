import { Link, useNavigate } from 'react-router-dom';
import { PHOTO, Screen } from '@/components/Screen';
import { currentSynthesis } from '@/store/soulMap';

/** Screen 1 of PDR 6.1, built from mockup screen 01. */
export function Landing() {
  const navigate = useNavigate();
  // Someone who already has a map should not be met by a first-run screen.
  const returning = currentSynthesis() !== undefined;

  return (
    <Screen backdrop="forest" scrim="bottom" opacity={PHOTO.hero} focus="center 20%">
      <div className="mt-auto flex flex-col items-center px-7 pb-13 text-center">
        <div className="relative mb-5 flex size-16 items-center justify-center rounded-full border border-crema/35">
          <span aria-hidden="true" className="absolute inset-1.5 rounded-full border border-crema/15" />
          <span className="font-serif text-[length:var(--fs-voice-22)] font-light tracking-wide text-crema">◯</span>
        </div>

        <p className="eyebrow mb-3">Bienvenido a tu camino</p>

        <h1 className="mb-3.5 text-[length:var(--fs-display)] leading-[var(--lh-heading-1_12)] text-blanco">
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
        <p className="mb-8 max-w-[268px] text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">
          Un espejo para lo que estás atravesando. Sin cuenta, sin diagnóstico.
        </p>

        <button
          type="button"
          className="cta"
          onClick={() => navigate(returning ? '/inicio' : '/onboarding')}
        >
          <span>{returning ? 'Volver a mi espacio' : 'Comenzar'}</span>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-crema/15 text-[length:var(--fs-body-14)] leading-5"
          >
            →
          </span>
        </button>

        {returning && (
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="mt-3 px-2 py-1 text-[length:var(--fs-body-11)] text-crema/55 underline underline-offset-4 hover:text-crema/70"
          >
            Empezar de nuevo
          </button>
        )}

        <div className="mt-4 flex items-center gap-4 text-[length:var(--fs-label-10)] tracking-wide uppercase">
          <Link to="/lab/safety" className="text-crema/55 no-underline hover:text-crema/60">
            Safety
          </Link>
        </div>
      </div>
    </Screen>
  );
}
