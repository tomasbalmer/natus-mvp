import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { CrisisBanner } from '@/components/CrisisBanner';
import { ProgressRow } from '@/components/onboarding/StepChrome';
import { CrisisScreen } from '@/screens/CrisisScreen';
import { detectCrisis } from '@/lib/safety';
import { computeNumerology, NumerologyInputError } from '@/lib/numerology';
import {
  getOrCreateSession,
  setStep,
  updateDraft,
  type OnboardingDraft,
} from '@/store/session';
import { markFalsePositive, recordCrisisEvent } from '@/store/crisis';
import { BasicData } from './BasicData';
import { PresentingNeed } from './PresentingNeed';
import { Openness } from './Openness';
import { ClinicalBasics } from './ClinicalBasics';
import { Generating } from './Generating';

/**
 * Screens 2 to 7 of PDR 6.1. Screen 1 is the landing and screen 8 is the Soul
 * Map, which lands in Phase 4.
 *
 * Layer 1 safety runs on leaving the clinical screen and again before
 * generation, which is where PDR 6.5 puts it in the pipeline. A high-severity
 * signal replaces the flow with the crisis screen and nothing is generated; a
 * low-severity one adds a persistent banner and lets the person continue.
 */

const STEPS = ['datos', 'pregunta', 'apertura', 'clinicos', 'generando'] as const;
type StepName = (typeof STEPS)[number];

const LABELS: Record<StepName, string> = {
  datos: 'Quién sos',
  pregunta: 'Lo que te estás preguntando',
  apertura: 'Cómo te gustaría trabajar',
  clinicos: 'Para cuidarte',
  generando: '',
};

const BACKDROPS = {
  datos: 'surf',
  pregunta: 'surf',
  apertura: 'grass',
  clinicos: 'palm',
} as const;

export function Onboarding() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getOrCreateSession());
  const [index, setIndex] = useState(0);
  const [crisisEventId, setCrisisEventId] = useState<string | null>(null);
  const [lowSeverity, setLowSeverity] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Remounts Generating so a retry actually re-runs. PDR 6.5: the input is
  // never lost, so retrying costs the person nothing but the wait.
  const [attempt, setAttempt] = useState(0);

  const draft = session.draft;
  const step = STEPS[index] ?? 'datos';

  const change = useCallback((patch: Partial<OnboardingDraft>) => {
    setSession(updateDraft(patch));
  }, []);

  const advance = useCallback(() => {
    // The updater has to stay pure. Persisting from inside it meant the write
    // ran twice under StrictMode's double-invoke, and React was free to
    // discard the result — the screen simply stopped advancing.
    const next = Math.min(index + 1, STEPS.length - 1);
    setIndex(next);
    setSession(setStep(next));
  }, [index]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /**
   * Layer 1 over everything collected so far. Returns true when the flow may
   * continue. PDR 6.5 pipeline step 2: on a high-severity signal, return the
   * crisis payload and do not call the model at all.
   */
  const runSafety = useCallback((): boolean => {
    const verdict = detectCrisis({
      texts: [draft.presenting_need_text],
      clinicalBasics: draft.clinical_basics,
    });
    if (!verdict.crisis) return true;

    const event = recordCrisisEvent(verdict, 'onboarding');
    if (verdict.severity === 'high') {
      setCrisisEventId(event.id);
      return false;
    }
    setLowSeverity(true);
    return true;
  }, [draft.presenting_need_text, draft.clinical_basics]);

  const numerologyPreview = useMemo(() => {
    if (!draft.legal_birth_name || !/^\d{4}-\d{2}-\d{2}$/.test(draft.birth_date)) return null;
    try {
      return computeNumerology({
        legalBirthName: draft.legal_birth_name,
        birthDate: draft.birth_date,
      });
    } catch (error) {
      // A name with no Latin letters. The flow continues without numbers
      // rather than blocking on a rule the person cannot satisfy.
      if (error instanceof NumerologyInputError) return null;
      throw error;
    }
  }, [draft.legal_birth_name, draft.birth_date]);

  if (crisisEventId) {
    return (
      <CrisisScreen
        country={draft.country}
        onNotMyCase={() => {
          markFalsePositive(crisisEventId);
          setCrisisEventId(null);
          advance();
        }}
        onBack={() => {
          setCrisisEventId(null);
          setIndex(STEPS.indexOf('clinicos'));
        }}
      />
    );
  }

  if (step === 'generando') {
    if (failure) {
      return (
        <Screen backdrop="surf" scrim="diagonal" opacity={0.6}>
          <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-8 text-center sm:min-h-0">
            <p className="text-sm leading-relaxed text-crema/75">{failure}</p>
            <button
              type="button"
              className="cta"
              onClick={() => {
                setFailure(null);
                setAttempt((a) => a + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        </Screen>
      );
    }

    return (
      <Generating
        key={attempt}
        draft={draft}
        numerology={numerologyPreview}
        onDone={() => navigate('/mapa')}
        onFailed={setFailure}
      />
    );
  }

  const total = STEPS.length - 1;

  return (
    <Screen backdrop={BACKDROPS[step]} scrim="even" opacity={0.55}>
      <div className="flex min-h-dvh flex-col px-[22px] pt-[var(--top-inset)] pb-8 sm:min-h-0 sm:h-full">
        <ProgressRow
          label={LABELS[step]}
          step={index + 1}
          total={total}
          onBack={index > 0 ? back : undefined}
        />

        {lowSeverity && (
          <div className="-mx-1 mb-4">
            <CrisisBanner country={draft.country} />
          </div>
        )}

        {step === 'datos' && <BasicData draft={draft} onChange={change} onNext={advance} />}
        {step === 'pregunta' && (
          <PresentingNeed draft={draft} onChange={change} onNext={advance} />
        )}
        {step === 'apertura' && <Openness draft={draft} onChange={change} onNext={advance} />}
        {step === 'clinicos' && (
          <ClinicalBasics
            draft={draft}
            onChange={change}
            onNext={() => {
              if (runSafety()) advance();
            }}
          />
        )}
      </div>
    </Screen>
  );
}
