/**
 * The countries the birth-place geocoding is offered for.
 *
 * Shared by the onboarding and by the screen that loads a second person,
 * because the two lists have to agree: a chart can be calculated for one of
 * them and not the other only if a country is missing from one list, and the
 * failure would show up as a comparison that silently has no aspects.
 *
 * LATAM plus the United States, which is where the audience is and where the
 * diaspora is. `Open-Meteo` will geocode anywhere; this list is the product's
 * scope, not the provider's.
 */
export const BIRTH_COUNTRIES: readonly (readonly [string, string])[] = [
  ['', 'Elegí un país'],
  ['AR', 'Argentina'],
  ['BO', 'Bolivia'],
  ['BR', 'Brasil'],
  ['CL', 'Chile'],
  ['CO', 'Colombia'],
  ['CR', 'Costa Rica'],
  ['CU', 'Cuba'],
  ['DO', 'República Dominicana'],
  ['EC', 'Ecuador'],
  ['SV', 'El Salvador'],
  ['GT', 'Guatemala'],
  ['HN', 'Honduras'],
  ['MX', 'México'],
  ['NI', 'Nicaragua'],
  ['PA', 'Panamá'],
  ['PY', 'Paraguay'],
  ['PE', 'Perú'],
  ['PR', 'Puerto Rico'],
  ['UY', 'Uruguay'],
  ['US', 'Estados Unidos'],
  ['VE', 'Venezuela'],
];
