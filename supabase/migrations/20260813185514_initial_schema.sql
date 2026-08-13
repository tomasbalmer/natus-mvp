-- Natus MVP — initial schema
--
-- One table per namespace in src/store/db.ts, following the mapping in
-- docs/MIGRATION.md. Timestamps are timestamptz here where the demo stored
-- epoch milliseconds; the conversion lives in the store layer (Phase 4).
--
-- Row Level Security is enabled at the foot of this file, in the same
-- migration that creates the tables. A window between the two, however short,
-- is a window in which the anon key reads everything — and the anon key ships
-- in the JavaScript bundle by design.
--
-- Ownership is uniform: every user table carries user_id referencing
-- auth.users, and every policy keys on auth.uid(). Supabase anonymous sign-in
-- means that row exists from the first visit, before any email is attached,
-- so there is no window in which data has no owner.

-- ═══════════════════════════════════════════════════════════════════════════
-- Reference data — the JSON seeds of data/, per docs/MIGRATION.md
-- ═══════════════════════════════════════════════════════════════════════════

-- PDR 5.3. The recommendation pool: the model ranks over these descriptions.
create table public.modalities (
  slug              text primary key,
  name_es           text        not null,
  name_en           text        not null,
  family            text        not null,
  short_description text        not null,
  what_happens      text        not null,
  works_well_for    text[]      not null default '{}',
  typical_format    text        not null,
  typical_horizon   text        not null,
  intensity         smallint    not null check (intensity between 1 and 5),
  evidence_level    text        not null,
  contraindications text[]      not null default '{}',
  -- PDR 7.2's clinical exclusion. The hard filter reads this, and from
  -- Phase 3 it reads it server-side: a filter running on a client can be
  -- tampered with, and this one decides whether someone in a fragile state
  -- is shown a modality that opens things up.
  requires_clinical_support boolean not null default false,
  is_active         boolean     not null default true,
  extra             jsonb       not null default '{}'::jsonb
);

comment on table public.modalities is
  'PDR 5.3. Twenty-one modalities. No facilitators — DECISIONS.md section 1.';

-- PDR 5.3. Slugs join what a user describes to modalities.works_well_for.
create table public.topics (
  slug    text primary key,
  name_es text not null,
  name_en text not null
);

-- PDR 6.4. Every row ships with verified_at null and the UI says so.
create table public.crisis_resources (
  id          uuid primary key default gen_random_uuid(),
  country     text        not null,
  type        text        not null,
  name        text        not null,
  contact     text        not null,
  note        text,
  priority    smallint    not null default 1,
  is_active   boolean     not null default true,
  -- Null until someone has telephoned the number. PDR 6.4 calls verification
  -- by calling, not by searching, an absolute launch blocker, and the crisis
  -- screen renders an unverified notice while this is null.
  verified_at timestamptz
);

create index crisis_resources_country_idx
  on public.crisis_resources (country, priority)
  where is_active;

-- PDR 5.7. Synthesis descriptors, not file paths — DECISIONS.md section 8.
create table public.bed_tracks (
  id           text primary key,
  name         text    not null,
  -- Nullable, and the two nulls are the point: `lluvia` is filtered noise and
  -- `silencio` is no bed at all. Neither has a fundamental. A not-null here
  -- would be a claim about the domain that two of the five rows disprove.
  frequency_hz integer,
  suits        text    not null,
  synthesis    jsonb   not null,
  -- PDR 5.7 makes this mandatory once real audio replaces synthesis.
  license      text,
  is_active    boolean not null default true
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.1 — the anonymous session
-- ═══════════════════════════════════════════════════════════════════════════

-- The conversion decision this serves: the account is asked for *after* the
-- Soul Map is shown, never before. The draft lives here until it is claimed.
--
-- The demo keyed this on a generated id because a static page has no identity
-- to key on. Supabase anonymous sign-in supplies one from the first visit, so
-- user_id is the key and the row is unique per user.
create table public.anonymous_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- PDR 5.1: seven days. A nightly job deletes expired unclaimed rows along
  -- with the orphaned soul map; that job is not part of this round.
  expires_at timestamptz not null default now() + interval '7 days',
  -- Furthest step reached. Only ever advances — stepping back to review an
  -- answer must not lose the fact that later screens were completed.
  step       smallint    not null default 0,

  -- The draft, as columns rather than a blob, mirroring public.clients so the
  -- claim is a copy between like shapes.
  legal_birth_name       text   not null default '',
  birth_date             date,
  -- PDR US-1.2: optional, and skipping them must not block.
  birth_time             time,
  birth_city             text   not null default '',
  birth_country          text   not null default '',
  country                text   not null default 'CL',
  locale                 text   not null default 'es' check (locale in ('es', 'en')),
  presenting_need_text   text   not null default '',
  presenting_need_slugs  text[] not null default '{}',
  -- PDR 5.2 stores openness as modality slugs; the family-level screen is
  -- expanded before it reaches here.
  openness_to_modalities text[] not null default '{}',

  -- PDR 10.2: this never enters a model payload. A derived risk level goes
  -- instead, computed at call time. Kept as discrete columns so that a
  -- select-list naming the profile fields cannot pick these up by accident.
  clinical_ideation_6m            text,
  clinical_in_treatment           boolean,
  clinical_psychiatric_medication boolean,
  clinical_prefer_not_to_say      text[] not null default '{}',

  natal_chart jsonb,
  soul_map_id uuid,
  -- PDR US-1.1 CA4: claiming expires the row rather than deleting it. The row
  -- exists, claimed, and no longer serves reads.
  claimed_at  timestamptz
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.2 — the account
-- ═══════════════════════════════════════════════════════════════════════════

-- Supabase Auth owns identity; this row owns the profile. Anonymous sign-in
-- creates the auth.users row on the first visit and the email upgrade fills it
-- in on the same row, so a client here is never re-parented.
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now(),

  legal_birth_name       text   not null default '',
  birth_date             date,
  birth_time             time,
  birth_city             text   not null default '',
  birth_country          text   not null default '',
  country                text   not null default 'CL',
  locale                 text   not null default 'es' check (locale in ('es', 'en')),
  presenting_need_text   text   not null default '',
  presenting_need_slugs  text[] not null default '{}',
  openness_to_modalities text[] not null default '{}',

  clinical_ideation_6m            text,
  clinical_in_treatment           boolean,
  clinical_psychiatric_medication boolean,
  clinical_prefer_not_to_say      text[] not null default '{}',

  natal_chart jsonb,
  soul_map_id uuid,
  claimed_session_id uuid references public.anonymous_sessions (id) on delete set null
);

