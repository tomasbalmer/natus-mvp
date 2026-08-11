import { useState } from 'react';
import { getAiMode, looksLikeAnthropicKey, setByokMode, setFixtureMode } from '@/ai/mode';

/**
 * Switching between curated fixtures and a live model.
 *
 * The warning is not boilerplate. In fixture mode nothing a person types
 * leaves the browser; in BYOK mode it goes to Anthropic. This screen asks
 * about anxiety, grief and suicidal ideation, so the difference has to be
 * stated at the moment of the choice, not buried in a policy.
 */
export function AiModeToggle({
  onChange,
}: {
  onChange?: ((mode: 'fixture' | 'byok') => void) | undefined;
}) {
  const [mode, setMode] = useState(() => getAiMode().mode);
  const [key, setKey] = useState('');
  const [expanded, setExpanded] = useState(false);

  const apply = (next: 'fixture' | 'byok') => {
    if (next === 'fixture') {
      setFixtureMode();
      setMode('fixture');
      onChange?.('fixture');
      return;
    }
    if (!looksLikeAnthropicKey(key)) return;
    setByokMode(key);
    setMode('byok');
    onChange?.('byok');
  };

  return (
    <div className="glass rounded-[var(--radius-option)] px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-blanco">
            {mode === 'fixture' ? 'Modo demo' : 'Modo IA'}
          </p>
          <p className="mt-0.5 text-[11px] text-crema/55">
            {mode === 'fixture'
              ? 'Guiones curados. Nada sale de este navegador.'
              : 'Generación real con tu clave de Anthropic.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="glass-chip shrink-0 rounded-full px-3 py-1.5 text-[11px] text-crema"
        >
          {expanded ? 'Cerrar' : 'Cambiar'}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 flex flex-col gap-2.5 border-t border-crema/10 pt-3.5">
          <p className="text-[11px] leading-relaxed text-crema/55">
            En modo IA, todo lo que escribas en el onboarding y en el chat se envía a la API
            de Anthropic. Tu clave queda guardada en este navegador y no viaja a ningún otro
            lado. Sacala cuando termines de probar.
          </p>

          <label className="sr-only" htmlFor="anthropic-key">
            Clave de API de Anthropic
          </label>
          <input
            id="anthropic-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            className="glass w-full rounded-[var(--radius-option)] px-3.5 py-2.5 font-mono text-[12px] text-blanco placeholder:text-crema/55"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => apply('byok')}
              disabled={!looksLikeAnthropicKey(key)}
              className="glass-chip flex-1 rounded-full px-3 py-2 text-[11px] text-crema disabled:opacity-40"
            >
              Activar modo IA
            </button>
            <button
              type="button"
              onClick={() => apply('fixture')}
              className="glass-chip flex-1 rounded-full px-3 py-2 text-[11px] text-crema"
            >
              Volver a demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
