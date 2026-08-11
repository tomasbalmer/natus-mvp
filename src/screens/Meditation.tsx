import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { CrisisScreen } from '@/screens/CrisisScreen';
import { BED_TRACKS } from '@/lib/catalog';
import { detectCrisis, riskLevel } from '@/lib/safety';
import { estimateDurationMs, parseSsml } from '@/audio/ssml';
import { createPlayer, isPlaybackAvailable, type MeditationPlayer } from '@/audio/player';
import { generateMeditation } from '@/ai/meditation';
import { MEDITATION_PROMPT_VERSION } from '@/ai/prompts/meditation';
import { activeProfile } from '@/store/account';
import { currentSynthesis } from '@/store/soulMap';
import { markFalsePositive, recordCrisisEvent } from '@/store/crisis';
import { getPreferences, setVolumes } from '@/store/preferences';
import { meditationById, saveMeditation, type StoredMeditation } from '@/store/meditations';

/**
 * PDR section 9.
 *
 * The intention goes through Layer 1 before it reaches the model, on the same
 * reasoning as the chat: someone who types "quiero dormirme y no despertarme"
 * must not be handed a guided meditation about letting go.
 *
 * The duration is a request, not a promise. The screen shows what the script
 * actually came out at, because claiming twenty minutes and running eight is
 * the kind of small lie that costs a demo its credit.
 */

const LENGTHS = [5, 10, 20];

