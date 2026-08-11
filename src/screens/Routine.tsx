import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { currentMatch, isCheckedToday, toggleCheckIn, totalCheckIns } from '@/store/matches';

/**
 * US-6.3. Practices with an explicit cadence and a check-in.
 *
 * What this screen deliberately lacks, per PDR 12.2 and US-6.3 CA3: streaks,
 * badges, "you're on a 5-day run", and any notification about not breaking a
 * chain. Those mechanics work by making the product harder to leave, and the
 * stated goal here is the opposite — "Natus se crea para dejar de existir".
 *
 * The count shown is a total, not a run. A total is a record; a run is a
 * thing you can lose, and losing it is the pressure the product refuses to
 * apply. If a ticket asks for streaks, this comment is the reason to push
 * back.
 */

const CADENCE_LABEL = {
  daily: 'Cada día',
  weekly: 'Cada semana',
  process: 'Durante el proceso',
  one_off: 'Una vez',
} as const;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Routine() {
  const match = currentMatch();
  const [, force] = useState(0);
  const date = today();

  if (!match) {
    return (
      <Screen backdrop="forest" scrim="heavy" opacity={0.45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Tu rutina sale de tus recomendaciones. Generalas primero.
          </p>
          <Link to="/recomendaciones" className="cta no-underline">
            Ver terapias sugeridas
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen backdrop="forest" scrim="heavy" opacity={0.45}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-9 sm:min-h-0">
        <p className="eyebrow mb-3">Mi rutina</p>
        <h1 className="mb-2 text-[28px] leading-[1.15] text-blanco">
          Cosas concretas,
          <br />
          no consejos.
        </h1>
        <p className="mb-6 text-[12.5px] leading-relaxed text-crema/50">
          Marcá lo que hiciste si te sirve tenerlo a la vista. Nadie te va a decir nada si
          dejás de marcar.
        </p>

        <div className="flex flex-col gap-2.5">
          {match.result.routine.map((practice) => {
            const done = isCheckedToday(practice.title, date);
            const total = totalCheckIns(practice.title);

            return (
              <article key={practice.title} className="glass rounded-[var(--radius-option)] px-4 py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2 className="text-[14px] leading-snug text-blanco">{practice.title}</h2>
                  <span className="shrink-0 text-[10px] tracking-wide text-crema/40 uppercase">
                    {CADENCE_LABEL[practice.cadence]}
                  </span>
                </div>

                <p className="mb-3 text-[12.5px] leading-relaxed text-crema/65">{practice.body}</p>

                <p className="mb-3.5 font-serif text-[15px] leading-snug text-crema italic">
                  {practice.invitation}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      toggleCheckIn(practice.title, date);
                      force((n) => n + 1);
                    }}
                    aria-pressed={done}
                    className={[
                      'flex-1 rounded-full px-3 py-2 text-[11px] tracking-wide uppercase transition-colors',
                      done ? 'bg-verde text-crema' : 'glass-chip text-crema/70 hover:text-crema',
                    ].join(' ')}
                  >
                    {done ? 'Hecho hoy' : 'Marcar hoy'}
                  </button>

                  {total > 0 && (
                    // A total, never a consecutive run. See the note above.
                    <span className="shrink-0 text-[11px] text-crema/35">
                      {total} {total === 1 ? 'día' : 'días'} en total
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          <Link to="/recomendaciones" className="cta no-underline">
            Volver a las terapias
          </Link>
          <Link
            to="/"
            className="glass-chip rounded-full px-3 py-2.5 text-center text-[11px] tracking-wide text-crema/60 uppercase no-underline"
          >
            Inicio
          </Link>
        </div>
      </div>
    </Screen>
  );
}
