import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { SignupError, isSignedIn, signUp } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';

/**
 * The conversion moment of PDR section 3: the account is asked for *after* the
 * Soul Map, never before. By this point the person has answered seven screens
 * and has something on the table; before it, an account is a toll gate.
 *
 * Nothing here is real and the screen says so at the moment of the choice
 * rather than in a policy nobody opens. There is no password field, because a
 * password would be theatre — a static page has nothing to check it against.
 */

const fieldClass =
  'glass w-full rounded-[var(--radius-option)] px-4 py-3 text-sm text-blanco placeholder:text-crema/25';

export function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isSignedIn()) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={0.5}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">Tu cuenta ya está creada.</p>
          <Link to="/inicio" className="cta no-underline">
            Ir a mi espacio
          </Link>
        </div>
      </Screen>
    );
  }

  if (!currentSynthesis()) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={0.5}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Primero generamos tu mapa. La cuenta viene después, cuando ya tengas algo que
            guardar.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  const submit = () => {
    try {
      signUp({ email });
      navigate('/inicio');
    } catch (e) {
      setError(
        e instanceof SignupError
          ? 'Revisá la dirección: parece que le falta algo.'
          : 'No pudimos guardar la cuenta en este navegador.',
      );
    }
  };

  return (
    <Screen backdrop="surf" scrim="heavy" opacity={0.5}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-6 pt-[var(--top-inset)] pb-9 sm:min-h-0">
        <p className="eyebrow mb-3">Guardar tu mapa</p>

        <h1 className="mb-3 text-[30px] leading-[1.15] text-blanco">
          Para volver
          <br />
          <span className="font-serif text-crema italic">cuando quieras.</span>
        </h1>

        <p className="mb-7 text-[12.5px] leading-relaxed text-crema/55">
          Tu mapa, tus caminos y tu rutina quedan asociados a esta dirección. Podés seguir sin
          cuenta: en ese caso todo se guarda igual, pero solo en este navegador y por siete
          días.
        </p>

        <label className="mb-1.5 block text-[11px] tracking-wide text-crema/50 uppercase" htmlFor="email">
          Tu correo
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className={fieldClass}
          value={email}
          placeholder="vos@ejemplo.com"
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          aria-describedby="email-note"
          aria-invalid={error !== null}
        />

        {error && (
          <p role="alert" className="mt-2 text-[12px] leading-relaxed text-alerta">
            {error}
          </p>
        )}

        <p id="email-note" className="mt-2.5 text-[11px] leading-relaxed text-crema/35">
          En esta demo no se envía ningún correo ni se crea ninguna cuenta en ningún servidor.
          La dirección queda escrita en este navegador y nada más. Podés borrar todo en un
          clic desde Mi cuenta.
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <button type="button" className="cta" onClick={submit} disabled={email.trim() === ''}>
            Crear mi cuenta
          </button>

          <Link
            to="/inicio"
            className="glass-chip rounded-full px-3 py-2.5 text-center text-[11px] tracking-wide text-crema/60 uppercase no-underline"
          >
            Ahora no
          </Link>
        </div>
      </div>
    </Screen>
  );
}
