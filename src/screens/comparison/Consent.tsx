import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PHOTO, Screen } from '@/components/Screen';
import { ComparisonGate } from './Gate';
import {
  CONSENT_TTL_MS,
  consentFor,
  externalProfileById,
  isConsentActive,
  requestConsent,
  respondToConsent,
  revokeConsent,
} from '@/store/comparison';
import type { ComparisonScope } from '@/lib/comparison-payload';
import { isScopeUsable } from '@/lib/comparison-payload';

/**
 * The consent of PDR 8.2, simulated between two local profiles.
 *
 * In production this is a transactional email to a second person, who opens a
 * link and answers. There is no mail provider in a static build, so the second
 * person's side is a panel on this screen — which changes who taps the button
 * and nothing about the rule: no granted, unexpired consent, no reading.
 *
 * The screen says that out loud rather than pretending an email went out. A
 * demo that mimes sending mail teaches whoever is watching something false
 * about what exists.
 */

const SCOPE_LABELS: [keyof ComparisonScope, string, string][] = [
  ['numerology', 'Los números', 'Camino de vida, expresión, alma, personalidad, cumpleaños.'],
  [
    'astro',
    'La carta natal',
    'Los aspectos entre las dos cartas, calculados por efeméride. Hace falta fecha, hora, ciudad y país de nacimiento de las dos partes.',
  ],
  ['soul_map_themes', 'Los temas del mapa', 'Los temas generales, nunca lo que escribió cada una.'],
];

function days(ms: number): number {
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function Consent() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const profile = externalProfileById(id);
  const [consent, setConsent] = useState(() => consentFor(id));
  const [scope, setScope] = useState<ComparisonScope>(
    () => consent?.scope ?? { numerology: true, astro: false, soul_map_themes: true },
  );

  if (!profile) {
    return (
      <ComparisonGate>
        <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content45}>
          <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
            <p className="text-[length:var(--fs-body-14)] leading-relaxed text-crema/65">Esa persona ya no está cargada.</p>
            <Link to="/comparacion" className="cta no-underline">
              Volver
            </Link>
          </div>
        </Screen>
      </ComparisonGate>
    );
  }

  const active = isConsentActive(consent);

  return (
    <ComparisonGate>
      <Screen backdrop="surf" scrim="heavy" opacity={PHOTO.content40}>
        <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
          <p className="eyebrow mb-3">Permisos de {profile.display_name}</p>
          <h1 className="mb-3 text-[length:var(--fs-title-27)] leading-[var(--lh-heading-1_15)] text-blanco">
            Qué se puede
            <br />
            mirar, y hasta cuándo.
          </h1>
          <p className="mb-6 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema/55">
            Elegís el alcance y {profile.display_name} lo acepta o no. El permiso vence a los{' '}
            {days(CONSENT_TTL_MS)} días y se puede retirar en cualquier momento.
          </p>

          <div className="mb-5 flex flex-col gap-2">
            {SCOPE_LABELS.map(([key, label, detail]) => (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={scope[key]}
                disabled={consent?.status === 'granted'}
                onClick={() => setScope((current) => ({ ...current, [key]: !current[key] }))}
                className="glass flex items-start gap-3 rounded-[var(--radius-option)] px-4 py-3 text-left disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={[
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border text-[length:var(--fs-micro-10)]',
                    scope[key] ? 'border-crema bg-crema text-negro' : 'border-crema/30 text-transparent',
                  ].join(' ')}
                >
                  ✓
                </span>
                <span>
                  <span className="block text-[length:var(--fs-body-13)] text-blanco">{label}</span>
                  <span className="mt-0.5 block text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
                    {detail}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <p className="mb-6 rounded-[var(--radius-option)] border border-crema/10 px-3.5 py-2.5 text-[length:var(--fs-body-11)] leading-relaxed text-crema/55">
            Lo que ninguna de las dos partes puede compartir, aunque quiera: lo que escribió en
            el onboarding y sus respuestas clínicas. No hay una casilla para eso porque no
            existe el camino.
          </p>

          {/*
           * The other person's side. Labelled as the simulation it is: no mail
           * was sent, and saying so is more useful than a convincing mime.
           */}
          <div className="rounded-[var(--radius-option)] border border-crema/15 px-4 py-4">
            <p className="eyebrow mb-2">Del lado de {profile.display_name}</p>
            <p className="mb-3.5 text-[length:var(--fs-body-11_5)] leading-relaxed text-crema/55">
              En el producto real esto llega por correo y lo responde la otra persona. Acá no se
              envía ningún correo: respondés vos, desde este panel, para poder ver cómo sigue.
            </p>

            {!consent && (
              <button
                type="button"
                className="cta"
                disabled={!isScopeUsable(scope)}
                onClick={() => setConsent(requestConsent({ externalProfileId: id, scope }))}
              >
                Pedir permiso
              </button>
            )}

            {consent?.status === 'pending' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="cta"
                  onClick={() => {
                    respondToConsent(consent.id, 'granted');
                    setConsent(consentFor(id));
                  }}
                >
                  {profile.display_name} acepta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    respondToConsent(consent.id, 'denied');
                    setConsent(consentFor(id));
                  }}
                  className="glass-chip rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/60 uppercase"
                >
                  {profile.display_name} no acepta
                </button>
              </div>
            )}

            {consent && consent.status !== 'pending' && (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-[length:var(--fs-body-12)] leading-relaxed text-crema/75">
                  {active
                    ? `Con permiso, hasta dentro de ${days(consent.expires_at - Date.now())} días.`
                    : consent.status === 'granted'
                      ? 'El permiso venció.'
                      : consent.status === 'denied'
                        ? 'No dio permiso. Podés volver a pedirlo con otro alcance.'
                        : 'El permiso fue retirado.'}
                </p>

                {active && (
                  <>
                    <button
                      type="button"
                      className="cta"
                      onClick={() => navigate(`/comparacion/resultado/${id}`)}
                    >
                      Ver el cruce
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        revokeConsent(consent.id);
                        setConsent(consentFor(id));
                      }}
                      className="rounded-full border border-alerta/40 px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-alerta uppercase"
                    >
                      Retirar el permiso
                    </button>
                  </>
                )}

                {!active && (
                  <button
                    type="button"
                    onClick={() => setConsent(requestConsent({ externalProfileId: id, scope }))}
                    className="glass-chip rounded-full px-3 py-2.5 text-[length:var(--fs-label-11)] tracking-wide text-crema/60 uppercase"
                  >
                    Volver a pedir
                  </button>
                )}
              </div>
            )}
          </div>

          <Link
            to="/comparacion"
            className="glass-chip mt-4 rounded-full px-3 py-2.5 text-center text-[length:var(--fs-label-11)] tracking-wide text-crema/60 uppercase no-underline"
          >
            Volver
          </Link>
        </div>
      </Screen>
    </ComparisonGate>
  );
}
