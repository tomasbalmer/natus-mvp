import { StepBody } from '@/components/onboarding/StepChrome';
import { OptionItem } from '@/components/onboarding/OptionItem';
import type { IdeationAnswer } from '@/lib/safety';
import type { OnboardingDraft } from '@/store/session';

/**
 * PDR US-1.3: this must feel like care, not a medical form.
 *
 * Three things the PDR makes explicit and this screen implements. A
 * containment paragraph comes before the first question. Every question
 * accepts "prefiero no decir" except the ideation one. And answering
 * `plan_o_intencion` does not continue to the Soul Map — the flow hands off
 * to the crisis screen, which the parent does by scanning this draft.
 *
 * The honesty problem the PDR flags in section 5.9 and again in section 14:
 * the vault's copy promises "solo lo ve tu facilitador asignado", which is
 * false, because an admin is notified on a crisis signal. The copy below says
 * what actually happens.
 */

const IDEATION_OPTIONS: [IdeationAnswer, string][] = [
  ['no', 'No'],
  ['fugaces_sin_plan', 'Alguna vez, de forma pasajera'],
  ['frecuentes', 'Sí, seguido'],
  ['plan_o_intencion', 'Sí, y pensé en cómo hacerlo'],
];

function Question({ children, label }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2.5 text-[length:var(--fs-body-13)] leading-snug text-blanco">{label}</legend>
      <div className="flex flex-col gap-2">{children}</div>
    </fieldset>
  );
}

export function ClinicalBasics({
  draft,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}) {
  const basics = draft.clinical_basics;

  const patch = (p: Partial<typeof basics>) =>
    onChange({ clinical_basics: { ...basics, ...p } });

  const skipped = new Set(basics.prefer_not_to_say ?? []);
  const toggleSkip = (field: string) => {
    const next = new Set(skipped);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    patch({ prefer_not_to_say: [...next] });
  };

  // Only the ideation answer is required. PDR US-1.3 CA2.
  const canContinue = basics.ideation_6m !== undefined;

  return (
    <StepBody
      title={
        <>
          Cuatro preguntas
          <br />
          más delicadas.
        </>
      }
      action={
        <button type="button" className="cta" disabled={!canContinue} onClick={onNext}>
          Continuar
          <span aria-hidden="true">→</span>
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Containment before the first question. PDR US-1.3 CA1. */}
        <p className="text-[length:var(--fs-body-12)] leading-relaxed text-crema/60">
          Preguntamos esto para no recomendarte algo que en tu momento actual podría hacer
          más daño que bien. No es un diagnóstico y no hay respuestas mejores que otras.
          <br />
          <br />
          <span className="text-crema/55">
            Lo que escribas queda guardado con tu cuenta. Si aparece una señal de riesgo, un
            responsable de Natus recibe un aviso con el fragmento que la disparó.
          </span>
        </p>

        <Question label="En los últimos 6 meses, ¿pensaste en hacerte daño o en no querer seguir?">
          {IDEATION_OPTIONS.map(([value, label]) => (
            <OptionItem
              key={value}
              label={label}
              multi={false}
              selected={basics.ideation_6m === value}
              onToggle={() => patch({ ideation_6m: value })}
            />
          ))}
        </Question>

        <Question label="¿Estás en tratamiento psicológico o psiquiátrico ahora?">
          <OptionItem
            label="Sí"
            multi={false}
            selected={basics.in_treatment === true}
            onToggle={() => patch({ in_treatment: true })}
          />
          <OptionItem
            label="No"
            multi={false}
            selected={basics.in_treatment === false}
            onToggle={() => patch({ in_treatment: false })}
          />
          <OptionItem
            label="Prefiero no decir"
            multi={false}
            selected={skipped.has('in_treatment')}
            onToggle={() => toggleSkip('in_treatment')}
          />
        </Question>

        <Question label="¿Tomás medicación psiquiátrica?">
          <OptionItem
            label="Sí"
            multi={false}
            selected={basics.psychiatric_medication === true}
            onToggle={() => patch({ psychiatric_medication: true })}
          />
          <OptionItem
            label="No"
            multi={false}
            selected={basics.psychiatric_medication === false}
            onToggle={() => patch({ psychiatric_medication: false })}
          />
          <OptionItem
            label="Prefiero no decir"
            multi={false}
            selected={skipped.has('psychiatric_medication')}
            onToggle={() => toggleSkip('psychiatric_medication')}
          />
        </Question>

        <div>
          <label
            className="mb-2.5 block text-[length:var(--fs-body-13)] leading-snug text-blanco"
            htmlFor="clinical-notes"
          >
            ¿Hay algo más que quieras que tengamos en cuenta?
          </label>
          <textarea
            id="clinical-notes"
            rows={2}
            className="glass w-full resize-none rounded-[var(--radius-option)] px-4 py-3 text-[length:var(--fs-body-14)] leading-5 text-blanco placeholder:text-crema/55"
            placeholder="Opcional"
          />
        </div>
      </div>
    </StepBody>
  );
}
