import { read, write } from './db';
import type { MatchResult } from '@/lib/schemas';

/**
 * Mirrors `match_requests`, `modality_matches`, `recommendations` and
 * `recommendation_checkins` from PDR 5.4.
 *
 * The check-in table exists and the streak does not. PDR 12.2 makes that a
 * cultural decision rather than a backlog item: no streaks, no badges, no
 * "don't break your chain" notifications, because they contradict the stated
 * goal of the product making itself unnecessary. There is nowhere in this
 * file to store a consecutive-day count.
 */

export type UserReaction = 'saved' | 'dismissed';

export type StoredMatch = {
  id: string;
  prompt_version: string;
  strategy: string;
  used_fallback: boolean;
  /**
   * Which synthesis this match was computed from. PDR 5.4 stores a
   * `soul_map_snapshot` on `match_requests` for reproducibility; the same
   * field also answers a question the demo hit immediately — whether a stored
   * match still corresponds to the person's current answers. Without it,
   * redoing onboarding showed the previous recommendations.
   */
  synthesis_id: string;
  result: MatchResult;
  reactions: Record<string, { reaction: UserReaction; at: number }>;
  created_at: number;
  is_current: boolean;
};

export type CheckIn = {
  practice_title: string;
  /** ISO date. One per practice per day — the unique constraint of PDR 5.4. */
  checked_on: string;
};

const DISMISSAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `match-${Math.trunc(performance.now())}`;
}

export function listMatches(): StoredMatch[] {
  return read<StoredMatch[]>('modality_matches', []);
}

export function currentMatch(): StoredMatch | undefined {
  return listMatches().find((m) => m.is_current);
}

/** A stored match computed from a superseded synthesis must not be shown. */
export function currentMatchFor(synthesisId: string): StoredMatch | undefined {
  const match = currentMatch();
  return match?.synthesis_id === synthesisId ? match : undefined;
}

export function saveMatch(input: {
  result: MatchResult;
  strategy: string;
  usedFallback: boolean;
  synthesisId: string;
  now?: number;
}): StoredMatch {
  const now = input.now ?? Date.now();

  // Reactions belong to the person, not to the request, so they survive a
  // re-match. Losing them would mean re-asking about cards already dismissed.
  const carried = currentMatch()?.reactions ?? {};

  const record: StoredMatch = {
    id: newId(),
    prompt_version: input.result.prompt_version,
    strategy: input.strategy,
    used_fallback: input.usedFallback,
    synthesis_id: input.synthesisId,
    result: input.result,
    reactions: carried,
    created_at: now,
    is_current: true,
  };

  write('modality_matches', [
    ...listMatches().map((m) => ({ ...m, is_current: false })),
    record,
  ]);
  return record;
}

export function setReaction(slug: string, reaction: UserReaction, now = Date.now()): void {
  const matches = listMatches();
  write(
    'modality_matches',
    matches.map((m) =>
      m.is_current ? { ...m, reactions: { ...m.reactions, [slug]: { reaction, at: now } } } : m,
    ),
  );
}

export function clearReaction(slug: string): void {
  write(
    'modality_matches',
    listMatches().map((m) => {
      if (!m.is_current) return m;
      const next = { ...m.reactions };
      delete next[slug];
      return { ...m, reactions: next };
    }),
  );
}

/** US-6.2 CA3: dismissed modalities do not reappear in a re-match for 90 days. */
export function recentlyDismissedSlugs(now = Date.now()): string[] {
  const reactions = currentMatch()?.reactions ?? {};
  return Object.entries(reactions)
    .filter(([, r]) => r.reaction === 'dismissed' && now - r.at < DISMISSAL_TTL_MS)
    .map(([slug]) => slug);
}

export function savedSlugs(): string[] {
  const reactions = currentMatch()?.reactions ?? {};
  return Object.entries(reactions)
    .filter(([, r]) => r.reaction === 'saved')
    .map(([slug]) => slug);
}

export function listCheckIns(): CheckIn[] {
  return read<CheckIn[]>('recommendation_checkins', []);
}

export function isCheckedToday(title: string, today: string): boolean {
  return listCheckIns().some((c) => c.practice_title === title && c.checked_on === today);
}

export function toggleCheckIn(title: string, today: string): void {
  const existing = listCheckIns();
  const already = existing.some((c) => c.practice_title === title && c.checked_on === today);
  write(
    'recommendation_checkins',
    already
      ? existing.filter((c) => !(c.practice_title === title && c.checked_on === today))
      : [...existing, { practice_title: title, checked_on: today }],
  );
}

/**
 * How many days this practice was marked, ever.
 *
 * Deliberately a total, not a run. A consecutive count is the number a streak
 * is built from, and PDR 12.2 rules streaks out — so the number that would
 * enable one is not computed anywhere.
 */
export function totalCheckIns(title: string): number {
  return listCheckIns().filter((c) => c.practice_title === title).length;
}
