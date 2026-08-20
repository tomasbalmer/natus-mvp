import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PHOTO, Screen } from '@/components/Screen';
import { SignupError, isSignedIn, signUp } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import { isBackendConfigured } from '@/supabase/client.ts';
import { upgradeToEmail } from '@/supabase/session.ts';

/**
 * The conversion moment of PDR section 3: the account is asked for *after* the
 * Soul Map, never before. By this point the person has answered seven screens
 * and has something on the table; before it, an account is a toll gate.
 *
 * What the screen says about itself has to keep matching what it does, at the
 * moment of the choice rather than in a policy nobody opens. It used to say no
 * account is created on any server, which was true of the static demo and
 * stopped being true the moment there was a backend; the note under the field
 * now branches on whether one is configured, so both builds tell the truth.
 *
 * Still no password field, and now for a better reason than the old one: the
 * address is attached to an `auth.users` row that has existed since the first
 * page load, and confirming it is a link in an email. There is nothing for a
 * password to protect that the anonymous session was not already holding.
 */

const fieldClass =
  'glass w-full rounded-[var(--radius-option)] px-4 py-3 text-[length:var(--fs-body-14)] leading-5 text-blanco placeholder:text-crema/55';

export function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (isSignedIn()) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content50}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">Tu cuenta ya está creada.</p>
          <Link to="/inicio" className="cta no-underline">
            Ir a mi espacio
          </Link>
        </div>
      </Screen>
    );
  }

  if (!currentSynthesis()) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content50}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">
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
    let created = false;
    try {
      signUp({ email });
      created = true;
    } catch (e) {
      setError(
        e instanceof SignupError
          ? 'Revisá la dirección: parece que le falta algo.'
          : 'No pudimos guardar la cuenta en este navegador.',
      );
      return;
    }

    if (!created || !isBackendConfigured) {
      navigate('/inicio');
      return;
    }

    // The local record is written first and the identity is attached second.
    // If the order were reversed and the local write then failed, the account
    // would exist with nothing on it — the same reasoning `store/account.ts`
    // gives for writing the client before claiming the session.
    //
    // The address goes onto the anonymous auth.users row that has existed
    // since the first page load, so nothing here moves data. That is the whole
    // reason this product asks for an account after the Soul Map rather than
    // before it: by now there is something to attach, and attaching it costs
    // the person nothing.
    setSending(true);
    upgradeToEmail(email)
      .then(() => setSent(true))
      .catch(() => {
        // The answers are saved either way. Only the confirmation failed, and
        // saying "no pudimos crear tu cuenta" here would be false.
        setError('Guardamos todo, pero no pudimos enviarte el correo de confirmación.');
      })
      .finally(() => setSending(false));
  };

  if (sent) {
    return (
      <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content50}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">
            Te mandamos un correo a <span className="text-blanco">{email}</span>. Abrilo para
            confirmar la dirección.
          </p>
          <p className="text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
            Tu mapa ya está guardado. Confirmar sirve para que puedas volver desde otro
            dispositivo.
          </p>
          <Link to="/inicio" className="cta no-underline">
            Ir a mi espacio
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content50}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-6 pt-[var(--top-inset)] pb-9 sm:min-h-0">
        <p className="eyebrow mb-3">Guardar tu mapa</p>

        <h1 className="mb-3 text-[length:var(--fs-title-30)] leading-[1.15] text-blanco">
          Para volver
          <br />
          <span className="font-serif text-crema italic">cuando quieras.</span>
        </h1>

        <p className="mb-7 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema/55">
          Tu mapa, tus caminos y tu rutina quedan asociados a esta dirección. Podés seguir sin
          cuenta: en ese caso todo se guarda igual, pero solo en este navegador y por siete
          días.
        </p>

        <label className="mb-1.5 block text-[length:var(--fs-label-11)] tracking-wide text-crema/55 uppercase" htmlFor="email">
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
          <p role="alert" className="mt-2 text-[length:var(--fs-body-12)] leading-relaxed text-alerta">
            {error}
          </p>
        )}

        <p id="email-note" className="mt-2.5 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
          {isBackendConfigured
            ? 'Te vamos a mandar un correo con un link para confirmar la dirección. No hay contraseña. Podés borrar todo en un clic desde Mi cuenta.'
            : 'En esta demo no se envía ningún correo ni se crea ninguna cuenta en ningún servidor. La dirección queda escrita en este navegador y nada más. Podés borrar todo en un clic desde Mi cuenta.'}
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-8">
          <button
            type="button"
            className="cta"
            onClick={submit}
            disabled={email.trim() === '' || sending}
          >
            {sending ? 'Guardando…' : 'Crear mi cuenta'}
          </button>

          <Link
            to="/inicio"
            className="glass-chip rounded-full px-3 py-2.5 text-center text-[length:var(--fs-label-11)] tracking-wide text-crema/60 uppercase no-underline"
          >
            Ahora no
          </Link>
        </div>
      </div>
    </Screen>
  );
}
