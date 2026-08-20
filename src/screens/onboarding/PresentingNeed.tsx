import { StepBody } from '@/components/onboarding/StepChrome';
import { OptionItem } from '@/components/onboarding/OptionItem';
import { presentingNeedsFile, PRESENTING_NEEDS } from '@/lib/catalog';
import type { OnboardingDraft } from '@/store/session';

/**
 * PDR 1.1, the non-negotiable one: "¿Qué te estás preguntando últimamente?",
 * never "¿qué problema venís a resolver?". The person is the protagonist, not
 * a patient, and the copy must never invite them to diagnose themselves.
 *
 * The mockup offered "Superar la depresión" and "Reducir ansiedad" here. Both
 * are exactly what the principle forbids, and a test in catalog.test.ts now
 * rejects any shortcut that names a condition.
 */
export function PresentingNeed({
  draft,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}) {
  const toggle = (slug: string) => {
    const selected = draft.presenting_need_slugs.includes(slug);
    onChange({
      presenting_need_slugs: selected
        ? draft.presenting_need_slugs.filter((s) => s !== slug)
        : [...draft.presenting_need_slugs, slug],
    });
  };

  const canContinue =
    draft.presenting_need_text.trim().length > 2 || draft.presenting_need_slugs.length > 0;

  return (
    <StepBody
      title={presentingNeedsFile.prompt_es}
      helper={presentingNeedsFile.helper_es}
      action={
        <button type="button" className="cta" disabled={!canContinue} onClick={onNext}>
          Continuar
          <span aria-hidden="true">→</span>
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="presenting-need">
          {presentingNeedsFile.prompt_es}
        </label>
        <textarea
          id="presenting-need"
          rows={3}
          className="glass w-full resize-none rounded-[var(--radius-option)] px-4 py-3 text-[length:var(--fs-body-14)] leading-relaxed text-blanco placeholder:text-crema/55"
          placeholder="Escribí lo que se te venga…"
          value={draft.presenting_need_text}
          onChange={(e) => onChange({ presenting_need_text: e.target.value })}
        />

        <div className="flex flex-col gap-2">
          {PRESENTING_NEEDS.map((need) => (
            <OptionItem
              key={need.slug}
              label={need.label_es}
              selected={draft.presenting_need_slugs.includes(need.slug)}
              onToggle={() => toggle(need.slug)}
            />
          ))}
        </div>
      </div>
    </StepBody>
  );
}
