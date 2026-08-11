import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { NUMBER_LABELS } from '@/lib/numerology';
import { activeProfile, isSignedIn } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import type { Numerology } from '@/lib/schemas';

/**
 * Screen 8 of PDR 6.1: the narrative synthesis in three sections, the tips,
 * and the five numbers underneath.
 *
 * The account is asked for after this screen, never before — PDR section 3.
 * The person has already put in the time and now has something to lose.
 */

const NUMBER_ORDER: (keyof typeof NUMBER_LABELS)[] = [
  'life_path',
  'expression',
  'soul_urge',
  'personality',
  'birthday',
];

const SECTION_TITLES = {
  tu_camino: 'Tu camino',
  lo_que_estas_trabajando: 'Lo que estás trabajando',
  que_necesitas_ahora: 'Qué necesitás ahora',
} as const;

const CADENCE_LABEL = {
  daily: 'cada día',
  weekly: 'cada semana',
  process: 'durante el proceso',
  one_off: 'una vez',
} as const;

function Numbers({ numerology }: { numerology: Numerology }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        {NUMBER_ORDER.map((key) => (
          <div
            key={key}
            className="glass flex items-center justify-between rounded-[var(--radius-option)] px-4 py-3"
          >
            <span className="text-[13px] text-blanco/85">{NUMBER_LABELS[key]}</span>
            <span className="font-serif text-2xl font-light text-crema">{numerology[key]}</span>
          </div>
        ))}
      </div>

      {numerology.master_numbers_present.length > 0 && (
        <p className="mt-4 px-1 text-[12px] leading-relaxed text-crema/55">
          Aparecen números maestros en tu mapa:{' '}
          <span className="text-crema">{numerology.master_numbers_present.join(', ')}</span>. En
          la tradición pitagórica no se reducen, y se leen como una intensidad que pide más de
          vos.
        </p>
      )}

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-crema/35">
        Calculados en tu navegador a partir de tu nombre de nacimiento y tu fecha. Son un
        lenguaje simbólico para pensarte, no una medición.
      </p>
    </>
  );
}

export function SoulMap() {
  const profile = activeProfile();
  const stored = currentSynthesis();
  const firstName = (profile?.draft.legal_birth_name ?? '').trim().split(/\s+/)[0] ?? '';

  if (!stored) {
    return (
      <Screen backdrop="palm" scrim="heavy" opacity={0.45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Todavía no generamos tu mapa. Empezá por el principio y volvemos acá.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  const { synthesis, numerology } = stored;

  return (
    <Screen backdrop="palm" scrim="heavy" opacity={0.45}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-6 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Tu mapa del alma</p>

        <h1 className="mb-7 text-[30px] leading-[1.15] text-blanco">
          {firstName ? (
            <>
              <span className="font-serif text-crema italic">{firstName}</span>,
              <br />
              esto es lo que
              <br />
              vemos.
            </>
          ) : (
            'Esto es lo que vemos.'
          )}
        </h1>

        <div className="flex flex-col gap-6">
          {(Object.keys(SECTION_TITLES) as (keyof typeof SECTION_TITLES)[]).map((key) => (
            <section key={key}>
              <h2 className="eyebrow mb-2.5">{SECTION_TITLES[key]}</h2>
              <p className="text-[13.5px] leading-relaxed text-blanco/85">
                {synthesis.soul_map_synthesis[key]}
              </p>
            </section>
          ))}
        </div>

        <div className="my-7 h-px w-10 bg-crema/25" />

        <h2 className="eyebrow mb-3">Para probar</h2>
        <div className="flex flex-col gap-2.5">
          {synthesis.tips.map((tip) => (
            <article key={tip.title} className="glass rounded-[var(--radius-option)] px-4 py-3.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] text-blanco">{tip.title}</h3>
                <span className="shrink-0 text-[10px] tracking-wide text-crema/40 uppercase">
                  {CADENCE_LABEL[tip.cadence]}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-crema/65">{tip.body}</p>
              {/* PDR 1.5: every tip closes on a micro-invitation. It is set in
                  the serif italic so it reads as a question, not a step. */}
              <p className="mt-2.5 font-serif text-[15px] leading-snug text-crema italic">
                {tip.invitation}
              </p>
            </article>
          ))}
        </div>

        <div className="my-7 h-px w-10 bg-crema/25" />

        <h2 className="eyebrow mb-3">Tus números</h2>
        {numerology ? (
          <Numbers numerology={numerology} />
        ) : (
          <p className="text-[12px] leading-relaxed text-crema/50">
            No pudimos calcular los números con el nombre que ingresaste.
          </p>
        )}

        <p className="mt-8 mb-3 px-1 font-serif text-[17px] leading-snug text-crema/80 italic">
          {synthesis.follow_up_invitation}
        </p>

        <div className="mt-auto flex flex-col gap-2.5 pt-4">
          <Link to="/recomendaciones" className="cta no-underline">
            Ver terapias sugeridas
            <span aria-hidden="true">→</span>
          </Link>

          {/* PDR section 3: the account is offered here and nowhere earlier —
              the person now has something they would rather not lose. It is a
              secondary control, not a gate; the flow continues without it. */}
          {!isSignedIn() && (
            <Link
              to="/registro"
              className="glass-chip rounded-full px-3 py-2.5 text-center text-[11px] tracking-wide text-crema/60 uppercase no-underline"
            >
              Guardar mi mapa
            </Link>
          )}

          <p className="px-1 text-[10px] tracking-wide text-crema/25 uppercase">
            {stored.mode === 'fixture' ? 'Modo demo · guion curado' : 'Generado con Claude'} ·{' '}
            {stored.prompt_version}
          </p>
        </div>
      </div>
    </Screen>
  );
}