export function Meditation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const existingId = params.get('id');

  const profile = activeProfile();
  const synthesis = currentSynthesis();

  const [intent, setIntent] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisisEventId, setCrisisEventId] = useState<string | null>(null);
  const [meditation, setMeditation] = useState<StoredMeditation | undefined>(() =>
    existingId ? meditationById(existingId) : undefined,
  );

  if (crisisEventId) {
    return (
      <CrisisScreen
        country={profile?.draft.country}
        onNotMyCase={() => {
          markFalsePositive(crisisEventId);
          setCrisisEventId(null);
        }}
        onBack={() => {
          setCrisisEventId(null);
          navigate('/inicio');
        }}
      />
    );
  }

  if (meditation) {
    return <Player meditation={meditation} onLeave={() => setMeditation(undefined)} />;
  }

  const generate = async () => {
    const text = intent.trim();
    if (text === '' || generating) return;

    const verdict = detectCrisis({ texts: [text] });
    if (verdict.crisis) {
      const event = recordCrisisEvent(verdict, 'meditation_intent');
      if (verdict.severity === 'high') {
        setCrisisEventId(event.id);
        return;
      }
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await generateMeditation({
        intent: text,
        minutes,
        synthesis: synthesis?.synthesis ?? null,
        risk: riskLevel(
          profile ? { clinicalBasics: profile.draft.clinical_basics } : {},
        ),
      });
      setMeditation(
        saveMeditation({
          intent: text,
          requestedMinutes: minutes,
          estimatedMinutes: Math.round(
            estimateDurationMs(parseSsml(result.value.script_ssml)) / 60_000,
          ),
          script: result.value,
          promptVersion: MEDITATION_PROMPT_VERSION,
          mode: result.mode,
        }),
      );
    } catch {
      setError('No pudimos armar la práctica esta vez. Lo que escribiste sigue acá.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Screen backdrop="palm" scrim="heavy" opacity={0.4}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">Meditaciones</p>
        <h1 className="mb-3 text-[28px] leading-[1.15] text-blanco">
          Una práctica,
          <br />
          armada para hoy.
        </h1>
        <p className="mb-6 text-[12.5px] leading-relaxed text-crema/55">
          Contá con qué llegás. No hace falta que sea una intención elevada: "estoy podrida" es
          una intención.
        </p>

        <label className="mb-1.5 block text-[11px] tracking-wide text-crema/50 uppercase" htmlFor="intent">
          ¿Con qué llegás?
        </label>
        <textarea
          id="intent"
          rows={3}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Escribí lo que se te venga…"
          className="glass w-full resize-none rounded-[var(--radius-option)] px-3.5 py-3 text-[13px] text-blanco placeholder:text-crema/25"
        />

        <p className="mt-5 mb-2 text-[11px] tracking-wide text-crema/50 uppercase">Cuánto tiempo</p>
        <div className="flex gap-2">
          {LENGTHS.map((length) => (
            <button
              key={length}
              type="button"
              aria-pressed={minutes === length}
              onClick={() => setMinutes(length)}
              className={[
                'flex-1 rounded-full px-3 py-2.5 text-[11px] tracking-wide uppercase transition-colors',
                minutes === length ? 'bg-verde text-crema' : 'glass-chip text-crema/60',
              ].join(' ')}
            >
              {length} min
            </button>
          ))}
        </div>

        {!isPlaybackAvailable() && (
          <p className="mt-4 rounded-[var(--radius-option)] border border-crema/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-crema/45">
            Este navegador no tiene síntesis de voz, así que vas a poder leer el guion pero no
            escucharlo.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[11.5px] leading-relaxed text-alerta">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-2.5">
          <button
            type="button"
            className="cta"
            disabled={intent.trim() === '' || generating}
            onClick={() => void generate()}
          >
            {generating ? 'Armando la práctica' : 'Armar mi práctica'}
          </button>
          <Link
            to="/biblioteca"
            className="glass-chip rounded-full px-3 py-2.5 text-center text-[11px] tracking-wide text-crema/60 uppercase no-underline"
          >
            Mis prácticas guardadas
          </Link>
        </div>
      </div>
    </Screen>
  );
}

function Player({ meditation, onLeave }: { meditation: StoredMeditation; onLeave: () => void }) {
  const [state, setState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [progress, setProgress] = useState(0);
  const [voice, setVoice] = useState(() => getPreferences().voice_volume);
  const [bed, setBed] = useState(() => getPreferences().bed_volume);
  const playerRef = useRef<MeditationPlayer | null>(null);

  const bedTrack = useMemo(
    () => BED_TRACKS.find((track) => track.id === meditation.script.bed_track_id),
    [meditation.script.bed_track_id],
  );

  // Silence when the screen goes away. Speech outlives an unmounted component
  // and would follow the person to the next screen.
  useEffect(() => () => playerRef.current?.stop(), []);

  const start = () => {
    playerRef.current?.stop();
    const player = createPlayer({
      ssml: meditation.script.script_ssml,
      bed: bedTrack,
      voiceVolume: voice,
      bedVolume: bed,
      events: {
        onSegment: (index, total) => setProgress((index + 1) / total),
        onState: (next) => {
          setState(next);
          if (next !== 'playing') setProgress(next === 'finished' ? 1 : 0);
        },
      },
    });
    playerRef.current = player;
    player.play();
  };

  const stop = () => {
    playerRef.current?.stop();
    playerRef.current = null;
  };

  return (
    <Screen backdrop="palm" scrim="heavy" opacity={0.35}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-[var(--bottom-inset)] sm:min-h-0">
        <p className="eyebrow mb-3">{bedTrack?.name ?? 'Solo voz'}</p>
        <h1 className="mb-1.5 text-[28px] leading-[1.15] text-blanco">{meditation.script.title}</h1>
        <p className="mb-5 text-[11.5px] leading-relaxed text-crema/45">
          {meditation.estimated_minutes} min aproximados · pediste {meditation.requested_minutes}
        </p>

        <div className="glass mb-4 rounded-[var(--radius-option)] px-4 py-4">
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance de la práctica"
            className="mb-4 h-px w-full bg-crema/15"
          >
            <div className="h-px bg-crema/70" style={{ width: `${progress * 100}%` }} />
          </div>

          <button
            type="button"
            className="cta"
            onClick={() => (state === 'playing' ? stop() : start())}
          >
            {state === 'playing' ? 'Parar' : state === 'finished' ? 'Escuchar de nuevo' : 'Empezar'}
          </button>

          <div className="mt-4 flex flex-col gap-3">
            <VolumeSlider
              id="voice-volume"
              label="Voz"
              value={voice}
              onChange={(next) => {
                setVoice(next);
                setVolumes({ voice: next });
                playerRef.current?.setVoiceVolume(next);
              }}
            />
            <VolumeSlider
              id="bed-volume"
              label="Fondo"
              value={bed}
              onChange={(next) => {
                setBed(next);
                setVolumes({ bed: next });
                playerRef.current?.setBedVolume(next);
              }}
            />
          </div>
        </div>

        <h2 className="eyebrow mb-2">El guion</h2>
        <p className="text-[12.5px] leading-relaxed whitespace-pre-line text-crema/65">
          {meditation.script.script_text}
        </p>

        <div className="mt-7 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              stop();
              onLeave();
            }}
            className="glass-chip rounded-full px-3 py-2.5 text-[11px] tracking-wide text-crema/60 uppercase"
          >
            Armar otra
          </button>
          <p className="px-1 text-[10px] tracking-wide text-crema/25 uppercase">
            {meditation.mode === 'fixture' ? 'Modo demo · guion curado' : 'Generado con Claude'} ·{' '}
            {meditation.prompt_version}
          </p>
        </div>
      </div>
    </Screen>
  );
}

function VolumeSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="w-12 shrink-0 text-[10px] tracking-wide text-crema/50 uppercase">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-crema"
      />
    </div>
  );
}
