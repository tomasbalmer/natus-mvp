-- Synastry needs a country.
--
-- `external_profiles` already carried a birth date, time and city, because the
-- table was written from the type. The form only ever asked for the date, and
-- the two facts together are why the chart comparison has never had a chart to
-- compare: without a country the geocoding step has nothing to resolve, and
-- without coordinates the ephemeris cannot place the second chart.
--
-- Nullable, and the form treats the three place fields as one optional group.
-- A comparison without them still runs on numbers and themes, which is the
-- same degradation the Soul Map already makes for somebody who does not know
-- their birth time.
alter table public.external_profiles
  add column if not exists birth_country text;

comment on column public.external_profiles.birth_country is
  'ISO 3166-1 alpha-2. Null when the person did not supply a birth place.';
