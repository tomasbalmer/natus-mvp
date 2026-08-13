import { describe, expect, it } from 'vitest';
import { countSentences, isInvitation, lintCopy, lintDeep } from './copy-lint.ts';

const rulesFor = (text: string) => lintCopy(text).map((v) => v.rule);

describe("the PDR's own anti-patterns must fail", () => {
  it('rejects the order form of a tip', () => {
    // PDR 7.5 lists this verbatim as an anti-pattern.
    expect(rulesFor('Debes meditar 10 minutos al día')).toContain('command');
  });

  it('rejects declaring a modality the right one', () => {
    expect(rulesFor('Esta es la terapia ideal para vos')).toContain('certainty');
  });

  it('rejects promising a result', () => {
    expect(rulesFor('Esto va a resolver tu problema')).toContain('cure');
    expect(rulesFor('Esto te va a curar')).toContain('cure');
  });

  it('rejects a percentage score', () => {
    // The mockup's "98% match".
    expect(rulesFor('98% match con este facilitador')).toContain('percentage');
  });

  it('rejects the chart as prediction', () => {
    // PDR 1.3: "tu carta sugiere", never "tu carta dice que".
    expect(rulesFor('Tu carta dice que vas a cambiar de trabajo')).toContain(
      'chart-determinism',
    );
  });

  it('rejects a diagnosis', () => {
    expect(rulesFor('Tenés un trastorno de ansiedad generalizada')).toContain('diagnosis');
  });

  it('rejects the AI claiming a feeling', () => {
    expect(rulesFor('Me emociona mucho lo que contás')).toContain('first-person-emotion');
  });
});

describe('the PDR\'s own model examples must pass', () => {
  const good = [
    // Quoted verbatim from PDR 7.5 as the example to imitate.
    'Tu carta y lo que contás resuenan con prácticas de regulación nerviosa nocturna. ¿Te hace sentido probar 10 minutos de respiración 4-7-8 antes de dormir esta semana? Observá qué se mueve.',
    'Mencionás que el enojo se te queda en el cuerpo; la terapia somática trabaja exactamente ahí, con atención a la sensación física antes que al relato.',
    'Esta modalidad suele acompañar procesos parecidos al que estás describiendo.',
    'Tu carta sugiere una tensión entre lo que mostrás y lo que necesitás.',
  ];

  it.each(good)('passes: %s', (text) => {
    expect(lintCopy(text)).toEqual([]);
  });
});

describe('ordinary copy is not caught by accident', () => {
  const innocuous = [
    'Contame un poco más sobre eso.',
    'Hay algo que se repite y todavía no tiene nombre.',
    'La terapia gestalt trabaja con lo que aparece en la sesión.',
    'Podés dejar de venir cuando quieras.',
    // "deb" appears inside "debilidad" but is not the imperative.
    'Nombrar una debilidad no es lo mismo que tener un problema.',
  ];

  it.each(innocuous)('passes: %s', (text) => {
    expect(lintCopy(text)).toEqual([]);
  });
});

describe('linting a whole payload', () => {
  it('reports the path of each violation', () => {
    const payload = {
      synthesis: { tu_camino: 'Todo bien acá.' },
      tips: [
        { title: 'Respirar', body: 'Debes hacerlo cada día.' },
        { title: 'Caminar', body: 'Una caminata sin teléfono.' },
      ],
    };
    const found = lintDeep(payload);
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toBe('$.tips[0].body');
    expect(found[0]?.rule).toBe('command');
  });

  it('returns nothing for a clean payload', () => {
    expect(lintDeep({ a: 'Todo bien.', b: ['También bien.'] })).toEqual([]);
  });
});

describe('markup is not copy', () => {
  it('does not read an SSML speech rate as a promised percentage', () => {
    // This is not hypothetical: every meditation carries a prosody rate, and
    // linting the tag failed all of them — in the fixtures and in `runAi`
    // alike, so a live generation would have been rejected as well.
    expect(lintCopy('<prosody rate="82%">Quedate como estés.</prosody>')).toEqual([]);
  });

  it('still lints the words inside the tags', () => {
    expect(lintCopy('<speak>Debés meditar diez minutos.</speak>').map((v) => v.rule)).toEqual([
      'command',
    ]);
  });

  it('still catches a percentage that is actually said to the person', () => {
    expect(lintCopy('<speak>Tenés 98% de compatibilidad.</speak>').map((v) => v.rule)).toContain(
      'percentage',
    );
  });
});

describe('shape requirements', () => {
  it('recognises an invitation by its question mark', () => {
    expect(isInvitation('¿La sumás como experimento esta semana?')).toBe(true);
    expect(isInvitation('Sumala esta semana.')).toBe(false);
  });

  it('counts sentences for the two-to-four rule', () => {
    expect(countSentences('Una. Dos. Tres.')).toBe(3);
    expect(countSentences('¿Una? ¡Dos!')).toBe(2);
    expect(countSentences('Sin puntuación final')).toBe(1);
  });
});
