import { COMPARISON_PROMPT_VERSION } from '../prompts/comparison';
import { topicName } from '@/lib/catalog';
import type { ComparisonPayload } from '@/lib/comparison-payload';
import type { ComparisonResult } from '@/lib/schemas';

/**
 * A curated comparison, assembled from the payload.
 *
 * Everything here is written to the six rules of PDR 8.5, and the two that are
 * easiest to break by accident are the two this file is built around.
 *
 * Symmetry: every reading names both people or neither. The sentences are
 * generated from the pair, not from one number, so there is no place for a
 * sentence about what one of them does to the other.
 *
 * Never inventing positions: the astro section reads only what the payload
 * carries. The chart PDF is never parsed in this demo, so in practice it
 * always reports that there is no chart — and saying so is the honest output,
 * not a degraded one.
 */

const KINDS = ['life_path', 'expression', 'soul_urge', 'personality', 'birthday'] as const;
type Kind = (typeof KINDS)[number];

const KIND_SUBJECT: Record<Kind, string> = {
  life_path: 'el camino que cada una viene caminando',
  expression: 'la forma en que cada una se muestra',
  soul_urge: 'lo que cada una busca por debajo',
  personality: 'lo primero que la otra ve',
  birthday: 'el gesto con el que cada una se maneja',
};

const MASTERS = new Set([11, 22, 33]);

function reading(kind: Kind, a: number, b: number): string {
  const subject = KIND_SUBJECT[kind];

  if (a === b) {
    return `Coinciden en ${subject}: los dos traen ${a}. Lo compartido suele ser cómodo y también difícil de ver, porque nadie hace de espejo de lo que los dos dan por sentado.`;
  }

  if (MASTERS.has(a) !== MASTERS.has(b)) {
    const [master, plain] = MASTERS.has(a) ? [a, b] : [b, a];
    return `En ${subject} aparece un ${master} de un lado y un ${plain} del otro. La tradición lee los maestros como una intensidad que pide más; puesto al lado de un ${plain}, suele producir dos ritmos distintos frente a la misma situación.`;
  }

  const distance = Math.abs(a - b);
  if (distance <= 2) {
    return `En ${subject} hay ${a} y ${b}, que están cerca. Se parecen lo suficiente como para entenderse rápido y como para repetir los dos el mismo punto ciego.`;
  }

  return `En ${subject} hay ${a} de un lado y ${b} del otro. Son lenguajes distintos: lo que a una le resulta obvio, a la otra le lleva un paso más, y al revés también.`;
}

function themeOverlap(payload: ComparisonPayload): { shared: string[]; onlyOne: string[] } {
  const a = new Set(payload.a.soul_map_themes);
  const b = new Set(payload.b.soul_map_themes);
  return {
    shared: [...a].filter((topic) => b.has(topic)),
    onlyOne: [...new Set([...a, ...b])].filter((topic) => a.has(topic) !== b.has(topic)),
  };
}

export function buildComparisonFixture(payload: ComparisonPayload): ComparisonResult {
  const { a, b } = payload;
  const themes = themeOverlap(payload);

  const pairs =
    a.numerology && b.numerology
      ? KINDS.map((kind) => ({
          a_number: a.numerology![kind],
          b_number: b.numerology![kind],
          kind,
          reading: reading(kind, a.numerology![kind], b.numerology![kind]),
        }))
      : [];

  const matches = pairs.filter((pair) => pair.a_number === pair.b_number).length;

  const flow: string[] = [];
  const friction: string[] = [];

  if (pairs.length > 0) {
    flow.push(
      matches > 0
        ? `Comparten ${matches} de los cinco números, y eso suele mostrarse como entenderse sin explicar demasiado.`
        : 'No comparten ninguno de los cinco números, lo que suele traducirse en que cada una aporta algo que a la otra no se le habría ocurrido.',
    );
    friction.push(
      matches >= 3
        ? 'Tanto parecido tiene su costo: cuando algo se les escapa, se les escapa a las dos al mismo tiempo.'
        : 'Los ritmos distintos se notan más en los días apurados, donde cada una resuelve como sabe y la otra lo lee como desinterés.',
    );
  }

  if (themes.shared.length > 0) {
    flow.push(
      `Las dos están mirando ${themes.shared.map(topicName).join(' y ')}. Tener el mismo tema abierto hace que las conversaciones lleguen rápido a algo real.`,
    );
    friction.push(
      `El mismo tema abierto en las dos también significa que ninguna llega descansada a ese lugar cuando la otra lo necesita.`,
    );
  }

  if (themes.onlyOne.length > 0) {
    flow.push(
      `Hay temas que aparecen en una de las dos y no en la otra —${themes.onlyOne.map(topicName).join(', ')}—, y eso da lugar a que una sostenga mientras la otra atraviesa.`,
    );
  }

  // The contract asks for at least two on each side, and a comparison that
  // finds only smooth things is a comparison that is not looking. The filler
  // is about the reading itself rather than about them, which is the honest
  // thing to say when the scope left almost nothing to read.
  const FLOW_FILLER = [
    'Lo que ustedes dejaron entrar acá alcanza para un primer cruce y no para mucho más, lo que ya dice algo: hay bastante que todavía no se contaron.',
    'Que ninguna de las dos haya abierto demasiado también es un punto de partida parejo.',
  ];
  const FRICTION_FILLER = [
    'Con este alcance queda afuera casi todo lo que suele rozar entre dos personas, así que lo que no aparece acá no es lo que no existe entre ustedes.',
    'Leer tan poco de las dos deja lugar a que cada una complete el resto por su cuenta, que es justo donde se arman los malentendidos.',
  ];

  for (const line of FLOW_FILLER) if (flow.length < 2) flow.push(line);
  for (const line of FRICTION_FILLER) if (friction.length < 2) friction.push(line);

  return {
    prompt_version: COMPARISON_PROMPT_VERSION,
    headline: `${a.display_name} y ${b.display_name}, puestos uno al lado del otro`,
    numerology_dialogue: {
      summary:
        pairs.length > 0
          ? 'Los números no dicen qué va a pasar entre ustedes. Puestos en paralelo muestran dónde se parecen y dónde no, que es material para hablar, no un resultado.'
          : 'No hubo números consentidos en este cruce, así que esta parte queda vacía a propósito.',
      pairs,
    },
    astro_dialogue: {
      available: a.chart.available && b.chart.available,
      summary:
        a.chart.available && b.chart.available
          ? 'Las posiciones que llegaron se leen abajo. Lo que no llegó no está completado.'
          : 'No hay carta cargada de al menos una de las dos partes, así que esta sección queda sin contenido. Nada acá se completa por aproximación.',
      aspects: [],
    },
    where_you_flow: flow.slice(0, 4),
    where_you_friction: friction.slice(0, 4),
    questions_to_explore: [
      '¿En qué momento de la semana pasada se sintieron más lejos, y qué estaba pasando?',
      '¿Qué es lo que cada una da por sentado que la otra ya sabe?',
      '¿Qué de esto que leyeron les suena, y qué no les suena para nada?',
    ],
    disclaimer:
      'Esto es un lenguaje simbólico para conversar entre ustedes, no una medición del vínculo ni una opinión sobre si les conviene. Lo que decidan hablar después es de ustedes.',
  };
}