comment on column public.clients.clinical_ideation_6m is
  'PDR 10.2. Never forwarded to a model. A derived risk level goes instead.';

-- PDR 5.2. One row per person.
create table public.preferences (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  locale       text    not null default 'es' check (locale in ('es', 'en')),
  -- PDR 9.5 expects these to survive a reload: someone who turned the bed
  -- down did so for a reason that is still true tomorrow.
  voice_volume real    not null default 1    check (voice_volume between 0 and 1),
  bed_volume   real    not null default 0.45 check (bed_volume between 0 and 1)
);

-- PDR 5.2. Replaced by the payment provider's webhooks; simulated until then.
create table public.subscriptions (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  status       text        not null default 'none' check (status in ('none', 'active')),
  activated_at timestamptz
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.5 — the Soul Map
-- ═══════════════════════════════════════════════════════════════════════════

create table public.soul_map_syntheses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  prompt_version text not null,
  synthesis      jsonb not null,
  -- Calculated deterministically and handed to the model as settled facts.
  -- Models are unreliable at arithmetic and these have a right answer.
  numerology     jsonb,
  mode           text not null check (mode in ('fixture', 'server')),
  latency_ms     integer not null default 0,
  created_at     timestamptz not null default now(),
  is_current     boolean not null default true
);

-- Load-bearing, and named as such in docs/MIGRATION.md. Regenerating
-- supersedes rather than deletes, and exactly one row is current per person.
create unique index one_current_synthesis
  on public.soul_map_syntheses (user_id)
  where is_current;

create index soul_map_syntheses_user_idx
  on public.soul_map_syntheses (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.4 — matching and the routine
-- ═══════════════════════════════════════════════════════════════════════════

create table public.modality_matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Which synthesis this was computed from. PDR 5.4 keeps a snapshot for
  -- reproducibility; the same field answers whether a stored match still
  -- corresponds to the person's current answers. Without it, redoing
  -- onboarding showed the previous recommendations.
  synthesis_id   uuid not null references public.soul_map_syntheses (id) on delete cascade,
  prompt_version text not null,
  strategy       text not null,
  used_fallback  boolean not null default false,
  result         jsonb not null,
  created_at     timestamptz not null default now(),
  is_current     boolean not null default true
);

create unique index one_current_match
  on public.modality_matches (user_id)
  where is_current;

-- Reactions belong to the person, not to the request, so they survive a
-- re-match. Losing them would mean re-asking about cards already dismissed.
create table public.match_reactions (
  user_id       uuid not null references auth.users (id) on delete cascade,
  modality_slug text not null references public.modalities (slug) on delete cascade,
  reaction      text not null check (reaction in ('saved', 'dismissed')),
  reacted_at    timestamptz not null default now(),
  primary key (user_id, modality_slug)
);

comment on table public.match_reactions is
  'US-6.2 CA3: a dismissed modality does not reappear in a re-match for 90 days.';

-- PDR 5.4. The unique constraint below is the one the document names.
create table public.recommendation_checkins (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  practice_title text not null,
  checked_on     date not null,
  unique (user_id, practice_title, checked_on)
);

comment on table public.recommendation_checkins is
  'PDR 12.2. A total is computable here; a consecutive run is not asked for '
  'anywhere. No streaks, no badges — DECISIONS.md section 7.';

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.6 — chat
-- ═══════════════════════════════════════════════════════════════════════════

