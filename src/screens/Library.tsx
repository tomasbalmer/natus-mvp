import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PHOTO, Screen } from '@/design/Screen';
import { BED_TRACKS } from '@/lib/catalog';
import { deleteMeditation, listMeditations } from '@/store/meditations';

/**
 * The saved practices of PDR 9.6.
 *
 * PDR 5.7 pairs each meditation with a stored audio file, so deleting one
 * there means deleting two things. Here the audio is synthesised at play time
 * from the script and the bed descriptor, so a meditation is one row and
 * deleting it leaves nothing behind — which is worth saying out loud, because
 * "and its stored audio" is exactly the kind of clause that quietly stops
 * being true.
 */

function bedName(id: string): string {
  return BED_TRACKS.find((track) => track.id === id)?.name ?? 'Solo voz';
}

function dayOf(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  });
}

export function Library() {
  const [meditations, setMeditations] = useState(() => listMeditations());
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Screen backdrop="grass" scrim="heavy" opacity={PHOTO.content40}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Mis prácticas</p>
        <h1 className="mb-6 text-[length:var(--fs-title-28)] leading-[var(--lh-heading-1_15)] text-blanco">
          Lo que fuiste
          <br />
          armando.
        </h1>

        {meditations.length === 0 ? (
          <>
            <p className="mb-6 text-[length:var(--fs-body-12_5)] leading-relaxed text-crema/55">
              Todavía no armaste ninguna. Cada práctica sale de una intención concreta, así que
              no hay un catálogo para elegir: se arma cuando la pedís.
            </p>
            <Link to="/meditaciones" className="cta no-underline">
              Armar una práctica
            </Link>
          </>
        ) : (
          <div className="flex flex-col gap-2.5">
            {meditations.map((meditation) => (
              <article
                key={meditation.id}
                className="surface surface-p14"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <h2 className="text-[length:var(--fs-heading-14)] leading-snug text-blanco">
                    {meditation.script.title}
                  </h2>
                  <span className="shrink-0 text-[length:var(--fs-label-10)] tracking-wide text-crema/55 uppercase">
                    {meditation.estimated_minutes} min
                  </span>
                </div>

                <p className="mb-1 text-[length:var(--fs-body-12)] leading-relaxed text-crema/55">
                  “{meditation.intent}”
                </p>
                <p className="mb-3 text-[length:var(--fs-label-10_5)] tracking-wide text-crema/55 uppercase">
                  {dayOf(meditation.created_at)} · {bedName(meditation.script.bed_track_id)}
                </p>

                {confirming === meditation.id ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        deleteMeditation(meditation.id);
                        setMeditations(listMeditations());
                        setConfirming(null);
                      }}
                      className="flex-1 rounded-full border border-alerta/40 px-3 py-2 text-[length:var(--fs-label-11)] tracking-wide text-alerta uppercase"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="chip chip-p8 flex-1 text-crema/60"
                    >
                      Mejor no
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      to={`/meditaciones?id=${meditation.id}`}
                      className="chip chip-p8 flex-1 text-center text-crema/75 no-underline"
                    >
                      Escuchar
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirming(meditation.id)}
                      className="chip chip-p8 px-3.5 text-crema/55"
                    >
                      Borrar
                    </button>
                  </div>
                )}
              </article>
            ))}

            <Link to="/meditaciones" className="cta mt-4 no-underline">
              Armar otra
            </Link>
          </div>
        )}
      </div>
    </Screen>
  );
}
