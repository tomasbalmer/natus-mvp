import type { ReactNode } from 'react';

/** Back control, section label and step counter — mockup screen 02. */
export function ProgressRow({
  label,
  step,
  total,
  onBack,
}: {
  label: string;
  step: number;
  total: number;
  onBack?: (() => void) | undefined;
}) {
  return (
    <div className="mb-7 flex items-center justify-between gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="glass-chip flex size-8 shrink-0 items-center justify-center rounded-full text-sm text-crema"
        >
          ←
        </button>
      ) : (
        <span className="size-8 shrink-0" />
      )}

      <p className="eyebrow min-w-0 flex-1 truncate text-center">{label}</p>

      <span className="glass-chip shrink-0 rounded-full px-3 py-1 text-[length:var(--fs-body-11)] text-crema">
        {step} de {total}
      </span>
    </div>
  );
}

/** A step's shell: heading, optional helper, scrollable body, pinned action. */
export function StepBody({
  title,
  helper,
  children,
  action,
}: {
  title: ReactNode;
  helper?: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <>
      <h2 className="mb-2 text-[length:var(--fs-heading-28)] leading-[1.18] text-blanco">{title}</h2>
      {helper && <p className="mb-5 text-[length:var(--fs-body-12)] leading-relaxed text-crema/55">{helper}</p>}
      {!helper && <div className="mb-5" />}

      <div className="-mx-1 flex-1 overflow-y-auto px-1 pb-2">{children}</div>

      <div className="shrink-0 pt-4">{action}</div>
    </>
  );
}
