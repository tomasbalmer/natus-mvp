import { useRef, useState } from 'react';
import { StepBody } from '@/components/onboarding/StepChrome';
import type { NatalChartDraft, OnboardingDraft } from '@/store/session';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * PDR US-1.4. Accepts a PDF up to 10 MB, tells the person whether it could be
 * read, and never blocks the flow.
 *
 * Parsing needs Vision, which needs a key, which a static build does not
 * have. So the file is accepted and held, `parse_status` stays `pending`, and
 * the Soul Map proceeds on numerology and context — which is exactly the
 * documented fallback path for an unreadable chart, so nothing downstream
 * needs a special case. In BYOK mode this is where the extraction call goes.
 */
export function NatalChart({
  draft,
  onChange,
  onNext,
}: {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  onNext: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Tiene que ser un PDF. Si tenés una imagen, por ahora no la podemos leer.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('El archivo pesa más de 10 MB. Probá exportarlo de nuevo desde astro.com.');
      return;
    }
    setError(null);
    const chart: NatalChartDraft = {
      file_name: file.name,
      size_bytes: file.size,
      page_count: null,
      parse_status: 'pending',
    };
    onChange({ natal_chart: chart });
  };

  return (
    <StepBody
      title={
        <>
          ¿Tenés tu
          <br />
          carta natal?
        </>
      }
      helper="Es opcional. Si la tenés en PDF de astro.com, la leemos. Si no, seguimos con tus números y con lo que contaste."
      action={
        <div className="flex flex-col gap-2.5">
          <button type="button" className="cta" onClick={onNext}>
            {draft.natal_chart ? 'Continuar' : 'Seguir sin carta'}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0])}
        />

        {draft.natal_chart ? (
          <div className="glass rounded-[var(--radius-option)] px-4 py-3.5">
            <p className="truncate text-sm text-blanco">{draft.natal_chart.file_name}</p>
            <p className="mt-1 text-[11px] text-crema/55">
              {(draft.natal_chart.size_bytes / 1024 / 1024).toFixed(1)} MB · guardada en este
              navegador
            </p>
            <button
              type="button"
              onClick={() => onChange({ natal_chart: null })}
              className="mt-2.5 text-[11px] text-crema/55 underline underline-offset-4 hover:text-crema/80"
            >
              Quitar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="glass flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-[var(--radius-option)] px-4 py-6"
          >
            <span aria-hidden="true" className="font-serif text-2xl text-crema/60">
              ＋
            </span>
            <span className="text-[13px] text-blanco/85">Subir PDF</span>
            <span className="text-[11px] text-crema/55">Máximo 10 MB</span>
          </button>
        )}

        {error && (
          /* PDR US-1.4 CA2: an empathetic message that offers to continue,
             never a technical error. */
          <p className="px-1 text-[11px] leading-relaxed text-crema/60">{error}</p>
        )}

        <p className="px-1 text-[11px] leading-relaxed text-crema/55">
          En esta demo el archivo queda en tu navegador y no se sube a ningún servidor. La
          lectura por visión necesita una clave de API, así que se activa sólo en modo IA.
        </p>
      </div>
    </StepBody>
  );
}
