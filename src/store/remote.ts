import type { TypedClient } from '@/supabase/client.ts';
import type { Database } from '@/supabase/database.types.ts';
import type { ClinicalBasics } from '@/lib/safety.ts';
import type { RemoteNamespace } from './namespaces.ts';
export type { RemoteNamespace } from './namespaces.ts';
import type { AnonymousSession, OnboardingDraft } from './session.ts';
import type { Client } from './account.ts';
import type { StoredSynthesis } from './soulMap.ts';
import type { CheckIn, StoredMatch } from './matches.ts';
import type { Conversation, StoredMessage } from './chat.ts';
import type { StoredMeditation } from './meditations.ts';
import type { ComparisonConsent, ExternalProfile, StoredComparison } from './comparison.ts';
import type { CrisisEvent } from './crisis.ts';
import type { Preferences } from './preferences.ts';
import type { Subscription } from './subscription.ts';

/**
 * Where a namespace becomes rows and back again.
 *
 * `db.ts` deals in namespaces because the screens do. Postgres deals in tables
 * because the promises live there — the consent gate and the clinical columns
 * are not shapes the browser invented. This file is the whole of the
 * translation, kept in one place so that the mapping for a table is next to
 * the mapping for the table beside it.
 *
 * Two conversions run through everything:
 *
 *   time  the store holds epoch milliseconds, Postgres holds timestamptz
 *   ids   the store generates uuids, and Postgres columns are typed uuid
 *
 * Nothing here reaches for a React import or a browser API, which matters
 * because the same mapping will eventually be wanted server-side.
 */

// ── conversions ─────────────────────────────────────────────────────────────

const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (value: string | null): number => (value ? Date.parse(value) : 0);
const msOrNull = (value: string | null): number | null => (value ? Date.parse(value) : null);

/** Postgres `date` and `time` reject the empty string the draft starts with. */
const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value);

/**
 * Round into an `integer` column.
 *
 * `latency_ms` comes from `performance.now()` and arrives as 2.600000023841858,
 * which Postgres refuses for an integer. Sub-millisecond precision on a call
 * that takes ten to thirty seconds is noise, so the column stays an integer and
 * the value is rounded here rather than the column being widened to carry a
 * number nobody will read.
 */
const whole = (value: number): number => Math.round(value);
const nullToBlank = (value: string | null): string => value ?? '';

/**
 * Narrow a column back to the union the application uses.
 *
 * Postgres stores these as `text` with a check constraint, so the value domain
 * is enforced there and the generated types cannot express it. The cast is
 * backed by that constraint, not by hope — see
 * `supabase/migrations/*_align_check_constraints.sql`, which exists because two
 * of them had drifted from the TypeScript and nothing had noticed.
 *
 * Widen the union in TypeScript and you must widen the constraint in the same
 * commit, or this lies.
 */
const enumerated = <T extends string>(value: string): T => value as T;

/** Columns typed `Json` by the generator, whose real shape a zod schema owns. */
const asShape = <T>(value: unknown): T => value as T;

// ── the draft, shared by anonymous_sessions and clients ─────────────────────

type DraftColumns = {
  legal_birth_name: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string;
  birth_country: string;
  country: string;
  locale: string;
  presenting_need_text: string;
  presenting_need_slugs: string[];
  openness_to_modalities: string[];
  clinical_ideation_6m: string | null;
  clinical_in_treatment: boolean | null;
  clinical_psychiatric_medication: boolean | null;
  clinical_prefer_not_to_say: string[];
  natal_chart: OnboardingDraft['natal_chart'];
};

function draftToColumns(draft: OnboardingDraft): DraftColumns {
  return {
    legal_birth_name: draft.legal_birth_name,
    birth_date: blankToNull(draft.birth_date),
    birth_time: blankToNull(draft.birth_time),
    birth_city: draft.birth_city,
    birth_country: draft.birth_country,
    country: draft.country,
    locale: draft.locale,
    presenting_need_text: draft.presenting_need_text,
    presenting_need_slugs: draft.presenting_need_slugs,
    openness_to_modalities: draft.openness_to_modalities,
    // Flattened rather than stored as a blob so that a select naming the
    // profile fields cannot pick these up by accident. PDR 10.2.
    clinical_ideation_6m: draft.clinical_basics.ideation_6m ?? null,
    clinical_in_treatment: draft.clinical_basics.in_treatment ?? null,
    clinical_psychiatric_medication: draft.clinical_basics.psychiatric_medication ?? null,
    clinical_prefer_not_to_say: draft.clinical_basics.prefer_not_to_say ?? [],
    natal_chart: draft.natal_chart,
  };
}

