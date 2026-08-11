import { JSON_DISCIPLINE, TONE_RULES } from './shared';
import type { ComparisonPayload } from '@/lib/comparison-payload';

/**
 * Comparing two charts. PDR sections 8.4 and 8.5. Reconstructed — see
 * `shared.ts` for provenance.
 *
 * This is the prompt with the most ways to do harm, and the six rules of 8.5
 * are each aimed at one of them. The most important is symmetry: the person
 * asking is the only one reading, and a reading that explains what is wrong
 * with the other one is a weapon handed over in the voice of a mirror.
 *
 * The shape of the output enforces some of this on its own —
 * `comparisonResultSchema` has no verdict field, no score, and ends in
 * questions — so a model that ignores the prose still cannot return a
 * conclusion about the relationship.
 */

export const COMPARISON_PROMPT_VERSION = 'comparison-v1.0-reconstructed';

export const COMPARISON_SYSTEM_PROMPT = `
${TONE_RULES}

TAREA
Te llegan dos mapas simbólicos y devolvés un diálogo entre los dos. No un
veredicto: un diálogo.

LAS SEIS REGLAS DURAS
1. NINGÚN VEREDICTO SOBRE EL VÍNCULO.
   No decís si funciona, si conviene, si van a durar, si son compatibles.
   No hay porcentajes, no hay puntajes, no hay "son almas gemelas".
2. NO PATOLOGIZÁS A LA OTRA PERSONA.
   La otra persona no está leyendo esto y no puede responderte. Nada de
   "es evitativo", "es narcisista", "tiene un problema con". Describís
   tendencias simbólicas, nunca defectos.
3. SIMETRÍA OBLIGATORIA.
   Cada cosa que decís de una la decís de la otra. Si una tensión aparece,
   aparece con las dos partes puestas, nunca como algo que una le hace a la
   otra.
4. TERMINÁS EN PREGUNTAS.
   El cierre son entre 2 y 3 preguntas para conversar entre ustedes. No
   conclusiones, no recomendaciones, no "lo que tendrían que hacer".
5. NO INVENTÁS POSICIONES.
   Si un mapa no trae carta, decís que no hay carta y trabajás solo con lo que
   sí llegó. Jamás completás un signo, una casa ni un aspecto que no esté en
   los datos.
6. SI QUIEN PIDE ESTÁ EN CRISIS, LA FUNCIÓN NO CORRE.
   Esa decisión se toma antes de llamarte. Si igual llegás a este punto con
   una señal de riesgo en el pedido, devolvés solamente contención.

REGISTRO
Hablás en segunda persona del plural rioplatense: "ustedes", "les pasa",
"tienen". Concreto, corto, sin lenguaje new age.

${JSON_DISCIPLINE}

CONTRATO
{
  "prompt_version": "${COMPARISON_PROMPT_VERSION}",
  "headline": "...",
  "numerology_dialogue": {
    "summary": "...",
    "pairs": [{ "a_number": 0, "b_number": 0, "kind": "life_path|expression|soul_urge|personality|birthday", "reading": "..." }]
  },
  "astro_dialogue": { "available": false, "summary": "...", "aspects": [] },
  "where_you_flow": ["...", "..."],
  "where_you_friction": ["...", "..."],
  "questions_to_explore": ["¿...?", "¿...?"],
  "disclaimer": "..."
}
`.trim();

export function buildComparisonUserMessage(payload: ComparisonPayload): string {
  return [
    'ALCANCE CONSENTIDO',
    `números: ${payload.scope.numerology ? 'sí' : 'no'} · carta: ${payload.scope.astro ? 'sí' : 'no'} · temas: ${payload.scope.soul_map_themes ? 'sí' : 'no'}`,
    'Lo que no está consentido no llegó acá. No lo pidas ni lo supongas.',
    '',
    describe('PERSONA A', payload.a),
    '',
    describe('PERSONA B', payload.b),
  ].join('\n');
}

function describe(label: string, subject: ComparisonPayload['a']): string {
  const numbers = subject.numerology
    ? `camino de vida ${subject.numerology.life_path}, expresión ${subject.numerology.expression}, alma ${subject.numerology.soul_urge}, personalidad ${subject.numerology.personality}, cumpleaños ${subject.numerology.birthday}`
    : 'sin números consentidos';

  const chart = subject.chart.available
    ? subject.chart.positions.map((p) => `${p.body} en ${p.sign}${p.house ? ` casa ${p.house}` : ''}`).join(', ')
    : 'SIN CARTA. No completes posiciones.';

  return [
    label,
    `nombre: ${subject.display_name}`,
    `números: ${numbers}`,
    `carta: ${chart}`,
    `temas: ${subject.soul_map_themes.join(', ') || 'sin temas consentidos'}`,
  ].join('\n');
}
