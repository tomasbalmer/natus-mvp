import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { isClinicallyVulnerable, type ClinicalBasics } from '../_shared/lib/safety.ts';
import { modalityBySlug } from '../_shared/lib/catalog.ts';

/**
 * PDR 7.2's clinical exclusion, where it counts.
 *
 * `src/lib/matching.ts` has said since step 3.4 of the backend plan that the
 * Edge Function's copy of this rule is authoritative. When the match moved
 * server-side the rule did not come with it: the function took the candidate
 * slugs the browser sent and handed them to the model, so a bug in the
 * client's pool — or a stale draft — was the only thing deciding whether
 * somebody in a fragile state was recommended a modality that opens things up.
 *
 * The answers are read from Postgres as the person, under RLS, never from the
 * request body; and they are read here, not forwarded. What reaches the model
 * is still only the filter's outcome — raw clinical_basics never enters a
 * payload, as `CLAUDE.md` requires.
 */

const THIRTY_DAYS_MS = 30 * 24 * 3_600_000;

type ClinicalColumns = {
  clinical_ideation_6m: string | null;
  clinical_psychiatric_medication: boolean | null;
};

function toBasics(row: ClinicalColumns): ClinicalBasics {
  const basics: ClinicalBasics = {};
  if (row.clinical_ideation_6m !== null) {
    basics.ideation_6m = row.clinical_ideation_6m as NonNullable<ClinicalBasics['ideation_6m']>;
  }
  if (row.clinical_psychiatric_medication !== null) {
    basics.psychiatric_medication = row.clinical_psychiatric_medication;
  }
  return basics;
}

/**
 * The same predicate the browser applies, over the same inputs, read from the
 * rows rather than trusted from the caller.
 *
 * **Fails closed.** A person whose answers cannot be read is treated as
 * vulnerable. The cost of being wrong that way is a shorter list; the cost of
 * being wrong the other way is the exact harm this rule exists to prevent.
 */
export async function callerIsClinicallyVulnerable(
  caller: SupabaseClient,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const columns = 'clinical_ideation_6m, clinical_psychiatric_medication';
  const since = new Date(now - THIRTY_DAYS_MS).toISOString();

  const [account, session, crises] = await Promise.all([
    caller.from('clients').select(columns).eq('user_id', userId).maybeSingle(),
    caller.from('anonymous_sessions').select(columns).eq('user_id', userId).maybeSingle(),
    caller
      .from('crisis_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      // Nullable, and null means nobody has marked it: it counts, as it does
      // in hadCrisisWithin30Days().
      .not('false_positive', 'is', true)
      .gte('created_at', since),
  ]);

  if (account.error || session.error || crises.error) return true;

  // After signup the account holds the answers; before it, the session does.
  // The same precedence as activeProfile() in src/store/account.ts.
  const row = (account.data ?? session.data) as ClinicalColumns | null;
  if (!row) return true;

  return isClinicallyVulnerable({
    clinicalBasics: toBasics(row),
    recentCrisisWithin30Days: (crises.count ?? 0) > 0,
  });
}

/** The pool with the exclusion applied, and what it removed. */
export function withoutClinicalExclusions(
  candidateSlugs: readonly string[],
  vulnerable: boolean,
): { kept: string[]; excluded: string[] } {
  if (!vulnerable) return { kept: [...candidateSlugs], excluded: [] };
  const kept: string[] = [];
  const excluded: string[] = [];
  for (const slug of candidateSlugs) {
    if (modalityBySlug(slug)?.requires_clinical_support) excluded.push(slug);
    else kept.push(slug);
  }
  return { kept, excluded };
}
