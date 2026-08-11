import { StepBody } from '@/components/onboarding/StepChrome';
import type { OnboardingDraft } from '@/store/session';

const COUNTRIES: [string, string][] = [
  ['CL', 'Chile'],
  ['MX', 'México'],
  ['CO', 'Colombia'],
  ['AR', 'Argentina'],
  ['PE', 'Perú'],
  ['XX', 'Otro país'],
];

const fieldClass =
  'glass w-full rounded-[var(--radius-option)] px-4 py-3 text-sm text-blanco placeholder:text-crema/25 [color-scheme:dark]';

const labelClass = 'mb-1.5 block text-[11px] tracking-wide text-crema/50 uppercase';

export function BasicData({
  draft,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}) {
  const canContinue =
    draft.legal_birth_name.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(draft.birth_date);

  return (
    <StepBody
      title={
        <>
          Empecemos por
          <br />
          lo básico.
        </>
      }
      helper="Tu nombre completo de nacimiento y tu fecha. Con eso ya podemos calcular tus números."
      action={
        <button type="button" className="cta" disabled={!canContinue} onClick={onNext}>
          Continuar
          <span aria-hidden="true">→</span>
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelClass} htmlFor="legal-name">
            Nombre completo de nacimiento
          </label>
          <input
            id="legal-name"
            className={fieldClass}
            value={draft.legal_birth_name}
            onChange={(e) => onChange({ legal_birth_name: e.target.value })}
            placeholder="Como figura en tu partida"
            autoComplete="name"
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-crema/35">
            Los números se calculan sobre el nombre de nacimiento, no sobre el que usás
            todos los días.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="birth-date">
            Fecha de nacimiento
          </label>
          <input
            id="birth-date"
            type="date"
            className={fieldClass}
            value={draft.birth_date}
            onChange={(e) => onChange({ birth_date: e.target.value })}
          />
        </div>

        {/*
         * PDR US-1.2: birth time and city are optional and skipping them must
         * not block. The copy says so plainly rather than leaving someone
         * stuck hunting for a document.
         */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="birth-time">
              Hora
            </label>
            <input
              id="birth-time"
              type="time"
              className={fieldClass}
              value={draft.birth_time}
              onChange={(e) => onChange({ birth_time: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="birth-city">
              Ciudad
            </label>
            <input
              id="birth-city"
              className={fieldClass}
              value={draft.birth_city}
              onChange={(e) => onChange({ birth_city: e.target.value })}
              placeholder="Santiago"
            />
          </div>
        </div>
        <p className="-mt-2 text-[11px] leading-relaxed text-crema/35">
          Si no las sabés, seguí sin ellas. Sin hora exacta no hablamos de Ascendente ni de
          casas, y el resto funciona igual.
        </p>

        <div>
          <label className={labelClass} htmlFor="country">
            ¿Dónde vivís?
          </label>
          <select
            id="country"
            className={fieldClass}
            value={draft.country}
            onChange={(e) => onChange({ country: e.target.value })}
          >
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code} className="bg-negro">
                {name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-crema/35">
            Define qué líneas de ayuda te mostramos si alguna vez hacen falta.
          </p>
        </div>
      </div>
    </StepBody>
  );
}
