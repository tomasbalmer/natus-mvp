import { describe, expect, it } from 'vitest';
import {
  detectCrisis,
  isClinicallyVulnerable,
  normalize,
  riskLevel,
  scanText,
  shouldNotifyAdmin,
  CRISIS_NOTIFICATION_WINDOW_MS,
} from './safety';

/**
 * PDR 13 asks for 20 synthetic cases. The ones that matter most are the
 * negatives: a detector that never misses but locks out everyone who writes
 * "ya no aguanto este trabajo" has failed at the product level, and the
 * PDR says so directly.
 */

describe('normalisation', () => {
  it('strips diacritics and case', () => {
    expect(normalize('  QUIERO   MORÍRME ')).toBe('quiero morirme');
  });

  it('leaves the enye readable as n', () => {
    expect(normalize('hacerme daño')).toBe('hacerme dano');
  });
});

describe('high severity — direct terms', () => {
  const cases: [string, string][] = [
    ['ideation, plain', 'a veces pienso que quiero morirme y no se que hacer'],
    ['ideation, with accents', 'quiero matárme'],
    ['ideation, negated form written out', 'ya no quiero vivir'],
    ['ideation, plan', 'planee como hacerlo el fin de semana'],
    ['self-harm, present tense', 'me corto cuando me pongo mal'],
    ['self-harm, overdose', 'anoche tome muchas pastillas'],
    ['abuse, physical', 'mi novio me pega cuando toma'],
    ['abuse, coercion', 'me obliga a tener sexo aunque le diga que no'],
    ['psychosis', 'escucho voces que me hablan de noche'],
    ['panic in progress', 'no puedo respirar y siento que me muero'],
  ];

  it.each(cases)('%s', (_name, text) => {
    const verdict = scanText(text);
    expect(verdict.crisis).toBe(true);
    if (verdict.crisis) expect(verdict.severity).toBe('high');
  });

  it('caps the stored excerpt at 200 characters', () => {
    const padding = 'hablo de mi semana '.repeat(30);
    const verdict = scanText(`${padding} quiero morirme ${padding}`);
    expect(verdict.crisis).toBe(true);
    if (verdict.crisis) expect(verdict.excerpt.length).toBeLessThanOrEqual(200);
  });
});

describe('suppression — must not fire, and not vacuously', () => {
  /**
   * Each case carries a control: the same sentence with the suppressor
   * removed, which MUST fire. Without that pair a suppression test passes
   * whenever no term matched at all, which is how four of these read on the
   * first draft — Spanish reflexive morphology quietly separates most third
   * person narration ("matarse" is not "matarme"), so the tests looked green
   * while exercising nothing.
   */
  const pairs: [string, string, string][] = [
    ['negation', 'nunca quiero morirme, al contrario', 'quiero morirme'],
    ['a dream', 'sone que me corto el pelo y me desperte rara', 'me corto el pelo'],
    [
      'reported speech',
      'un paciente me dijo cito textual quiero morirme',
      'quiero morirme',
    ],
    [
      'someone else is the subject',
      'mi hermana quiere cortarme el pelo el sabado',
      'quiero cortarme',
    ],
    ['distant past', 'cuando era chica me corto el flequillo sola', 'me corto el flequillo'],
  ];

  it.each(pairs)('%s is suppressed', (_name, suppressed) => {
    expect(scanText(suppressed).crisis).toBe(false);
  });

  it.each(pairs)('%s — control fires without the suppressor', (_name, _suppressed, control) => {
    expect(scanText(control).crisis, `control "${control}" never matched`).toBe(true);
  });
});

describe('must not fire — and not because of suppression', () => {
  /**
   * These stay silent because the term list is written to be specific, not
   * because a suppressor caught them. Recorded separately so nobody later
   * "fixes" the list by adding a bare noun or a bare verb phrase.
   */
  const cases: [string, string][] = [
    [
      'the PDR stalking example — a bare "me sigue" would fire here',
      'me incomoda que mi terapeuta me sigue en instagram',
    ],
    ['bereavement — a bare "suicidio" would fire here', 'estoy procesando el suicidio de mi hermano'],
    ['third party — a bare "sobredosis" would fire here', 'mi primo tuvo una sobredosis el ano pasado'],
    ['a friend in trouble', 'mi amigo quiere matarse y no se como ayudarlo'],
    ['fiction', 'en la pelicula el protagonista quiere matarse al final'],
    ['ordinary weariness, one marker only', 'ya no aguanto este trabajo'],
    ['ordinary tiredness', 'estoy cansado pero es por la mudanza'],
    ['no free text at all', ''],
    ['unrelated', 'quiero entender por que me cuesta tanto poner limites'],
  ];

  it.each(cases)('%s', (_name, text) => {
    expect(scanText(text).crisis).toBe(false);
  });
});

