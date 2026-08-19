/**
 * The namespace list, apart from `db.ts` so that the remote adapters can name
 * a namespace without importing the storage layer they are wired into.
 *
 * `soul_map` and `recommendations` were declared in the original union and
 * never read or written by anything. They are gone rather than carried across
 * as empty tables nobody queries.
 */
export type Namespace =
  | 'anonymous_session'
  | 'client'
  | 'soul_map_synthesis'
  | 'recommendation_checkins'
  | 'modality_matches'
  | 'conversations'
  | 'messages'
  | 'meditations'
  | 'external_profiles'
  | 'comparison_consents'
  | 'chart_comparisons'
  | 'crisis_events'
  | 'subscription'
  | 'preferences';

/**
 * `ai_mode` used to live at the end of that union and held a pasted Anthropic
 * key. Removing the BYOK path took the namespace with it — and `purgeRetiredNamespaces` in `db.ts` clears the bucket from browsers
 * that already have one, because a credential nobody can reach any more is
 * still a credential sitting on somebody's disk.
 */


/** The namespaces backed by Postgres. Anything absent stays in this browser. */
export const REMOTE_NAMESPACES = [
  'anonymous_session',
  'client',
  'soul_map_synthesis',
  'recommendation_checkins',
  'modality_matches',
  'conversations',
  'messages',
  'meditations',
  'external_profiles',
  'comparison_consents',
  'chart_comparisons',
  'crisis_events',
  'subscription',
  'preferences',
] as const satisfies readonly Namespace[];

export type RemoteNamespace = (typeof REMOTE_NAMESPACES)[number];

export function isRemote(ns: Namespace): ns is RemoteNamespace {
  return (REMOTE_NAMESPACES as readonly string[]).includes(ns);
}
