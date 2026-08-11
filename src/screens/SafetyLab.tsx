import { useMemo, useState } from 'react';
import { Screen } from '@/components/Screen';
import { CrisisBanner } from '@/components/CrisisBanner';
import { CrisisScreen } from './CrisisScreen';
import { scanText, type SafetyVerdict } from '@/lib/safety';

/**
 * A window into Layer 1.
 *
 * Two reasons this exists rather than a throwaway route. It is how the phase
 * is verified by hand — type a phrase, see the verdict and the surface it
 * produces. And it is the honest way to show someone how the detector
 * behaves, including where it stays silent, without asking them to trust a
 * description of it.
 *
 * It runs entirely on the deterministic layer; nothing here reaches a model.
 */

const SAMPLES: [string, string][] = [
  ['Sin señal', 'quiero entender por que me cuesta tanto poner limites'],
  ['Alta — ideación', 'hace semanas que pienso que quiero morirme'],
  ['Alta — abuso', 'mi ex me persigue hasta el trabajo'],
  ['Baja — indirectos', 'ya no aguanto mas, y siento que nada tiene sentido'],
  ['Suprimida — sueño', 'sone que me corto el pelo y me desperte rara'],
  ['Suprimida — tercero', 'mi amigo quiere matarse y no se como ayudarlo'],
  ['Suprimida — duelo', 'estoy procesando el suicidio de mi hermano'],
];

function Verdict({ verdict }: { verdict: SafetyVerdict }) {
  if (!verdict.crisis) {
    return (
      <div className="glass rounded-[var(--radius-option)] px-4 py-3">
        <p className="text-sm text-crema/70">Sin señal de crisis. El flujo sigue normal.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-[var(--radius-option)] px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-alerta shadow-[0_0_8px_var(--natus-alerta)]"
        />
        <p className="text-sm text-blanco">
          Severidad {verdict.severity} · {verdict.category}
        </p>
      </div>
      <p className="text-[11px] leading-relaxed text-crema/55">
        Términos: {verdict.matched.join(' · ')}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-crema/55">
        {verdict.severity === 'high'
          ? 'Bloquea Mapa del Alma, recomendaciones y meditaciones.'
          : 'No bloquea. Excluye modalidades removedoras y prioriza la familia psicológica.'}
      </p>
    </div>
  );
}

export function SafetyLab() {
  const [text, setText] = useState(SAMPLES[3]?.[1] ?? '');
  const verdict = useMemo(() => scanText(text), [text]);
  const [preview, setPreview] = useState(false);

  if (preview && verdict.crisis && verdict.severity === 'high') {
    return (
      <CrisisScreen
        country="CL"
        onBack={() => setPreview(false)}
        onNotMyCase={() => setPreview(false)}
      />
    );
  }

  return (
    <Screen backdrop="grass" scrim="heavy" opacity={0.35}>
      <div className="flex min-h-dvh flex-col gap-4 overflow-y-auto px-5 pt-[var(--top-inset)] pb-8 sm:min-h-0">
        <div>
          <p className="eyebrow mb-2">Laboratorio</p>
          <h1 className="text-[26px] text-blanco">Capa 1 de safety</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-crema/55">
            Determinística, sin modelo. Corre antes de gastar un token.
          </p>
        </div>

        <label className="sr-only" htmlFor="safety-input">
          Texto a analizar
        </label>
        <textarea
          id="safety-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="glass w-full resize-none rounded-[var(--radius-option)] px-4 py-3 text-sm text-blanco placeholder:text-crema/55"
          placeholder="Escribí algo…"
        />

        <div className="flex flex-wrap gap-1.5">
          {SAMPLES.map(([label, sample]) => (
            <button
              key={label}
              type="button"
              onClick={() => setText(sample)}
              className="glass-chip rounded-full px-3 py-1.5 text-[11px] text-crema/70"
            >
              {label}
            </button>
          ))}
        </div>

        <Verdict verdict={verdict} />

        {verdict.crisis && verdict.severity === 'high' && (
          <button type="button" className="cta" onClick={() => setPreview(true)}>
            Ver pantalla de crisis
          </button>
        )}

        {verdict.crisis && verdict.severity === 'low' && (
          <div className="-mx-2">
            <CrisisBanner country="CL" />
          </div>
        )}
      </div>
    </Screen>
  );
}
