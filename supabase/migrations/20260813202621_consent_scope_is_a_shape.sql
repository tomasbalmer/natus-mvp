-- comparison_consents.scope holds a shape, not a name.
--
-- ComparisonScope in src/lib/comparison-payload.ts is
-- { numerology, astro, soul_map_themes } — three independent booleans, because
-- the person consents to each kind of material separately. That is the whole
-- reason PDR 8.2 has a scope at all rather than a yes/no. Declaring the column
-- `text` in the initial schema would have stored "[object Object]" and the
-- consent would have been unreadable at exactly the moment it mattered.
--
-- Caught by the type checker the first time the adapter tried to map it, which
-- is the argument for `supabase gen types` being part of this loop: the column
-- type and the application type are now checked against one another rather
-- than agreed by hand and hoped over.
alter table public.comparison_consents
  alter column scope type jsonb using to_jsonb(scope);

alter table public.comparison_consents
  alter column scope
  set default '{"numerology": false, "astro": false, "soul_map_themes": false}'::jsonb;
