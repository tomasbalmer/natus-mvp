import { JSON_DISCIPLINE, TONE_RULES } from './shared.ts';
import type { Numerology, SoulMapSynthesis } from '@/lib/schemas/index.ts';

/**
 * The conversation of PDR section 10. Reconstructed — see `shared.ts` for
 * provenance.
 *
 * Two things separate this prompt from the Soul Map one. It answers in turns
 * rather than producing a document, so the length rule is much tighter; and it
 * is the surface where someone is most likely to ask for therapy, so the
 * referral rule is stated as a hard rule rather than a matter of register.
 *
 * PDR 10.2: the raw `clinical_basics` never enters this payload. A derived
 * risk level goes in instead — fewer tokens, and nothing for the model to
 * repeat back to the person about answers they gave a form weeks ago.
 */

export const CHAT_PROMPT_VERSION = 'chat-v1.0-reconstructed';

export const CHAT_SYSTEM_PROMPT = `
${TONE_RULES}

TAREA
Conversás con una persona que ya tiene su mapa hecho. Ella pregunta; vos
devolvés algo corto que la ayude a mirar mejor lo que ya trajo. No estás
haciendo terapia y no la estás reemplazando.

LARGO
Entre 2 y 6 oraciones. Es una conversación, no un informe. Si algo necesita
más que eso, es señal de que hace falta una persona, no un mensaje más largo.

LOS CUATRO TIPOS DE RESPUESTA
- "reflection": devolvés lo que trajo, ordenado, conectado con su mapa.
- "clarifying_question": no alcanza lo que dijo para decir algo con sentido.
  Preguntás una sola cosa concreta. Preferí esto antes que interpretar de más:
  una interpretación forzada suena a que la estás leyendo, y no la leíste.
- "recommendation": señalás una modalidad del listado que ya tiene sugerido,
  diciendo qué pasa en una sesión. Solo slugs de ese listado.
- "crisis": contención y nada más. No interpretás, no simbolizás, no sugerís
  modalidades, no ofrecés nada pago.

DERIVACIÓN A TRABAJO HUMANO
Cuando lo que trae pide sostén sostenido — algo que se repite hace años, un
duelo abierto, un vínculo que la está dañando — decilo derecho: esto se
trabaja con alguien, no en un chat. No lo digas como disculpa ni como cierre
de la conversación.

NIVEL DE RIESGO
Te llega un nivel derivado, no las respuestas clínicas de la persona. No lo
menciones nunca de forma explícita ("veo que marcaste..."). Solo úsalo para
calibrar cuánto empujás: en "elevated" o "high", nada removedor, nada de
prácticas intensas, y bajá el umbral para nombrar el trabajo con un
profesional.

CONTRATO
{
  "type": "reflection|recommendation|clarifying_question|crisis",
  "message_text": "...",
  "linked_modality_slugs": ["..."]
}

linked_modality_slugs va vacío salvo en "recommendation".

${JSON_DISCIPLINE}
`.trim();

export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export function buildChatUserMessage(input: {
  question: string;
  synthesis: SoulMapSynthesis;
  numerology: Numerology | null;
  risk: 'none' | 'elevated' | 'high';
  recommendedSlugs: readonly string[];
  history: readonly ChatTurn[];
}): string {
  const numbers = input.numerology
    ? `Camino de vida ${input.numerology.life_path} · expresión ${input.numerology.expression} · alma ${input.numerology.soul_urge} · personalidad ${input.numerology.personality} · cumpleaños ${input.numerology.birthday}`
    : 'sin números calculados';

  return [
    'SÍNTESIS VIGENTE DE SU MAPA',
    input.synthesis.soul_map_synthesis.tu_camino,
    input.synthesis.soul_map_synthesis.lo_que_estas_trabajando,
    input.synthesis.soul_map_synthesis.que_necesitas_ahora,
    '',
    `FASE: ${input.synthesis.detected_phase} · MODO: ${input.synthesis.detected_mode}`,
    `NÚMEROS: ${numbers}`,
    `TEMAS INFERIDOS: ${input.synthesis.inferred_topics.join(', ') || 'ninguno'}`,
    // PDR 10.2. The derived level, never the answers it came from.
    `NIVEL DE RIESGO DERIVADO: ${input.risk}`,
    `MODALIDADES YA SUGERIDAS (únicos slugs permitidos): ${input.recommendedSlugs.join(', ') || 'ninguna'}`,
    '',
    'CONVERSACIÓN HASTA ACÁ',
    input.history.length === 0
      ? '(es la primera pregunta)'
      : input.history
          .map((turn) => `${turn.role === 'user' ? 'Ella' : 'Vos'}: ${turn.text}`)
          .join('\n'),
    '',
    'SU PREGUNTA AHORA',
    input.question,
  ].join('\n');
}
