import { JSON_DISCIPLINE, TONE_RULES } from './shared';
import type { Numerology } from '@/lib/schemas';
import type { OnboardingDraft } from '@/store/session';

/**
 * The Soul Map prompt. PDR 6.5.
 *
 * Reconstructed — see `shared.ts` for provenance. The version string says so.
 *
 * One deliberate difference from the vault contract: `matched_facilitators`
 * is gone. PDR 6.5 removes it because matching is a separate call with its
 * own prompt, which lets therapies be re-ranked without regenerating the
 * narrative and keeps the eval set clean.
 */

export const SOUL_MAP_PROMPT_VERSION = 'soul-map-v2.0-reconstructed';

export const SOUL_MAP_SYSTEM_PROMPT = `
${TONE_RULES}

TAREA
Recibís cuatro bloques sobre una persona: datos básicos, numerología ya
calculada, carta natal (si la hay) y contexto vital. Devolvés una síntesis
narrativa en tres secciones, entre tres y cinco invitaciones concretas, y los
temas que inferís de lo que contó.

LAS TRES SECCIONES
- tu_camino: 3 a 5 oraciones. Lo que se repite, lo que la trajo hasta acá.
  Se apoya en la numerología y la carta como lenguaje, no como prueba.
- lo_que_estas_trabajando: 3 a 5 oraciones. La tensión viva ahora mismo,
  dicha con las palabras que usó la persona, no con las tuyas.
- que_necesitas_ahora: 2 a 4 oraciones. Qué pide este momento. Nunca una
  indicación clínica.

LAS INVITACIONES (tips)
Cada una tiene: title corto, body que explica por qué esta práctica y no otra
para ESTE mapa, e invitation que cierra en pregunta. Nada abstracto: una
señal concreta, una razón conectada al mapa, una micro-invitación.
La cadence es daily, weekly, process u one_off.

FASE Y MODO
detected_phase: "pregunta" si todavía está formulando qué le pasa,
"exploracion" si ya sabe y está buscando cómo, "integracion" si viene de un
proceso y está asentando. Sin tildes.
detected_mode: "objetivo" si trae una meta concreta, "exploracion" si viene
abierta.

TEMAS INFERIDOS
inferred_topics: slugs del catálogo que reconocés en lo que contó. Solo de
esta lista, sin inventar: ansiedad, depresion, duelo, pareja, sexualidad,
familia, trauma, autoestima, proposito, transiciones, espiritualidad,
adicciones, alimentacion, desarrollo-profesional, identidad.

CONTRATO NORMAL
{
  "detected_phase": "pregunta | exploracion | integracion",
  "detected_mode": "objetivo | exploracion",
  "soul_map_synthesis": {
    "tu_camino": "...",
    "lo_que_estas_trabajando": "...",
    "que_necesitas_ahora": "..."
  },
  "tips": [ { "title": "...", "body": "...", "invitation": "¿...?", "cadence": "daily|weekly|process|one_off" } ],
  "follow_up_invitation": "...",
  "inferred_topics": ["..."]
}

CONTRATO DE CRISIS
Si detectás riesgo, devolvés SOLO esto. Sin tips, sin síntesis, sin
interpretación simbólica de ningún tipo:
{
  "detected_phase": "crisis",
  "crisis_response": "2 a 4 oraciones de contención. No minimiza, no aconseja, no interpreta.",
  "crisis_resources": [],
  "follow_up_invitation": "..."
}

${JSON_DISCIPLINE}
`.trim();

/** PDR 6.5 pipeline step 4: the four-block payload. */
export function buildSoulMapUserMessage(input: {
  draft: OnboardingDraft;
  numerology: Numerology | null;
}): string {
  const { draft, numerology } = input;

  const blocks: string[] = [];

  blocks.push(
    ['DATOS BÁSICOS', `Nombre de nacimiento: ${draft.legal_birth_name}`, `Fecha: ${draft.birth_date}`]
      .concat(draft.birth_time ? [`Hora: ${draft.birth_time}`] : [])
      .concat(draft.birth_city ? [`Ciudad: ${draft.birth_city}`] : [])
      .concat([`País de residencia: ${draft.country}`])
      .join('\n'),
  );

  blocks.push(
    numerology
      ? [
          'NUMEROLOGÍA (ya calculada, tratala como dada)',
          `Camino de vida: ${numerology.life_path}`,
          `Expresión: ${numerology.expression}`,
          `Alma: ${numerology.soul_urge}`,
          `Personalidad: ${numerology.personality}`,
          `Cumpleaños: ${numerology.birthday}`,
          numerology.master_numbers_present.length > 0
            ? `Números maestros presentes: ${numerology.master_numbers_present.join(', ')}`
            : 'Sin números maestros.',
        ].join('\n')
      : 'NUMEROLOGÍA\nNo disponible para este nombre.',
  );

  // PDR 6.3: an unreadable or absent chart never blocks. The prompt is told
  // plainly that it is missing, and told not to invent positions — the same
  // instruction that keeps the comparison prompt honest.
  blocks.push(
    draft.natal_chart && draft.natal_chart.parse_status === 'parsed'
      ? [
          'CARTA NATAL (calculada por Astrologer; tratala como datos simbólicos, no como prueba)',
          draft.natal_chart.context,
        ].join('\n')
      : [
          'CARTA NATAL',
          'No hay carta disponible. Trabajá con la numerología y el contexto.',
          'No menciones Ascendente, casas ni posiciones. No inventes ninguna.',
        ].join('\n'),
  );

  const needs = draft.presenting_need_slugs.length
    ? `Eligió también: ${draft.presenting_need_slugs.join(', ')}`
    : '';

  blocks.push(
    [
      'CONTEXTO VITAL',
      `Lo que se está preguntando: ${draft.presenting_need_text || '(no escribió texto libre)'}`,
      needs,
      `Apertura a tipos de trabajo: ${draft.openness_to_modalities.join(', ') || 'sin preferencia'}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  // clinical_basics is deliberately NOT included verbatim. PDR 10.2 applies
  // the same reasoning to chat: the model gets a derived risk level, never the
  // raw clinical answers. Fewer tokens, and less surface for it to leak back.
  return blocks.join('\n\n');
}
