import { JSON_DISCIPLINE, TONE_RULES } from './shared.ts';
import type { FilterOutcome } from '@/lib/matching';
import type { SoulMapSynthesis } from '@/lib/schemas';

/**
 * Ranking therapy modalities. PDR 7.3 and 7.4. Reconstructed — see
 * `shared.ts` for provenance.
 *
 * This prompt is where the August scope change lives. The vault ranked
 * people, using five dimensions of therapeutic alliance; those dimensions are
 * defined for a person and do not transfer to a technique. PDR 7.3 replaces
 * them with four dimensions of fit between modality and person, in an
 * explicit priority order rather than a weighted sum — the PDR is direct that
 * a model does not do the arithmetic of weights well, so it is told to order,
 * not to score.
 *
 * PDR 0.2 also asks for a change of register. Recommending a technique cannot
 * claim what recommending a person claimed: not "this person will connect
 * with you" but "this modality works on what you are describing, and here is
 * what it feels like".
 */

export const MATCH_PROMPT_VERSION = 'match-v1.0-reconstructed';

export const MATCH_SYSTEM_PROMPT = `
${TONE_RULES}

TAREA
Recibís la síntesis del mapa de una persona y un catálogo acotado de
modalidades candidatas. Ordenás entre 3 y 5, y escribís por qué cada una tiene
que ver con lo que esa persona contó. Después proponés entre 3 y 5 prácticas
de rutina.

LAS CUATRO DIMENSIONES, EN ESTE ORDEN DE PRIORIDAD
No las promedies ni les pongas pesos. Es un orden, no una cuenta.

1. AJUSTE AL TEMA
   Lo que la persona describe contra works_well_for y what_happens.
   Es la dimensión que más manda.

2. AJUSTE A LA APERTURA Y AL ESTILO
   Su apertura declarada y el registro de su lenguaje contra family e
   intensity. Alguien que escribe concreto y racional probablemente no arranca
   por constelaciones, aunque el tema encaje.

3. AJUSTE AL MOMENTO Y AL HORIZONTE
   La fase detectada contra typical_horizon y typical_format.
   En "pregunta": modalidades exploratorias, no directivas.
   En "integracion": horizontes cortos y prácticas autónomas.

4. RESONANCIA SIMBÓLICA
   Numerología y carta contra el lenguaje de la modalidad.
   Es desempate, nunca criterio de selección. Si los datos son pobres — texto
   genérico, sin carta — bajá su peso a cero y apoyate en 1 y 2.

REGLAS DURAS
- Solo podés devolver slugs de la lista provista. No inventes modalidades ni
  slugs, aunque se te ocurra una que encajaría mejor.
- Ninguna modalidad es "la correcta" ni "la ideal". Son caminos posibles.
- Si una modalidad tiene requires_clinical_support y igual la incluís, el
  caution_note es obligatorio y concreto.
- Nunca porcentajes, nunca scores, nunca "98% de compatibilidad".

EL REASONING
- Entre 2 y 4 oraciones. Ni más ni menos.
- Conectá específico con específico: algo textual que la persona dijo contra
  algo concreto que pasa en esa modalidad.
  Ejemplo del tono: "Mencionás que el enojo se te queda en el cuerpo; la
  terapia somática trabaja exactamente ahí, con atención a la sensación física
  antes que al relato."
- Lenguaje de posibilidad: "puede dialogar con", "suele acompañar procesos
  parecidos", "resuena con lo que contás".
- Decí qué pasa realmente en una sesión. La gente no sabe qué es EMDR ni
  constelaciones. Sin eso la recomendación no sirve para nada.

LA RUTINA
Cada práctica: una señal concreta (qué), una razón conectada al mapa (por qué)
y una micro-invitación en pregunta (¿lo probás?).
Nada abstracto. "Diez minutos de respiración 4-7-8 antes de dormir", no
"explorá el silencio".

CONTRATO
{
  "prompt_version": "${MATCH_PROMPT_VERSION}",
  "matched_modalities": [
    { "modality_slug": "...", "rank": 1, "reasoning": "...", "caution_note": null }
  ],
  "routine": [
    { "title": "...", "body": "...", "invitation": "¿...?", "cadence": "daily|weekly|process|one_off" }
  ]
}

${JSON_DISCIPLINE}
`.trim();

export function buildMatchUserMessage(input: {
  synthesis: SoulMapSynthesis;
  outcome: FilterOutcome;
  presentingNeedText: string;
}): string {
  const catalogue = input.outcome.candidates
    .map((m) =>
      [
        `slug: ${m.slug}`,
        `nombre: ${m.name_es}`,
        `familia: ${m.family}`,
        `qué pasa en una sesión: ${m.what_happens}`,
        `sirve para: ${m.works_well_for.join(', ')}`,
        `formato: ${m.typical_format} · horizonte: ${m.typical_horizon} · intensidad: ${m.intensity}/5`,
        `nivel de evidencia: ${m.evidence_level}`,
        m.requires_clinical_support ? 'REQUIERE ACOMPAÑAMIENTO CLÍNICO' : '',
        m.contraindications.length ? `contraindicaciones: ${m.contraindications.join(' ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n---\n');

  return [
    'LA PERSONA',
    `Fase detectada: ${input.synthesis.detected_phase} · modo: ${input.synthesis.detected_mode}`,
    `Lo que se está preguntando, en sus palabras: ${input.presentingNeedText || '(no escribió texto libre)'}`,
    '',
    'SÍNTESIS VIGENTE',
    input.synthesis.soul_map_synthesis.tu_camino,
    input.synthesis.soul_map_synthesis.lo_que_estas_trabajando,
    input.synthesis.soul_map_synthesis.que_necesitas_ahora,
    '',
    `TEMAS INFERIDOS: ${input.synthesis.inferred_topics.join(', ') || 'ninguno'}`,
    '',
    // Telling the model how the pool was reached matters: a relaxed or
    // fallback pool should not be presented with the confidence of a
    // topically matched one.
    `CÓMO SE ARMÓ ESTE POOL: ${describeStrategy(input.outcome)}`,
    '',
    'MODALIDADES CANDIDATAS (solo podés elegir de acá)',
    catalogue,
  ].join('\n');
}

function describeStrategy(outcome: FilterOutcome): string {
  switch (outcome.strategy) {
    case 'topical':
      return 'filtrado por temas en común. Podés hablar con confianza normal.';
    case 'relaxed':
      return 'ningún tema coincidió, así que se amplió. Sé más prudente: no afirmes que encaja con un tema puntual.';
    case 'contemplative-fallback':
      return 'no quedó nada tras los filtros. Son prácticas de punto de partida. Decilo con honestidad en el reasoning.';
  }
}