/** Reading is looser than writing: the generator types `natal_chart` as Json
 *  because Postgres does, and the shape is reasserted on the way out. */
type DraftRow = Omit<DraftColumns, 'natal_chart'> & { natal_chart: unknown };

function columnsToDraft(row: DraftRow): OnboardingDraft {
  // `exactOptionalPropertyTypes` is on, so an absent clinical answer has to be
  // an absent key rather than an explicit undefined — otherwise
  // `ideation_6m !== undefined`, which gates whether onboarding is complete,
  // would start reporting true for somebody who never answered.
  const clinical: ClinicalBasics = {};
  if (row.clinical_ideation_6m !== null) {
    clinical.ideation_6m = enumerated<NonNullable<ClinicalBasics['ideation_6m']>>(
      row.clinical_ideation_6m,
    );
  }
  if (row.clinical_in_treatment !== null) clinical.in_treatment = row.clinical_in_treatment;
  if (row.clinical_psychiatric_medication !== null) {
    clinical.psychiatric_medication = row.clinical_psychiatric_medication;
  }
  if (row.clinical_prefer_not_to_say.length > 0) {
    clinical.prefer_not_to_say = row.clinical_prefer_not_to_say;
  }

  return {
    legal_birth_name: row.legal_birth_name,
    birth_date: nullToBlank(row.birth_date),
    // Postgres returns `time` as HH:MM:SS; the input element wants HH:MM.
    birth_time: nullToBlank(row.birth_time).slice(0, 5),
    birth_city: row.birth_city,
    birth_country: row.birth_country,
    country: row.country,
    locale: row.locale === 'en' ? 'en' : 'es',
    presenting_need_text: row.presenting_need_text,
    presenting_need_slugs: row.presenting_need_slugs,
    openness_to_modalities: row.openness_to_modalities,
    clinical_basics: clinical,
    natal_chart: (row.natal_chart as OnboardingDraft['natal_chart']) ?? null,
  };
}

// ── row-set replacement ─────────────────────────────────────────────────────

/**
 * Make `table` hold exactly `rows` for this user.
 *
 * The store hands whole arrays because that is how `localStorage` worked, so
 * a save is a set replacement rather than a diff. Upsert what is present,
 * then delete what is not — in that order, because the reverse leaves a
 * window in which the person's data is gone.
 */
type TableName = keyof Database['public']['Tables'];

