import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
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
    <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Mis prácticas</p>
        <h1 className="mb-6 text-[28px] leading-[1.15] text-blanco">
          Lo que fuiste
          <br />
          armando.
        </h1>

        {meditations.length === 0 ? (
          <>
            <p className="mb-6 text-[12.5px] leading-relaxed text-crema/55">
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
                className="glass rounded-[var(--radius-option)] px-4 py-3.5"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] leading-snug text-blanco">
                    {meditation.script.title}
                  </h2>
                  <span className="shrink-0 text-[10px] tracking-wide text-crema/40 uppercase">
                    {meditation.estimated_minutes} min
                  </span>
                </div>

                <p className="mb-1 text-[12px] leading-relaxed text-crema/55">
                  “{meditation.intent}”
                </p>
                <p className="mb-3 text-[10.5px] tracking-wide text-crema/30 uppercase">
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
                      className="flex-1 rounded-full border border-alerta/40 px-3 py-2 text-[11px] tracking-wide text-alerta uppercase"
                    >
                      Borrar
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
                      to={`/meditaciones?id=${meditation.id}`}
                      className="glass-chip flex-1 rounded-full px-3 py-2 text-center text-[11px] tracking-wide text-crema/75 uppercase no-underline"
                    >
                      Escuchar
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirming(meditation.id)}
                      className="glass-chip rounded-full px-3.5 py-2 text-[11px] tracking-wide text-crema/45 uppercase"
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
