import { JSON_DISCIPLINE, TONE_RULES } from './shared.ts';
import { BREAK_MAX_MS, BREAK_MIN_MS, RATE_MAX, RATE_MIN } from '@/audio/ssml';
import type { BedTrack, SoulMapSynthesis } from '@/lib/schemas';

/**
 * Guided meditations. PDR sections 9.4 and 9.5. Reconstructed — see
 * `shared.ts` for provenance.
 *
 * The four-part structure is the part of 9.4 that carries the practice:
 * arrival, deepening, the work on the intention, and a return that actually
 * returns the person to the room. A script that ends inside the imagery leaves
 * someone standing up from a floor they were told they were lying on.
 *
 * The prosody band and the break lengths are stated here in the prompt and
 * enforced in `audio/ssml.ts`, over the model's output and over the fixtures
 * alike — the same arrangement as the copy lint, for the same reason.
 */

export const MEDITATION_PROMPT_VERSION = 'meditation-v1.0-reconstructed';

export const MEDITATION_SYSTEM_PROMPT = `
${TONE_RULES}

TAREA
Escribís una meditación guiada a partir de la intención que trae una persona y
de lo que ya sabés de su mapa. La voz la lee un sintetizador, así que escribís
para ser escuchada, no leída.

LA ESTRUCTURA, EN CUATRO PARTES
1. LLEGADA
   Llegar al lugar donde está. Postura, peso, apoyo. Sin pedir que cierre los
   ojos de entrada si no dijo dónde está.
2. PROFUNDIZACIÓN
   Respiración y cuerpo. Exhalación más larga que la inhalación. Silencios de
   verdad entre las indicaciones.
3. NÚCLEO
   Acá trabaja la intención que trajo, con imágenes concretas y sensoriales.
   Nada de afirmaciones para repetir. Nada de "soltá el pasado".
4. CIERRE
   Devolver a la persona a la habitación: sonidos alrededor, manos, un
   movimiento chico. La meditación termina afuera, no adentro de la imagen.

SSML
Devolvés el guion dos veces: en texto plano y marcado.
- Envolvés todo en <speak>.
- <prosody rate="X%"> con X entre ${RATE_MIN * 100} y ${RATE_MAX * 100}. Nunca fuera de ese rango.
- <break time="Ns"/> entre indicaciones, con N entre ${BREAK_MIN_MS / 1000} y ${BREAK_MAX_MS / 1000} segundos.
  Los silencios son la práctica: sin ellos esto es un texto leído en voz alta.
- Nada de <audio>, <mark>, <say-as> ni voces alternadas.
- script_text es exactamente lo que se dice, sin etiquetas.

REGLAS DURAS
- Sin binaurales, sin frecuencias "que sanan", sin promesas sobre el cuerpo.
- Sin cuenta regresiva hipnótica ni sugestión de sueño profundo.
- Sin indicaciones que no se puedan seguir sentada en un colectivo, salvo que
  la intención diga explícitamente que está en su cama.
- Nunca das una orden. Las indicaciones son invitaciones: "si te sirve,
  probá...", "podés dejar que...".
- Elegís un bed_track_id de la lista provista y de ninguna otra.

${JSON_DISCIPLINE}

CONTRATO
{
  "title": "...",
  "script_text": "...",
  "script_ssml": "<speak>...</speak>",
  "bed_track_id": "..."
}
`.trim();

export function buildMeditationUserMessage(input: {
  intent: string;
  minutes: number;
  synthesis: SoulMapSynthesis | null;
  risk: 'none' | 'elevated' | 'high';
  beds: readonly BedTrack[];
}): string {
  return [
    `INTENCIÓN, EN SUS PALABRAS: ${input.intent}`,
    `DURACIÓN PEDIDA: ${input.minutes} minutos`,
    // PDR 10.2 again: the derived level, never the clinical answers.
    `NIVEL DE RIESGO DERIVADO: ${input.risk}`,
    input.risk === 'none'
      ? ''
      : 'En este nivel: nada regresivo, nada de revivir escenas, y el núcleo trabaja sobre el presente y el cuerpo.',
    '',
    'SU MAPA',
    input.synthesis
      ? [
          input.synthesis.soul_map_synthesis.tu_camino,
          input.synthesis.soul_map_synthesis.que_necesitas_ahora,
          `Temas: ${input.synthesis.inferred_topics.join(', ') || 'ninguno'}`,
        ].join('\n')
      : '(todavía no generó su mapa)',
    '',
    'CAMAS SONORAS DISPONIBLES (solo podés elegir de acá)',
    input.beds.map((bed) => `${bed.id} — ${bed.name}. ${bed.suits}`).join('\n'),
  ]
    .filter((line) => line !== '')
    .join('\n');
}
