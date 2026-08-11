import type { Modality } from '@/lib/schemas';
import type { UserReaction } from '@/store/matches';

/**
 * A recommended modality. US-6.1 CA1 fixes what has to be on it: name,
 * family, what happens in a session, the personalised reasoning, the typical
 * format and the evidence level.
 *
 * What is absent is the point. No person's name, no percentage, no "best
 * match" badge. The mockup's card carried "98% match" over a photograph of a
 * facilitator; this is the same visual language making a different claim.
 */

const FAMILY_LABEL: Record<Modality['family'], string> = {
  psicologica: 'Psicológica',
  corporal: 'Corporal',
  energetica: 'Energética',
  simbolica: 'Simbólica',
  contemplativa: 'Contemplativa',
};

/**
 * PDR 5.3 calls this column the cheapest legal defence there is, and it only
 * works if the UI actually shows it. Wording is plain rather than euphemistic:
 * a tradition should read as a tradition.
 */
const EVIDENCE_LABEL: Record<Modality['evidence_level'], string> = {
  clinica: 'Con evidencia clínica',
  emergente: 'Evidencia emergente',
  tradicional: 'Práctica de tradición',
};

const HORIZON_LABEL: Record<Modality['typical_horizon'], string> = {
  short: 'proceso corto',
  medium: 'proceso de meses',
  long: 'proceso largo',
  flexible: 'sin plazo fijo',
};

export function ModalityCard({
  modality,
  rank,
  reasoning,
  cautionNote,
  reaction,
  onReact,
}: {
  modality: Modality;
  rank: number;
  reasoning: string;
  cautionNote: string | null;
  reaction: UserReaction | undefined;
  onReact: (reaction: UserReaction) => void;
}) {
  const dismissed = reaction === 'dismissed';

  return (
    <article
      className={[
        'glass rounded-[var(--radius-option)] px-4 py-4 transition-opacity',
        dismissed ? 'opacity-40' : '',
      ].join(' ')}
    >
      <div className="mb-2 flex items-baseline gap-2.5">
        <span aria-hidden="true" className="font-serif text-[15px] text-crema/55 italic">
          {rank}
        </span>
        <h3 className="flex-1 font-serif text-[19px] leading-tight font-light text-blanco">
          {modality.name_es}
        </h3>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="glass-chip rounded-full px-2.5 py-1 text-[10px] tracking-wide text-crema/70 uppercase">
          {FAMILY_LABEL[modality.family]}
        </span>
        <span className="glass-chip rounded-full px-2.5 py-1 text-[10px] tracking-wide text-crema/70 uppercase">
          {modality.typical_format}
        </span>
        <span className="glass-chip rounded-full px-2.5 py-1 text-[10px] tracking-wide text-crema/70 uppercase">
          {HORIZON_LABEL[modality.typical_horizon]}
        </span>
        <span
          className={[
            'rounded-full px-2.5 py-1 text-[10px] tracking-wide uppercase',
            modality.evidence_level === 'clinica'
              ? 'bg-verde/70 text-crema'
              : 'glass-chip text-crema/55',
          ].join(' ')}
        >
          {EVIDENCE_LABEL[modality.evidence_level]}
        </span>
      </div>

      <p className="mb-3 text-[13px] leading-relaxed text-blanco/85">{reasoning}</p>

      {/* US-6.1 CA1: what actually happens in a session. Without it the
          recommendation is useless — most people have no idea what EMDR or
          constelaciones involve. */}
      <details className="group mb-3">
        <summary className="cursor-pointer list-none text-[11px] tracking-wide text-crema/55 uppercase hover:text-crema/80">
          Qué pasa en una sesión
          <span aria-hidden="true" className="ml-1.5 group-open:hidden">
            +
          </span>
          <span aria-hidden="true" className="ml-1.5 hidden group-open:inline">
            −
          </span>
        </summary>
        <p className="mt-2 text-[12.5px] leading-relaxed text-crema/65">
          {modality.what_happens}
        </p>
      </details>

      {cautionNote && (
        <div className="mb-3 flex gap-2.5 rounded-[10px] border border-alerta/25 bg-alerta/8 px-3 py-2.5">
          <span aria-hidden="true" className="mt-[5px] size-1.5 shrink-0 rounded-full bg-alerta" />
          <p className="text-[11.5px] leading-relaxed text-crema/75">{cautionNote}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onReact('saved')}
          aria-pressed={reaction === 'saved'}
          className={[
            'flex-1 rounded-full px-3 py-2 text-[11px] tracking-wide uppercase transition-colors',
            reaction === 'saved'
              ? 'bg-verde text-crema'
              : 'glass-chip text-crema/70 hover:text-crema',
          ].join(' ')}
        >
          {reaction === 'saved' ? 'Guardada' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => onReact('dismissed')}
          aria-pressed={dismissed}
          className="glass-chip flex-1 rounded-full px-3 py-2 text-[11px] tracking-wide text-crema/55 uppercase hover:text-crema"
        >
          {dismissed ? 'Descartada' : 'No me hace sentido'}
        </button>
      </div>
    </article>
  );
}
