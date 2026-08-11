import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { NUMBER_LABELS, computeNumerology, NumerologyInputError } from '@/lib/numerology';
import { getSession } from '@/store/session';
import type { Numerology } from '@/lib/schemas';

/**
 * Screen 8 of PDR 6.1.
 *
 * Phase 3 delivers the half of this screen that needs no model: the five
 * Pythagorean numbers, computed locally and correct. Phase 4 adds the
 * narrative synthesis above them.
 *
 * They are labelled as a symbolic language rather than a measurement, per
 * PDR 1.3 — "tu carta sugiere", never "tu carta dice".
 */

const NUMBER_ORDER: (keyof typeof NUMBER_LABELS)[] = [
  'life_path',
  'expression',
  'soul_urge',
  'personality',
  'birthday',
];

function useNumerology(): { numerology: Numerology | null; name: string } {
  const session = getSession();
  const draft = session?.draft;
  if (!draft?.legal_birth_name || !/^\d{4}-\d{2}-\d{2}$/.test(draft.birth_date)) {
    return { numerology: null, name: '' };
  }
  try {
    return {
      numerology: computeNumerology({
        legalBirthName: draft.legal_birth_name,
        birthDate: draft.birth_date,
      }),
      name: draft.legal_birth_name,
    };
  } catch (error) {
    if (error instanceof NumerologyInputError) return { numerology: null, name: draft.legal_birth_name };
    throw error;
  }
}

export function SoulMap() {
  const { numerology, name } = useNumerology();
  const firstName = name.trim().split(/\s+/)[0] ?? '';

  return (
    <Screen backdrop="palm" scrim="heavy" opacity={0.45}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-6 pt-[var(--top-inset)] pb-9 sm:min-h-0">
        <p className="eyebrow mb-3">Tu mapa del alma</p>

        <h1 className="mb-6 text-[30px] leading-[1.15] text-blanco">
          {firstName ? (
            <>
              <span className="font-serif italic text-crema">{firstName}</span>,
              <br />
              esto es lo que
              <br />
              vemos.
            </>
          ) : (
            'Esto es lo que vemos.'
          )}
        </h1>

        {numerology ? (
          <>
            <div className="mb-5 flex flex-col gap-2">
              {NUMBER_ORDER.map((key) => (
                <div
                  key={key}
                  className="glass flex items-center justify-between rounded-[var(--radius-option)] px-4 py-3"
                >
                  <span className="text-[13px] text-blanco/85">{NUMBER_LABELS[key]}</span>
                  <span className="font-serif text-2xl font-light text-crema">
                    {numerology[key]}
                  </span>
                </div>
              ))}
            </div>

            {numerology.master_numbers_present.length > 0 && (
              <p className="mb-5 px-1 text-[12px] leading-relaxed text-crema/55">
                Aparecen números maestros en tu mapa:{' '}
                <span className="text-crema">
                  {numerology.master_numbers_present.join(', ')}
                </span>
                . En la tradición pitagórica no se reducen, y se leen como una intensidad que
                pide más de vos.
              </p>
            )}

            <p className="mb-8 px-1 text-[11px] leading-relaxed text-crema/35">
              Estos números se calcularon en tu navegador a partir de tu nombre de nacimiento
              y tu fecha. Son un lenguaje simbólico para pensarte, no una medición.
            </p>
          </>
        ) : (
          <p className="mb-8 text-sm leading-relaxed text-crema/60">
            Todavía no tenemos tus datos. Empezá por el principio y volvemos acá.
          </p>
        )}

        <div className="mt-auto flex flex-col gap-2.5">
          <div className="glass rounded-[var(--radius-option)] px-4 py-3.5">
            <p className="text-[12px] leading-relaxed text-crema/55">
              <span className="text-crema/80">Próximo:</span> la síntesis narrativa en tres
              secciones y las terapias sugeridas. Llegan en la fase 4 del plan.
            </p>
          </div>

          <Link to="/" className="cta no-underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    </Screen>
  );
}