async function replaceRows(
  client: TypedClient,
  table: TableName,
  userId: string,
  rows: Array<Record<string, unknown> & { id: string }>,
): Promise<void> {
  // The table name is generic here, which defeats the generated types on the
  // builder itself. Loose inside, precise at the edges: every caller below
  // hands rows it has already shaped, and selectAll returns the real Row type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = client.from(table) as any;

  if (rows.length > 0) {
    const { error } = await loose.upsert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  let query = loose.delete().eq('user_id', userId);
  if (rows.length > 0) query = query.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`);
  const { error } = await query;
  if (error) throw new Error(`${table} (prune): ${error.message}`);
}

async function selectAll<T extends TableName>(
  client: TypedClient,
  table: T,
  userId: string,
  order = 'created_at',
): Promise<Array<Database['public']['Tables'][T]['Row']>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from(table) as any)
    .select('*')
    .eq('user_id', userId)
    .order(order, { ascending: true });
  if (error) throw new Error(`${table}: ${(error as { message: string }).message}`);
  return (data ?? []) as Array<Database['public']['Tables'][T]['Row']>;
}

// ── adapters ────────────────────────────────────────────────────────────────

type Adapter<T> = {
  load(client: TypedClient, userId: string): Promise<T>;
  save(client: TypedClient, userId: string, value: T): Promise<void>;
};

const preferences: Adapter<Preferences> = {
  async load(client, userId) {
    const { data } = await client.from('preferences').select('*').eq('user_id', userId).maybeSingle();
    return {
      locale: data?.locale === 'en' ? 'en' : 'es',
      voice_volume: data?.voice_volume ?? 1,
      bed_volume: data?.bed_volume ?? 0.45,
    };
  },
  async save(client, userId, value) {
    const { error } = await client.from('preferences').upsert({ user_id: userId, ...value });
    if (error) throw new Error(`preferences: ${error.message}`);
  },
};

const subscription: Adapter<Subscription> = {
  async load(client, userId) {
    const { data } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.status === 'active'
      ? { status: 'active', activated_at: msOrNull(data.activated_at) }
      : { status: 'none', activated_at: null };
  },
  async save(client, userId, value) {
    const { error } = await client.from('subscriptions').upsert({
      user_id: userId,
      status: value.status,
      activated_at: value.activated_at === null ? null : iso(value.activated_at),
    });
    if (error) throw new Error(`subscriptions: ${error.message}`);
  },
};

const anonymousSession: Adapter<AnonymousSession | null> = {
  async load(client, userId) {
    const { data } = await client
      .from('anonymous_sessions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      created_at: ms(data.created_at),
      expires_at: ms(data.expires_at),
      step: data.step,
      draft: columnsToDraft(data),
      soul_map_id: data.soul_map_id,
      claimed_by: data.claimed_at ? userId : null,
    };
  },
  async save(client, userId, value) {
    if (value === null) {
      const { error } = await client.from('anonymous_sessions').delete().eq('user_id', userId);
      if (error) throw new Error(`anonymous_sessions: ${error.message}`);
      return;
    }
    const { error } = await client.from('anonymous_sessions').upsert(
      {
        id: value.id,
        user_id: userId,
        created_at: iso(value.created_at),
        expires_at: iso(value.expires_at),
        step: value.step,
        soul_map_id: value.soul_map_id,
        claimed_at: value.claimed_by ? iso(value.expires_at) : null,
        ...draftToColumns(value.draft),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(`anonymous_sessions: ${error.message}`);
  },
};

const clientRow: Adapter<Client | null> = {
  async load(client, userId) {
    const { data } = await client.from('clients').select('*').eq('user_id', userId).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      email: data.email ?? '',
      created_at: ms(data.created_at),
      profile: columnsToDraft(data),
      soul_map_id: data.soul_map_id,
      claimed_session_id: data.claimed_session_id,
    };
  },
  async save(client, userId, value) {
    if (value === null) {
      const { error } = await client.from('clients').delete().eq('user_id', userId);
      if (error) throw new Error(`clients: ${error.message}`);
      return;
    }
    const { error } = await client.from('clients').upsert(
      {
        id: value.id,
        user_id: userId,
        email: value.email || null,
        created_at: iso(value.created_at),
        soul_map_id: value.soul_map_id,
        claimed_session_id: value.claimed_session_id,
        ...draftToColumns(value.profile),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new Error(`clients: ${error.message}`);
  },
};

const syntheses: Adapter<StoredSynthesis[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'soul_map_syntheses', userId)).map((r) => ({
      id: r.id,
      prompt_version: r.prompt_version,
      synthesis: asShape<StoredSynthesis['synthesis']>(r.synthesis),
      numerology: asShape<StoredSynthesis['numerology']>(r.numerology),
      mode: enumerated<StoredSynthesis['mode']>(r.mode),
      latency_ms: r.latency_ms,
      created_at: ms(r.created_at),
      is_current: r.is_current,
    }));
  },
  async save(client, userId, value) {
    // Supersede before promoting: `one_current_synthesis` is a unique partial
    // index, so an upsert that sets a second row current while the first is
    // still current violates it mid-statement.
    const { error } = await client
      .from('soul_map_syntheses')
      .update({ is_current: false })
      .eq('user_id', userId)
      .eq('is_current', true);
    if (error) throw new Error(`soul_map_syntheses (supersede): ${error.message}`);

    await replaceRows(
      client,
      'soul_map_syntheses',
      userId,
      value.map((s) => ({
        id: s.id,
        user_id: userId,
        prompt_version: s.prompt_version,
        synthesis: s.synthesis,
        numerology: s.numerology,
        mode: s.mode,
        latency_ms: whole(s.latency_ms),
        created_at: iso(s.created_at),
        is_current: s.is_current,
      })),
    );
  },
};

const matches: Adapter<StoredMatch[]> = {
  async load(client, userId) {
    const [rows, reactionRows] = await Promise.all([
      selectAll(client, 'modality_matches', userId),
      selectAll(client, 'match_reactions', userId, 'reacted_at'),
    ]);

    // Reactions are one table for the person, not one column per request, so
    // they are attached to whichever match is current — which is exactly the
    // "they survive a re-match" rule store/matches.ts states.
    const reactions: StoredMatch['reactions'] = {};
    for (const r of reactionRows) {
      reactions[r.modality_slug] = { reaction: enumerated<StoredMatch['reactions'][string]['reaction']>(r.reaction), at: ms(r.reacted_at) };
    }

    return rows.map((r) => ({
      id: r.id,
      prompt_version: r.prompt_version,
      strategy: r.strategy,
      used_fallback: r.used_fallback,
      synthesis_id: r.synthesis_id,
      result: asShape<StoredMatch['result']>(r.result),
      reactions: r.is_current ? reactions : {},
      created_at: ms(r.created_at),
      is_current: r.is_current,
    }));
  },
  async save(client, userId, value) {
    const { error } = await client
      .from('modality_matches')
      .update({ is_current: false })
      .eq('user_id', userId)
      .eq('is_current', true);
    if (error) throw new Error(`modality_matches (supersede): ${error.message}`);

    await replaceRows(
      client,
      'modality_matches',
      userId,
      value.map((m) => ({
        id: m.id,
        user_id: userId,
        synthesis_id: m.synthesis_id,
        prompt_version: m.prompt_version,
        strategy: m.strategy,
        used_fallback: m.used_fallback,
        result: m.result,
        created_at: iso(m.created_at),
        is_current: m.is_current,
      })),
    );

    const current = value.find((m) => m.is_current);
    const rows = Object.entries(current?.reactions ?? {}).map(([slug, r]) => ({
      user_id: userId,
      modality_slug: slug,
      reaction: r.reaction,
      reacted_at: iso(r.at),
    }));

    if (rows.length > 0) {
      const { error: upErr } = await client
        .from('match_reactions')
        .upsert(rows, { onConflict: 'user_id,modality_slug' });
      if (upErr) throw new Error(`match_reactions: ${upErr.message}`);
    }

    // Composite key, no id column, so the prune keys on the slug instead.
    let prune = client.from('match_reactions').delete().eq('user_id', userId);
    if (rows.length > 0) {
      prune = prune.not('modality_slug', 'in', `(${rows.map((r) => r.modality_slug).join(',')})`);
    }
    const { error: delErr } = await prune;
    if (delErr) throw new Error(`match_reactions (prune): ${delErr.message}`);
  },
};

const checkins: Adapter<CheckIn[]> = {
  async load(client, userId) {
    const { data, error } = await client
      .from('recommendation_checkins')
      .select('*')
      .eq('user_id', userId)
      .order('checked_on', { ascending: true });
    if (error) throw new Error(`recommendation_checkins: ${error.message}`);
    return (data ?? []).map((r) => ({
      practice_title: r.practice_title,
      checked_on: r.checked_on,
    }));
  },
  async save(client, userId, value) {
    // No client-side id on a check-in — it is identified by
    // (practice, day), which is the unique constraint PDR 5.4 names. Replace
    // wholesale rather than reconcile: the set is a handful of rows.
    const { error: delErr } = await client
      .from('recommendation_checkins')
      .delete()
      .eq('user_id', userId);
    if (delErr) throw new Error(`recommendation_checkins (clear): ${delErr.message}`);

    if (value.length === 0) return;
    const { error } = await client.from('recommendation_checkins').insert(
      value.map((c) => ({
        user_id: userId,
        practice_title: c.practice_title,
        checked_on: c.checked_on,
      })),
    );
    if (error) throw new Error(`recommendation_checkins: ${error.message}`);
  },
};

const conversations: Adapter<Conversation[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'conversations', userId)).map((r) => ({
      id: r.id,
      synthesis_id: r.synthesis_id,
      created_at: ms(r.created_at),
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'conversations',
      userId,
      value.map((c) => ({
        id: c.id,
        user_id: userId,
        synthesis_id: c.synthesis_id,
        created_at: iso(c.created_at),
      })),
    ),
};

const messages: Adapter<StoredMessage[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'messages', userId)).map((r) => ({
      id: r.id,
      conversation_id: r.conversation_id,
      role: enumerated<StoredMessage['role']>(r.role),
      type: r.type === null ? null : enumerated<NonNullable<StoredMessage['type']>>(r.type),
      text: r.text,
      linked_modality_slugs: r.linked_modality_slugs,
      created_at: ms(r.created_at),
      counted: r.counted,
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'messages',
      userId,
      value.map((m) => ({
        id: m.id,
        user_id: userId,
        conversation_id: m.conversation_id,
        role: m.role,
        type: m.type,
        text: m.text,
        linked_modality_slugs: m.linked_modality_slugs,
        created_at: iso(m.created_at),
        counted: m.counted,
      })),
    ),
};

const meditations: Adapter<StoredMeditation[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'meditations', userId)).map((r) => ({
      id: r.id,
      intent: r.intent,
      requested_minutes: r.requested_minutes,
      estimated_minutes: r.estimated_minutes,
      script: asShape<StoredMeditation['script']>(r.script),
      prompt_version: r.prompt_version,
      mode: enumerated<StoredMeditation['mode']>(r.mode),
      created_at: ms(r.created_at),
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'meditations',
      userId,
      value.map((m) => ({
        id: m.id,
        user_id: userId,
        intent: m.intent,
        requested_minutes: m.requested_minutes,
        estimated_minutes: m.estimated_minutes,
        script: m.script,
        prompt_version: m.prompt_version,
        mode: m.mode,
        created_at: iso(m.created_at),
      })),
    ),
};

const externalProfiles: Adapter<ExternalProfile[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'external_profiles', userId)).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      legal_birth_name: r.legal_birth_name,
      birth_date: nullToBlank(r.birth_date),
      birth_time: nullToBlank(r.birth_time).slice(0, 5),
      birth_city: r.birth_city,
      created_at: ms(r.created_at),
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'external_profiles',
      userId,
      value.map((p) => ({
        id: p.id,
        user_id: userId,
        display_name: p.display_name,
        legal_birth_name: p.legal_birth_name,
        birth_date: blankToNull(p.birth_date),
        birth_time: blankToNull(p.birth_time),
        birth_city: p.birth_city,
        created_at: iso(p.created_at),
      })),
    ),
};

const consents: Adapter<ComparisonConsent[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'comparison_consents', userId, 'requested_at')).map((r) => ({
      id: r.id,
      external_profile_id: r.external_profile_id,
      scope: asShape<ComparisonConsent['scope']>(r.scope),
      status: enumerated<ComparisonConsent['status']>(r.status),
      requested_at: ms(r.requested_at),
      responded_at: msOrNull(r.responded_at),
      expires_at: ms(r.expires_at),
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'comparison_consents',
      userId,
      value.map((c) => ({
        id: c.id,
        user_id: userId,
        external_profile_id: c.external_profile_id,
        scope: c.scope,
        status: c.status,
        requested_at: iso(c.requested_at),
        responded_at: c.responded_at === null ? null : iso(c.responded_at),
        expires_at: iso(c.expires_at),
      })),
    ),
};

const comparisons: Adapter<StoredComparison[]> = {
  async load(client, userId) {
    // What comes back here is already filtered by the consent gate in
    // supabase/migrations/*_rls_policies.sql. A revoked consent means the row
    // is simply absent, with no check performed on this side — which is the
    // point of moving that rule into a policy.
    return (await selectAll(client, 'chart_comparisons', userId)).map((r) => ({
      id: r.id,
      external_profile_id: r.external_profile_id,
      consent_id: r.consent_id,
      prompt_version: r.prompt_version,
      result: asShape<StoredComparison['result']>(r.result),
      mode: enumerated<StoredComparison['mode']>(r.mode),
      created_at: ms(r.created_at),
    }));
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'chart_comparisons',
      userId,
      value.map((c) => ({
        id: c.id,
        user_id: userId,
        external_profile_id: c.external_profile_id,
        consent_id: c.consent_id,
        prompt_version: c.prompt_version,
        result: c.result,
        mode: c.mode,
        created_at: iso(c.created_at),
      })),
    ),
};

const crisisEvents: Adapter<CrisisEvent[]> = {
  async load(client, userId) {
    return (await selectAll(client, 'crisis_events', userId)).map((r) => {
      const event: CrisisEvent = {
        id: r.id,
        severity: enumerated<CrisisEvent['severity']>(r.severity),
        category: enumerated<CrisisEvent['category']>(r.category),
        layer: 'deterministic',
        matched: r.matched,
        excerpt: r.excerpt,
        source_surface: enumerated<CrisisEvent['source_surface']>(r.source_surface),
        created_at: ms(r.created_at),
        admin_notified_at: msOrNull(r.admin_notified_at),
        false_positive: r.false_positive,
      };
      // Optional-and-only-true in the type, so it is set or absent.
      if (r.from_clinical_answer) event.from_clinical_answer = true;
      return event;
    });
  },
  save: (client, userId, value) =>
    replaceRows(
      client,
      'crisis_events',
      userId,
      value.map((e) => ({
        id: e.id,
        user_id: userId,
        severity: e.severity,
        category: e.category,
        layer: e.layer,
        source_surface: e.source_surface,
        matched: e.matched,
        excerpt: e.excerpt,
        from_clinical_answer: e.from_clinical_answer === true,
        created_at: iso(e.created_at),
        admin_notified_at: e.admin_notified_at === null ? null : iso(e.admin_notified_at),
        false_positive: e.false_positive,
      })),
    ),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ADAPTERS: Record<RemoteNamespace, Adapter<any>> = {
  anonymous_session: anonymousSession,
  client: clientRow,
  soul_map_synthesis: syntheses,
  recommendation_checkins: checkins,
  modality_matches: matches,
  conversations,
  messages,
  meditations,
  external_profiles: externalProfiles,
  comparison_consents: consents,
  chart_comparisons: comparisons,
  crisis_events: crisisEvents,
  subscription,
  preferences,
};
