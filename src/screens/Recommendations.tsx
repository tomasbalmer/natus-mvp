import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Screen } from '@/components/Screen';
import { Constellation } from '@/components/Constellation';
import { ModalityCard } from '@/components/ModalityCard';
import { modalityBySlug } from '@/lib/catalog';
import { filterModalities, poolFraming } from '@/lib/matching';
import { isClinicallyVulnerable } from '@/lib/safety';
import { matchModalities } from '@/ai/match';
import { currentSynthesis } from '@/store/soulMap';
import { getSession } from '@/store/session';
import { hadCrisisWithin30Days } from '@/store/crisis';
import {
  clearReaction,
  currentMatch,
  currentMatchFor,
  recentlyDismissedSlugs,
  saveMatch,
  setReaction,
  type StoredMatch,
  type UserReaction,
} from '@/store/matches';

/**
 * PDR 7, the recommendation surface.
 *
 * The hard filter runs here, in the client, deterministically — the model
 * only ever orders and explains what the filter already allowed. That
 * division is what makes the clinical exclusions trustworthy: they are not a
 * prompt instruction the model might overlook on a bad day.
 */
export function Recommendations() {
  // Only a match computed from the *current* synthesis counts as present.
  // Redoing onboarding used to land here on the previous recommendations,
  // which is the kind of staleness nobody notices until it is embarrassing.
  const [match, setMatch] = useState<StoredMatch | undefined>(() => {
    const stored = currentSynthesis();
    return stored ? currentMatchFor(stored.id) : undefined;
  });
  const [loading, setLoading] = useState(!match);
  const [framing, setFraming] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(async () => {
    const stored = currentSynthesis();
    const session = getSession();
    if (!stored || !session) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const outcome = filterModalities({
      openness: session.draft.openness_to_modalities,
      inferredTopics: stored.synthesis.inferred_topics,
      clinicallyVulnerable: isClinicallyVulnerable({
        clinicalBasics: session.draft.clinical_basics,
        recentCrisisWithin30Days: hadCrisisWithin30Days(),
      }),
      dismissedSlugs: recentlyDismissedSlugs(),
    });

    setFraming(poolFraming(outcome));

    // PDR 7.2: never truncate in silence. The person is told, not just the log.
    setNotice(
      outcome.droppedForSize > 0
        ? `Había ${outcome.poolBeforeTruncation} caminos posibles y dejamos ${outcome.candidates.length}, empezando por los menos removedores.`
        : null,
    );

    const result = await matchModalities({
      synthesis: stored.synthesis,
      outcome,
      presentingNeedText: session.draft.presenting_need_text,
    });

    setMatch(
      saveMatch({
        result: result.value,
        strategy: outcome.strategy,
        usedFallback: result.usedFallback,
        synthesisId: stored.id,
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!match) void run();
  }, [match, run]);

  const react = (slug: string, reaction: UserReaction) => {
    const existing = match?.reactions[slug]?.reaction;
    if (existing === reaction) clearReaction(slug);
    else setReaction(slug, reaction);
    setMatch(currentMatch());
  };

  if (!currentSynthesis()) {
    return (
      <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
        <div className="flex min-h-dvh flex-col justify-center gap-6 px-6 text-center sm:min-h-0">
          <p className="text-sm leading-relaxed text-crema/65">
            Las terapias sugeridas salen de tu mapa. Generalo primero.
          </p>
          <Link to="/onboarding" className="cta no-underline">
            Empezar
          </Link>
        </div>
      </Screen>
    );
  }

  if (loading || !match) {
    return (
      <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center sm:min-h-0">
          <div className="relative flex size-24 items-center justify-center">
            <span className="orb-pulse" aria-hidden="true" />
            <span className="glass relative z-10 size-14 rounded-full" />
          </div>
          <p className="font-serif text-[19px] font-light text-blanco">Buscando caminos</p>
        </div>
      </Screen>
    );
  }

  const cards = match.result.matched_modalities
    .map((entry) => ({ entry, modality: modalityBySlug(entry.modality_slug) }))
    .filter((c): c is { entry: (typeof match.result.matched_modalities)[number]; modality: NonNullable<ReturnType<typeof modalityBySlug>> } =>
      Boolean(c.modality),
    );

  return (
    <Screen backdrop="grass" scrim="heavy" opacity={0.4}>
      <div className="flex min-h-dvh flex-col overflow-y-auto px-5 pt-[var(--top-inset)] pb-9 sm:min-h-0">
        <p className="eyebrow mb-3 text-center">Tu constelación</p>

        <Constellation modalities={cards.map((c) => c.modality)} />

        <h1 className="mt-2 mb-2 text-center text-[27px] leading-[1.15] text-blanco">
          Caminos posibles
        </h1>
        <p className="mx-auto mb-6 max-w-[280px] text-center text-[12.5px] leading-relaxed text-crema/55">
          {framing}
        </p>

        {notice && (
          <p className="mb-4 rounded-[var(--radius-option)] border border-crema/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-crema/45">
            {notice}
          </p>
        )}

        {match.used_fallback && (
          <p className="mb-4 rounded-[var(--radius-option)] border border-crema/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-crema/45">
            No pudimos generar las explicaciones personalizadas, así que estas descripciones
            vienen del catálogo. El orden sigue basándose en lo que contaste.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {cards.map(({ entry, modality }) => (
            <ModalityCard
              key={entry.modality_slug}
              modality={modality}
              rank={entry.rank}
              reasoning={entry.reasoning}
              cautionNote={entry.caution_note}
              reaction={match.reactions[entry.modality_slug]?.reaction}
              onReact={(reaction) => react(entry.modality_slug, reaction)}
            />
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-2.5">
          <Link to="/rutina" className="cta no-underline">
            Ver mi rutina
            <span aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            onClick={() => void run()}
            className="glass-chip rounded-full px-3 py-2.5 text-[11px] tracking-wide text-crema/60 uppercase"
          >
            Volver a buscar
          </button>

          <p className="px-1 text-[10px] tracking-wide text-crema/25 uppercase">
            {match.result.prompt_version} · pool {match.strategy}
          </p>
        </div>
      </div>
    </Screen>
  );
}
