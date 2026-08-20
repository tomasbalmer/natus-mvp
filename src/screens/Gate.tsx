import { useState } from 'react';
import { PHOTO, Screen } from '@/components/Screen';
import { AuthError, signInWithGoogle } from '@/supabase/session.ts';

/**
 * The door, for a closed pilot. `DECISIONS.md` §13.
 *
 * PDR section 3 asks for the account *after* the Soul Map, because before it
 * an account is a toll gate on a product the person has not seen the value of.
 * That reasoning is about strangers. It does not apply to fifty people invited
 * by name, and this screen says so rather than pretending the sign-in is for
 * the person's benefit.
 *
 * It renders only when a backend is configured. Without one there is nothing
 * to protect and nothing to sign in to, and the fixture demo runs untouched.
 */
export function Gate() {
  const [error, setError] = useState<string | null>(null);
  const [going, setGoing] = useState(false);

  const enter = () => {
    setGoing(true);
    setError(null);
    signInWithGoogle().catch((e: unknown) => {
      setGoing(false);
      setError(
        e instanceof AuthError
          ? 'No pudimos abrir el ingreso con Google. Probá de nuevo en un momento.'
          : 'Algo falló al intentar entrar.',
      );
    });
  };

  return (
    <Screen backdrop="forest" scrim="bottom" opacity={PHOTO.hero} focus="center 20%">
      <div className="mt-auto flex flex-col items-center px-7 pb-13 text-center">
        <div className="relative mb-5 flex size-16 items-center justify-center rounded-full border border-crema/35">
          <span aria-hidden="true" className="absolute inset-1.5 rounded-full border border-crema/15" />
          <span className="font-serif text-[length:var(--fs-voice-22)] font-light tracking-wide text-crema">◯</span>
        </div>

        <p className="eyebrow mb-3">Natus</p>

        <h1 className="mb-4 text-[length:var(--fs-display-sm)] leading-[1.14] text-blanco">
          Esto todavía
          <br />
          <span className="font-serif text-crema italic">no está abierto.</span>
        </h1>

        <p className="mb-8 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema/60">
          Es una versión temprana, con un grupo chico de personas invitadas. Entrá con la
          dirección con la que te invitamos.
        </p>

        <button type="button" className="cta w-full" onClick={enter} disabled={going}>
          {going ? 'Abriendo…' : 'Entrar con Google'}
        </button>

        {error && (
          <p role="alert" className="mt-3 text-[length:var(--fs-body-12)] leading-relaxed text-alerta">
            {error}
          </p>
        )}

        {/*
          Said here rather than discovered mid-flow. Google shows an
          "unverified app" warning to anybody on the test-user list, and
          somebody who was not expecting it reasonably reads it as a scam.
        */}
        <p className="mt-5 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
          Google va a avisarte que la aplicación no está verificada. Es esperable en esta
          etapa: podés continuar.
        </p>

        <p className="mt-3 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
          Si te invitamos y no podés entrar, escribinos: hay que agregar tu dirección a la
          lista.
        </p>
      </div>
    </Screen>
  );
}
