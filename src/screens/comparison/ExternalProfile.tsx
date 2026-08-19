import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { ComparisonGate } from './Gate';
import { BIRTH_COUNTRIES } from '@/components/birth-countries';
import {
  consentFor,
  deleteExternalProfile,
  isConsentActive,
  listExternalProfiles,
  saveExternalProfile,
} from '@/store/comparison';

/**
 * Loading someone else's data. PDR 8.2.
 *
 * The warning is not a checkbox in a settings page: it sits between the form
 * and the save button, at the moment the person is about to enter a date of
 * birth that is not theirs. That is the only moment where it can actually
 * change what someone does.
 *
 * The other half of 8.2 is on this screen too — anyone loaded here can be
 * deleted here, by the person who loaded them, and deleting takes the consent
 * and the reading with it.
 */

const fieldClass =
  'glass w-full rounded-[var(--radius-option)] px-4 py-3 text-sm text-blanco placeholder:text-crema/55 [color-scheme:dark]';
const labelClass = 'mb-1.5 block text-[11px] tracking-wide text-crema/55 uppercase';

const STATUS_LABEL = {
  pending: 'Esperando respuesta',
  granted: 'Con permiso',
  denied: 'No dio permiso',
  revoked: 'Permiso retirado',
} as const;

export function ExternalProfile() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(() => listExternalProfiles());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [birthCountry, setBirthCountry] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const canSave = name.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);

  const save = () => {
    const profile = saveExternalProfile({
      display_name: name.trim(),
      legal_birth_name: legalName.trim() || name.trim(),
      birth_date: birthDate,
      birth_time: birthTime,
      birth_city: birthCity.trim(),
      birth_country: birthCountry,
    });
    setProfiles(listExternalProfiles());
    navigate(`/comparacion/consentimiento/${profile.id}`);
  };

  return (
    <ComparisonGate>
      <Screen backdrop="surf" scrim="heavy" opacity={0.4}>
        <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
          <p className="eyebrow mb-3">Comparar cartas</p>
          <h1 className="mb-3 text-[28px] leading-[1.15] text-blanco">
            Un vínculo,
            <br />
            desde los dos lados.
          </h1>
          <p className="mb-6 text-[12.5px] leading-relaxed text-crema/55">
            Se puede leer el cruce entre tu mapa y el de otra persona. Nunca sale un veredicto
            sobre la relación: sale material para conversar entre ustedes.
          </p>

          {profiles.length > 0 && (
            <div className="mb-6 flex flex-col gap-2.5">
              {profiles.map((profile) => {
                const consent = consentFor(profile.id);
                const active = isConsentActive(consent);
                return (
                  <article key={profile.id} className="glass rounded-[var(--radius-option)] px-4 py-3.5">
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <h2 className="text-[14px] text-blanco">{profile.display_name}</h2>
                      <span className="shrink-0 text-[10px] tracking-wide text-crema/55 uppercase">
                        {consent ? STATUS_LABEL[consent.status] : 'Sin pedir'}
                      </span>
                    </div>
                    <p className="mb-3 text-[11.5px] text-crema/55">{profile.birth_date}</p>

                    {confirming === profile.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            deleteExternalProfile(profile.id);
                            setProfiles(listExternalProfiles());
                            setConfirming(null);
                          }}
                          className="flex-1 rounded-full border border-alerta/40 px-3 py-2 text-[11px] tracking-wide text-alerta uppercase"
                        >
                          Borrar sus datos
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="glass-chip flex-1 rounded-full px-3 py-2 text-[11px] tracking-wide text-crema/60 uppercase"
                        >
                          Mejor no
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link
                          to={
                            active
                              ? `/comparacion/resultado/${profile.id}`
                              : `/comparacion/consentimiento/${profile.id}`
                          }
                          className="glass-chip flex-1 rounded-full px-3 py-2 text-center text-[11px] tracking-wide text-crema/75 uppercase no-underline"
                        >
                          {active ? 'Ver el cruce' : 'Permisos'}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirming(profile.id)}
                          className="glass-chip rounded-full px-3.5 py-2 text-[11px] tracking-wide text-crema/55 uppercase"
                        >
                          Borrar
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {!adding ? (
            <button type="button" className="cta" onClick={() => setAdding(true)}>
              Cargar a alguien
            </button>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass} htmlFor="external-name">
                  ¿Cómo le decís?
                </label>
                <input
                  id="external-name"
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nico"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="external-legal-name">
                  Su nombre completo de nacimiento
                </label>
                <input
                  id="external-legal-name"
                  className={fieldClass}
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="external-birth-date">
                  Su fecha de nacimiento
                </label>
                <input
                  id="external-birth-date"
                  type="date"
                  className={fieldClass}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>

              {/*
               * The three the ephemeris needs. Optional as a group: without
               * them the comparison still runs on numbers and themes, which
               * is the same degradation the Soul Map makes when somebody does
               * not know their birth time.
               */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="external-birth-time">
                    Su hora
                  </label>
                  <input
                    id="external-birth-time"
                    type="time"
                    className={fieldClass}
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="external-birth-city">
                    Su ciudad
                  </label>
                  <input
                    id="external-birth-city"
                    className={fieldClass}
                    value={birthCity}
                    onChange={(e) => setBirthCity(e.target.value)}
                    placeholder="Santiago"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="external-birth-country">
                  Su país de nacimiento
                </label>
                <select
                  id="external-birth-country"
                  className={fieldClass}
                  value={birthCountry}
                  onChange={(e) => setBirthCountry(e.target.value)}
                >
                  {BIRTH_COUNTRIES.map(([code, label]) => (
                    <option key={code || 'empty'} value={code} className="bg-negro">
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] leading-relaxed text-crema/55">
                  Hora, ciudad y país sólo hacen falta si querés que el cruce mire las dos
                  cartas. Sin los tres, se lee con los números y los temas.
                </p>
              </div>

              {/*
               * PDR 8.2. Between the form and the button, at the moment the
               * person is about to type someone else's date of birth — which
               * is the only moment where saying this can change anything.
               */}
              <div className="rounded-[var(--radius-option)] border border-alerta/25 px-4 py-3.5">
                <p className="eyebrow mb-1.5">Antes de guardar</p>
                <p className="text-[12px] leading-relaxed text-crema/75">
                  Estos son datos de otra persona. Cargalos solo si esa persona sabe que lo
                  estás haciendo. El paso siguiente es pedirle permiso, y sin ese permiso no se
                  lee nada.
                </p>
              </div>

              <button type="button" className="cta" disabled={!canSave} onClick={save}>
                Guardar y pedir permiso
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="glass-chip rounded-full px-3 py-2.5 text-[11px] tracking-wide text-crema/60 uppercase"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </Screen>
    </ComparisonGate>
  );
}