create table public.conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- A regenerated map starts a new thread rather than continuing one built on
  -- superseded text.
  synthesis_id uuid not null references public.soul_map_syntheses (id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, synthesis_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  -- Null on the person's own messages; one of the model's four types otherwise.
  type            text check (type in ('reflection', 'recommendation', 'clarification', 'crisis')),
  text            text not null,
  linked_modality_slugs text[] not null default '{}',
  created_at      timestamptz not null default now(),
  -- Whether this answer spent one of the free questions. A turn is charged
  -- when it produced a usable answer: a failed call is not the person's
  -- problem, and a crisis turn must never be.
  counted         boolean not null default false
);

-- The quota is a count over this index. Counted across conversations: it
-- belongs to the person, not to a thread they could restart to reset it.
create index messages_quota_idx
  on public.messages (user_id)
  where counted;

create index messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.7 — meditations
-- ═══════════════════════════════════════════════════════════════════════════

create table public.meditations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  intent             text not null,
  requested_minutes  smallint not null,
  -- What the script actually came out at. The two differ, and the second is
  -- the honest number to show.
  estimated_minutes  smallint not null,
  script             jsonb not null,
  prompt_version     text not null,
  mode               text not null check (mode in ('fixture', 'server')),
  -- PDR 5.7. Null while audio is synthesised at play time; a private bucket
  -- path once TTS lands, which is not this round.
  audio_url          text,
  created_at         timestamptz not null default now()
);

create index meditations_user_idx
  on public.meditations (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.8 — chart comparison
-- ═══════════════════════════════════════════════════════════════════════════

-- The other person, entered by the account holder. Not a client: they have no
-- account here and no clinical record, which is why a comparison can never
-- reach one.
create table public.external_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  display_name     text not null,
  legal_birth_name text not null,
  birth_date       date,
  birth_time       time,
  birth_city       text not null default '',
  created_at       timestamptz not null default now()
);

create table public.comparison_consents (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  external_profile_id uuid not null references public.external_profiles (id) on delete cascade,
  scope               text not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'granted', 'denied', 'revoked')),
  requested_at        timestamptz not null default now(),
  responded_at        timestamptz,
  -- PDR 8.2: a consent expires. Silence is not permission indefinitely.
  expires_at          timestamptz not null default now() + interval '14 days'
);

-- One live request per person: asking again replaces the old one rather than
-- leaving two answers to choose between.
create unique index one_live_consent_per_profile
  on public.comparison_consents (external_profile_id);

create table public.chart_comparisons (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  external_profile_id uuid not null references public.external_profiles (id) on delete cascade,
  consent_id          uuid not null references public.comparison_consents (id) on delete cascade,
  prompt_version      text not null,
  result              jsonb not null,
  mode                text not null check (mode in ('fixture', 'server')),
  created_at          timestamptz not null default now()
);

comment on table public.chart_comparisons is
  'Readable only through a granted, unexpired consent — enforced by policy, '
  'not by the read helper. See the rls_policies migration.';

-- ═══════════════════════════════════════════════════════════════════════════
-- PDR 5.9 — crisis events
-- ═══════════════════════════════════════════════════════════════════════════

create table public.crisis_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  severity       text not null check (severity in ('low', 'high')),
  category       text not null,
  layer          text not null default 'deterministic',
  source_surface text not null check (source_surface in ('onboarding', 'chat', 'meditation_intent')),
  -- Which terms fired. Feeds the false-positive review queue.
  matched        text[] not null default '{}',
  -- PDR 5.9 privacy note: this is the triggering text, which is sensitive
  -- clinical data. Capped at 200 characters around the match by lib/safety.
  excerpt        text not null default '',
  -- Set when the verdict came from the clinical answer rather than the text.
  from_clinical_answer boolean not null default false,
  created_at     timestamptz not null default now(),
  -- PDR 6.4 step 5 deduplicates admin notification at six hours. The email
  -- itself is not this round; the rule is.
  admin_notified_at timestamptz,
  -- PDR 6.4's escape hatch. Without it, someone who wrote "ya no aguanto este
  -- trabajo" is locked out of the product with no way back.
  false_positive boolean
);

create index crisis_events_user_idx
  on public.crisis_events (user_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security — enabled here, in the same migration as the tables
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Policies arrive in the next migration. Enabled-with-no-policies denies
-- everything, which is the correct state to pass through: a table that is
-- briefly readable is worse than a table that is briefly unreachable.

alter table public.modalities              enable row level security;
alter table public.topics                  enable row level security;
alter table public.crisis_resources        enable row level security;
alter table public.bed_tracks              enable row level security;
alter table public.anonymous_sessions      enable row level security;
alter table public.clients                 enable row level security;
alter table public.preferences             enable row level security;
alter table public.subscriptions           enable row level security;
alter table public.soul_map_syntheses      enable row level security;
alter table public.modality_matches        enable row level security;
alter table public.match_reactions         enable row level security;
alter table public.recommendation_checkins enable row level security;
alter table public.conversations           enable row level security;
alter table public.messages                enable row level security;
alter table public.meditations             enable row level security;
alter table public.external_profiles       enable row level security;
alter table public.comparison_consents     enable row level security;
alter table public.chart_comparisons       enable row level security;
alter table public.crisis_events           enable row level security;
