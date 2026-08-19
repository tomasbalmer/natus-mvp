import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { ComparisonGate } from './Gate';
import { computeNumerology, NumerologyInputError } from '@/lib/numerology';
import { buildComparisonPayload, toComparisonBirth } from '@/lib/comparison-payload';
import { compareCharts } from '@/ai/comparison';
import { COMPARISON_PROMPT_VERSION } from '@/ai/prompts/comparison';
import { activeProfile } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import {
  consentFor,
  externalProfileById,
  isConsentActive,
  readableComparison,
  saveComparison,
} from '@/store/comparison';

/**
 * The reading of PDR 8.4.
 *
 * Consent is re-checked on every render through `readableComparison`, not once
 * when the reading was generated. That is what makes revocation immediate: the
 * result is never held in component state, so the next render after a
 * revocation finds nothing to show.
 *
 * The screen ends where the contract ends — on questions. There is no verdict
 * to render because there is no verdict field, and there is no place to add
 * one without changing the schema.
 */

const KIND_LABEL: Record<string, string> = {
  life_path: 'Camino de vida',
  expression: 'Expresión',
  soul_urge: 'Alma',
  personality: 'Personalidad',
  birthday: 'Cumpleaños',
};

export function Result() {
  const { id = '' } = useParams();
  const profile = externalProfileById(id);
  const synthesis = currentSynthesis();
  const mine = activeProfile();

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A counter rather than the result itself: the reading is always re-read
  // through `readableComparison`, so a revoked consent cannot be shown from a
  // stale copy in this component.
  const [version, setVersion] = useState(0);

  const consent = consentFor(id);
  const active = isConsentActive(consent);
  const stored = active ? readableComparison(id) : undefined;

  const generate = useCallback(async () => {
    if (!profile || !mine || !synthesis || !consent || !isConsentActive(consent)) return;

    setGenerating(true);
    setError(null);
    try {
      const payload = buildComparisonPayload({
        scope: consent.scope,
        a: {
          display_name: mine.draft.legal_birth_name.trim().split(/\s+/)[0] ?? 'Vos',
          numerology: synthesis.numerology,
          soul_map_themes: synthesis.synthesis.inferred_topics,
          chart: null,
          // The positions stay null: the function computes the aspects from
          // the birth data and the browser never holds them. `chart` is what
          // a future path that reads a stored chart would fill.
          birth: toComparisonBirth(mine.draft),
        },
        b: {
          display_name: profile.display_name,
          numerology: numerologyOf(profile.legal_birth_name, profile.birth_date),
          soul_map_themes: [],
          chart: null,
          birth: toComparisonBirth(profile),
        },
      });

      const result = await compareCharts(payload);
      saveComparison({
        externalProfileId: id,
        consentId: consent.id,
        result: result.value,
        promptVersion: COMPARISON_PROMPT_VERSION,
        mode: result.mode,
      });
      setVersion((v) => v + 1);
    } catch {
      setError('No pudimos armar el cruce esta vez.');
    } finally {
      setGenerating(false);
    }
  }, [profile, mine, synthesis, consent, id]);

  useEffect(() => {
    if (active && !readableComparison(id) && !generating) void generate();
    // `version` is in the list so a regeneration re-evaluates what is stored.
  }, [active, id, generate, generating, version]);

  if (!profile) {
    return <Missing message="Esa persona ya no está cargada." />;
  }

  if (!active) {
    return (
      <Missing
        message={
          consent?.status === 'revoked'
            ? 'El permiso fue retirado, así que este cruce ya no se puede leer.'
            : 'Sin permiso vigente no se lee nada.'
        }
        to={`/comparacion/consentimiento/${id}`}
        cta="Ver los permisos"
      />
    );
  }

  if (generating || !stored) {
    return (
      <ComparisonGate>
        <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
          <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center sm:min-h-0">
            {error ? (
              <>
                <p className="text-sm leading-relaxed text-crema/75">{error}</p>
                <button type="button" className="cta" onClick={() => void generate()}>
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <div className="relative flex size-24 items-center justify-center">
                  <span className="orb-pulse" aria-hidden="true" />
                  <span className="glass relative z-10 size-14 rounded-full" />
                </div>
                <p className="font-serif text-[19px] font-light text-blanco">Cruzando los mapas</p>
              </>
            )}
          </div>
        </Screen>
      </ComparisonGate>
    );
  }

  const { result } = stored;

  return (
    <ComparisonGate>
      <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
        <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
          <p className="eyebrow mb-3">El cruce</p>
          <h1 className="mb-6 text-[26px] leading-[1.18] text-blanco">{result.headline}</h1>

          <section className="mb-6">
            <h2 className="eyebrow mb-2.5">Los números, en diálogo</h2>
            <p className="mb-3 text-[13px] leading-relaxed text-blanco/85">
              {result.numerology_dialogue.summary}
            </p>
            <div className="flex flex-col gap-2.5">
              {result.numerology_dialogue.pairs.map((pair) => (
                <article
                  key={pair.kind}
                  className="glass rounded-[var(--radius-option)] px-4 py-3.5"
                >
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <h3 className="text-[12px] tracking-wide text-crema/60 uppercase">
                      {KIND_LABEL[pair.kind] ?? pair.kind}
                    </h3>
                    <span className="shrink-0 font-serif text-[17px] text-crema">
                      {pair.a_number} · {pair.b_number}
                    </span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed text-crema/70">{pair.reading}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="eyebrow mb-2.5">La carta</h2>
            <p className="text-[12.5px] leading-relaxed text-crema/60">
              {result.astro_dialogue.summary}
            </p>

            {/*
             * Every aspect here was computed by the ephemeris and checked
             * against that list server-side before this rendered. The bodies
             * and the aspect are the calculation; only the reading is the
             * model's. Shown as a pair rather than a score — there is no
             * number in this section and §7 is why.
             */}
            {result.astro_dialogue.aspects.length > 0 && (
              <div className="mt-3 flex flex-col gap-2.5">
                {result.astro_dialogue.aspects.map((aspect) => (
                  <article
                    key={`${aspect.a_body}-${aspect.type}-${aspect.b_body}`}
                    className="glass rounded-[var(--radius-option)] px-4 py-3"
                  >
                    <p className="mb-1 text-[11px] tracking-wide text-crema/55 uppercase">
                      {aspect.a_body} · {aspect.type} · {aspect.b_body}
                    </p>
                    <p className="text-[12.5px] leading-relaxed text-crema/70">{aspect.reading}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mb-6">
            <h2 className="eyebrow mb-2.5">Donde fluye</h2>
            <ul className="flex list-none flex-col gap-2 p-0">
              {result.where_you_flow.map((line) => (
                <li key={line} className="text-[12.5px] leading-relaxed text-blanco/85">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="eyebrow mb-2.5">Donde roza</h2>
            <ul className="flex list-none flex-col gap-2 p-0">
              {result.where_you_friction.map((line) => (
                <li key={line} className="text-[12.5px] leading-relaxed text-blanco/85">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <div className="my-2 h-px w-10 bg-crema/25" />

          {/* PDR 8.5 rule 4: it ends here, on questions. */}
          <section className="mb-6">
            <h2 className="eyebrow mb-3">Para conversar</h2>
            <div className="flex flex-col gap-3">
              {result.questions_to_explore.map((question) => (
                <p key={question} className="font-serif text-[16px] leading-snug text-crema italic">
                  {question}
                </p>
              ))}
            </div>
          </section>

          <p className="mb-6 rounded-[var(--radius-option)] border border-crema/10 px-3.5 py-3 text-[11px] leading-relaxed text-crema/55">
            {result.disclaimer}
          </p>

          <div className="flex flex-col gap-2.5">
            <Link
              to={`/comparacion/consentimiento/${id}`}
              className="glass-chip rounded-full px-3 py-2.5 text-center text-[11px] tracking-wide text-crema/60 uppercase no-underline"
            >
              Permisos y alcance
            </Link>
            <p className="px-1 text-[10px] tracking-wide text-crema/55 uppercase">
              {stored.mode === 'fixture' ? 'Modo demo · guion curado' : 'Generado con Claude'} ·{' '}
              {stored.prompt_version}
            </p>
          </div>
        </div>
      </Screen>
    </ComparisonGate>
  );
}

function numerologyOf(legalName: string, birthDate: string) {
  try {
    return computeNumerology({ legalBirthName: legalName, birthDate });
  } catch (error) {
    // A name with no Latin letters. The cross runs on what is left rather than
    // refusing outright.
    if (error instanceof NumerologyInputError) return null;
    throw error;
  }
}

function Missing({ message, to = '/comparacion', cta = 'Volver' }: { message: string; to?: string; cta?: string }) {
  return (
    <ComparisonGate>
      <Screen backdrop="grass" scrim="heavy" opacity={0.45}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">{message}</p>
          <Link to={to} className="cta no-underline">
            {cta}
          </Link>
        </div>
      </Screen>
    </ComparisonGate>
  );
}
