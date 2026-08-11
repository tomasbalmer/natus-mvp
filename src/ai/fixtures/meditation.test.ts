import { describe, expect, it } from 'vitest';
import { buildMeditationFixture, estimatedMinutes, selectCore } from './meditation';
import { parseSsml, transcriptOf, validateMeditation } from '@/audio/ssml';
import { meditationScriptSchema } from '@/lib/schemas';
import { lintDeep } from '@/lib/copy-lint';
import { BED_TRACKS } from '@/lib/catalog';

const LENGTHS = [5, 10, 20];

const INTENTS = [
  'no puedo parar de pensar y quiero bajar un cambio',
  'quiero dormir sin dar vueltas toda la noche',
  'me quedó bronca de una discusión de ayer',
  'tengo que decidir si me mudo y no se que hacer',
  'nada en particular, quiero estar un rato conmigo',
];

const CASES = INTENTS.flatMap((intent) => LENGTHS.map((minutes) => [intent, minutes] as const));

describe('every generated script satisfies the contract', () => {
  it.each(CASES)('"%s" at %i minutes parses against the schema', (intent, minutes) => {
    expect(() => meditationScriptSchema.parse(buildMeditationFixture({ intent, minutes }))).not.toThrow();
  });

  it.each(CASES)('"%s" at %i minutes passes the copy lint', (intent, minutes) => {
    expect(lintDeep(buildMeditationFixture({ intent, minutes }))).toEqual([]);
  });

  it.each(CASES)('"%s" at %i minutes stays inside the PDR 9.4 band', (intent, minutes) => {
    const script = buildMeditationFixture({ intent, minutes });
    expect(validateMeditation(parseSsml(script.script_ssml))).toEqual([]);
  });

  it.each(CASES)('"%s" at %i minutes names a bed that exists', (intent, minutes) => {
    const script = buildMeditationFixture({ intent, minutes });
    expect(BED_TRACKS.map((b) => b.id)).toContain(script.bed_track_id);
  });
});

describe('the transcript cannot disagree with the audio', () => {
  it.each(CASES)('"%s" at %i minutes matches the spoken script exactly', (intent, minutes) => {
    const script = buildMeditationFixture({ intent, minutes });
    // The screen shows this text beside the audio. If the two were written
    // separately, one of them would eventually be wrong and nobody would
    // notice which.
    expect(script.script_text).toBe(transcriptOf(parseSsml(script.script_ssml)));
  });

  it('carries no markup into the text', () => {
    expect(buildMeditationFixture({ intent: 'calma', minutes: 5 }).script_text).not.toMatch(/[<>]/);
  });
});

describe('the four parts of PDR 9.4', () => {
  const script = buildMeditationFixture({ intent: INTENTS[0]!, minutes: 10 });
  const text = script.script_text;

  it('arrives before it deepens', () => {
    expect(text.indexOf('peso de tu cuerpo')).toBeLessThan(text.indexOf('planta de los pies'));
  });

  it('works the intention after the body, not before it', () => {
    expect(text.indexOf('planta de los pies')).toBeLessThan(text.indexOf('venís sosteniendo'));
  });

  it('ends outside the imagery, back in the room', () => {
    // A script that ends inside the image leaves someone standing up from a
    // floor they were told they were lying on.
    expect(text.trimEnd()).toMatch(/abrí los ojos.*$/s);
  });
});

describe('the requested length shapes the script', () => {
  it.each(CASES)('"%s" at %i minutes lands within a minute of what was asked', (intent, minutes) => {
    // Monotonic growth was the first version of this test and it passed while
    // a twenty-minute request produced eight minutes of audio. The screen
    // reports the real figure either way, but "20 min" that runs 8 is a small
    // lie that costs a demo its credit.
    expect(estimatedMinutes(buildMeditationFixture({ intent, minutes }))).toBeCloseTo(minutes, -0.5);
  });

  it('gets there with silence rather than with more talking', () => {
    const short = buildMeditationFixture({ intent: INTENTS[0]!, minutes: 5 });
    const long = buildMeditationFixture({ intent: INTENTS[0]!, minutes: 20 });

    const words = (script: typeof short) => script.script_text.split(/\s+/).length;
    const silence = (script: typeof short) =>
      parseSsml(script.script_ssml)
        .filter((s) => s.kind === 'pause')
        .reduce((total, pause) => total + (pause.kind === 'pause' ? pause.ms : 0), 0);

    // Four times the length, nowhere near four times the words: a talkative
    // twenty minutes is worse than a quiet eight.
    expect(words(long)).toBeLessThan(words(short) * 3);
    expect(silence(long)).toBeGreaterThan(silence(short) * 4);
  });

  it('never leaves a single silence longer than two minutes', () => {
    for (const minutes of LENGTHS) {
      const segments = parseSsml(buildMeditationFixture({ intent: INTENTS[0]!, minutes }).script_ssml);
      let run = 0;
      for (const segment of segments) {
        run = segment.kind === 'pause' ? run + segment.ms : 0;
        expect(run).toBeLessThanOrEqual(120_000);
      }
    }
  });
});

describe('the intention chooses the core', () => {
  it.each([
    ['quiero dormir de una vez', 'dormir'],
    ['estoy re ansiosa', 'calma'],
    ['me quedó bronca', 'enojo'],
    ['no se si aceptar el trabajo, tengo que decidir', 'claridad'],
    ['nada, solo estar un rato', 'presencia'],
  ])('"%s" -> %s', (intent, key) => {
    expect(selectCore(intent).key).toBe(key);
  });

  it('is deterministic', () => {
    expect(buildMeditationFixture({ intent: INTENTS[2]!, minutes: 10 })).toEqual(
      buildMeditationFixture({ intent: INTENTS[2]!, minutes: 10 }),
    );
  });
});