describe('abuse disclosures must survive the person reference', () => {
  /**
   * Abuse is reported as "mi <person> me <verb>". If a person reference
   * suppressed those, the abuse category would be silenced almost entirely —
   * the suppressor would be doing the exact opposite of its job.
   */
  const cases: [string, string][] = [
    ['an ex who follows her', 'mi ex me persigue hasta el trabajo'],
    ['a neighbour waiting outside', 'mi vecino me espera afuera de mi casa'],
    ['a partner who hits her', 'mi pareja me pega cuando toma'],
    ['a boss who harasses her', 'mi jefe me acosa y no se a quien decirle'],
  ];

  it.each(cases)('%s', (_name, text) => {
    const verdict = scanText(text);
    expect(verdict.crisis, `"${text}" was silently dropped`).toBe(true);
    if (verdict.crisis) {
      expect(verdict.severity).toBe('high');
      expect(verdict.category).toBe('abuso');
    }
  });
});

describe('low severity — indirect markers', () => {
  it('needs two distinct markers, not one', () => {
    expect(scanText('ya no aguanto').crisis).toBe(false);
  });

  it('fires on two distinct markers in the same text', () => {
    const verdict = scanText('ya no aguanto mas, siento que nada tiene sentido');
    expect(verdict.crisis).toBe(true);
    if (verdict.crisis) {
      expect(verdict.severity).toBe('low');
      expect(verdict.category).toBe('indirecto');
      expect(verdict.matched.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('does not accumulate markers across separate texts', () => {
    // PDR 6.4 step 4. Two screens each carrying one marker is not a signal;
    // treating it as one would slowly lock out anyone having a hard month.
    const verdict = detectCrisis({
      texts: ['ya no aguanto', 'no le veo futuro'],
    });
    expect(verdict.crisis).toBe(false);
  });

  it('does not count the same marker twice', () => {
    expect(scanText('no doy mas, de verdad no doy mas').crisis).toBe(false);
  });
});

describe('the clinical answer', () => {
  it('raises high severity on plan or intent, with no text at all', () => {
    const verdict = detectCrisis({ clinicalBasics: { ideation_6m: 'plan_o_intencion' } });
    expect(verdict.crisis).toBe(true);
    if (verdict.crisis) {
      expect(verdict.severity).toBe('high');
      expect(verdict.from_clinical_answer).toBe(true);
      // The excerpt stays empty: there is no text to quote, and inventing one
      // would put words in the person's mouth in an admin review queue.
      expect(verdict.excerpt).toBe('');
    }
  });

  it('does not raise crisis on fleeting thoughts without a plan', () => {
    expect(detectCrisis({ clinicalBasics: { ideation_6m: 'fugaces_sin_plan' } }).crisis).toBe(
      false,
    );
  });

  it('outranks a text scan so the explicit answer is what gets recorded', () => {
    const verdict = detectCrisis({
      texts: ['ya no aguanto mas y nada tiene sentido'],
      clinicalBasics: { ideation_6m: 'plan_o_intencion' },
    });
    expect(verdict.crisis && verdict.from_clinical_answer).toBe(true);
  });
});

describe('severity ordering across surfaces', () => {
  it('returns high even when a low-severity text was seen first', () => {
    const verdict = detectCrisis({
      texts: ['ya no aguanto mas, nada tiene sentido', 'quiero morirme'],
    });
    expect(verdict.crisis).toBe(true);
    if (verdict.crisis) expect(verdict.severity).toBe('high');
  });
});

describe('clinical vulnerability — PDR 7.2', () => {
  it('counts frequent ideation even though it is not a crisis', () => {
    expect(isClinicallyVulnerable({ clinicalBasics: { ideation_6m: 'frecuentes' } })).toBe(true);
    expect(detectCrisis({ clinicalBasics: { ideation_6m: 'frecuentes' } }).crisis).toBe(false);
  });

  it('counts active psychiatric medication', () => {
    expect(isClinicallyVulnerable({ clinicalBasics: { psychiatric_medication: true } })).toBe(true);
  });

  it('counts a crisis event in the last 30 days', () => {
    expect(isClinicallyVulnerable({ recentCrisisWithin30Days: true })).toBe(true);
  });

  it('is false for someone with none of those', () => {
    expect(isClinicallyVulnerable({ clinicalBasics: { ideation_6m: 'no' } })).toBe(false);
  });
});

describe('derived risk level for chat context', () => {
  it('maps plan or intent to high', () => {
    expect(riskLevel({ clinicalBasics: { ideation_6m: 'plan_o_intencion' } })).toBe('high');
  });

  it('maps fleeting thoughts to elevated', () => {
    expect(riskLevel({ clinicalBasics: { ideation_6m: 'fugaces_sin_plan' } })).toBe('elevated');
  });

  it('maps nothing to none', () => {
    expect(riskLevel({ clinicalBasics: { ideation_6m: 'no' } })).toBe('none');
  });
});

describe('admin notification deduplication — PDR 6.4 step 5', () => {
  it('notifies the first time', () => {
    expect(shouldNotifyAdmin(null, 1_000)).toBe(true);
  });

  it('stays quiet inside the six-hour window', () => {
    expect(shouldNotifyAdmin(1_000, 1_000 + CRISIS_NOTIFICATION_WINDOW_MS - 1)).toBe(false);
  });

  it('notifies again once the window has passed', () => {
    expect(shouldNotifyAdmin(1_000, 1_000 + CRISIS_NOTIFICATION_WINDOW_MS)).toBe(true);
  });
});
