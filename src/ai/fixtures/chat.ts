import { modalityBySlug } from '@/lib/catalog';
import { normalize } from '@/lib/safety';
import type { ChatResponse, SoulMapSynthesis } from '@/lib/schemas';

/**
 * Curated chat turns, so the demo answers without a key and without a network.
 *
 * The plan did not list a fixture for chat; `runAi` requires one, and a demo
 * whose conversation only works for someone holding an Anthropic key is a
 * demo that fails in the room. These are written to the same rules the prompt
 * states and are linted by the same test the model output passes.
 *
 * Selection is deterministic on what was asked and how far into the
 * conversation it is: the same question at the same turn always gives the same
 * answer, and asking twice in a row does not repeat verbatim.
 *
 * Crisis is never produced here. Layer 1 runs in front of the model in
 * `Chat.tsx`, so a crisis turn never reaches this file — which is the point of
 * doing safety deterministically rather than asking a model to notice.
 */

export type ChatIntent = 'clarify' | 'recommend' | 'reflect';

/** Asking for a next step rather than for a reading. */
const ASKING_FOR_A_PATH =
  /\b(que hago|que puedo hacer|por donde (empiezo|arranco)|me sirve|sirve|recomend|terapia|deberia probar|cual elijo|con quien)\b/;

/** Too little to say anything with. Length alone is a poor test — "¿por qué
 *  siempre elijo lo mismo?" is short and perfectly answerable — so it is a
 *  floor on words rather than characters. */
function tooThinToAnswer(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length < 4;
}

export function detectIntent(question: string): ChatIntent {
  const normalized = normalize(question);
  if (tooThinToAnswer(question)) return 'clarify';
  if (ASKING_FOR_A_PATH.test(normalized)) return 'recommend';
  return 'reflect';
}

const REFLECTIONS = [
  'Lo que traés vuelve sobre lo mismo que aparece en tu mapa: el registro del otro llega antes que el propio. Nombrarlo no lo desarma, pero cambia el lugar desde donde lo mirás. Suele ayudar más ubicar el momento exacto en que la atención se te va hacia el otro que entender la escena entera. ¿Qué había pasado justo antes, la última vez?',
  'Eso que contás tiene la forma de algo viejo con ropa nueva. No es que no lo entiendas: lo entendés mientras está pasando y aun así sigue, que es una experiencia distinta y bastante más cansadora. Ese punto, entender sin poder frenar, es de los que piden alguien enfrente y no una explicación mejor.',
  'Hay una diferencia entre estar cansada de hacer y estar cansada de sostener. Por cómo lo escribís, se parece más a lo segundo, y tu mapa venía insistiendo en eso mismo desde otro lado. Lo que se sostiene mucho tiempo rara vez se suelta de una decisión; se suelta de a poco y con testigos.',
  'Fijate que en lo que escribiste no aparece nada sobre vos, salvo como reacción a otro. Eso puede ser el recorte de un mensaje corto, o puede ser el patrón. Vale la pena mirar cuál de las dos cosas es antes de sacar conclusiones.',
];

const CLARIFYING = [
  'Con eso solo no llego a decirte algo que sirva de verdad. ¿Podés contarme una situación concreta de la última semana donde te haya pasado?',
  'Me falta el borde de la escena para no inventarte una lectura. ¿Con quién estabas y qué se dijo justo antes?',
  'Puedo devolverte algo genérico o puedo esperar a entender. Prefiero lo segundo: ¿qué fue lo primero que notaste en el cuerpo cuando pasó?',
];

/**
 * Assembled from the catalogue rather than written by hand, so a
 * recommendation cannot describe a session that does not happen.
 */
function recommendationFor(slugs: readonly string[]): ChatResponse {
  const modality = slugs.map((slug) => modalityBySlug(slug)).find(Boolean);

  if (!modality) {
    return {
      type: 'reflection',
      message_text:
        'Todavía no tengo tus caminos sugeridos a mano, así que cualquier nombre que te tire ahora sería un nombre suelto. Si generás tus terapias sugeridas, lo que hablemos acá puede apoyarse en eso. Mientras tanto, seguí contándome.',
      linked_modality_slugs: [],
    };
  }

  const first = modality.what_happens.split(/(?<=\.)\s+/)[0] ?? modality.what_happens;

  return {
    type: 'recommendation',
    message_text: `De lo que ya te apareció, ${modality.name_es.toLowerCase()} es la que más tiene que ver con esto que estás preguntando. ${first} No es la respuesta a lo que traés: es un lugar donde eso se puede trabajar con alguien, que es distinto. ¿Querés que mire con vos qué más quedó en tu lista?`,
    linked_modality_slugs: [modality.slug],
  };
}

export function buildChatFixture(input: {
  question: string;
  synthesis: SoulMapSynthesis;
  recommendedSlugs: readonly string[];
  turnIndex: number;
}): ChatResponse {
  const intent = detectIntent(input.question);

  if (intent === 'recommend') return recommendationFor(input.recommendedSlugs);

  const pool = intent === 'clarify' ? CLARIFYING : REFLECTIONS;
  const text = pool[input.turnIndex % pool.length] ?? pool[0];

  return {
    type: intent === 'clarify' ? 'clarifying_question' : 'reflection',
    message_text: text ?? '',
    linked_modality_slugs: [],
  };
}
