import { describe, expect, it } from 'vitest';
import {
  BREAK_MAX_MS,
  RATE_DEFAULT,
  estimateDurationMs,
  parseSsml,
  transcriptOf,
  validateMeditation,
} from './ssml';

/**
 * The round trip that matters: a pause written into the script has to come out
 * the other side as a pause of the same length. In a guided meditation the
 * silences are the practice, and losing them would leave a recording that
 * reads correctly and does nothing.
 */

const SCRIPT = `
<speak>
  <prosody rate="82%">
    Sentate como estés. <break time="3s"/>
    Notá dónde apoya tu espalda.
    <break time="2500ms"/>
    <prosody rate="78%">Y soltá el aire despacio.</prosody>
    Volvemos.
  </prosody>
</speak>
`;

describe('breaks survive the round trip', () => {
  const segments = parseSsml(SCRIPT);

  it('keeps them in order, between the right sentences', () => {
    expect(segments.map((s) => s.kind)).toEqual([
      'speak',
      'pause',
      'speak',
      'pause',
      'speak',
      'speak',
    ]);
  });

  it('converts seconds and milliseconds to the same unit', () => {
    const pauses = segments.filter((s) => s.kind === 'pause');
    expect(pauses).toEqual([
      { kind: 'pause', ms: 3000 },
      { kind: 'pause', ms: 2500 },
    ]);
  });
});

describe('prosody survives the round trip', () => {
  const segments = parseSsml(SCRIPT);

  it('applies the declared rate', () => {
    expect(segments[0]).toEqual({ kind: 'speak', text: 'Sentate como estés.', rate: 0.82 });
  });

  it('nests, and returns to the outer rate rather than to the default', () => {
    const speak = segments.filter((s) => s.kind === 'speak');
    expect(speak[2]?.rate).toBe(0.78);
    // The regression this guards: popping to RATE_DEFAULT would silently speed
    // the rest of a deliberately slow script back up.
    expect(speak[3]?.rate).toBe(0.82);
  });

  it('falls back to the default when no rate is declared', () => {
    expect(parseSsml('<speak>Hola.</speak>')[0]).toMatchObject({ rate: RATE_DEFAULT });
  });
});

describe('the text itself', () => {
  it('collapses the whitespace the markup leaves behind', () => {
    expect(transcriptOf(parseSsml(SCRIPT))).not.toMatch(/\s{2,}/);
  });

  it('carries every spoken word into the transcript', () => {
    const transcript = transcriptOf(parseSsml(SCRIPT));
    expect(transcript).toContain('Sentate como estés.');
    expect(transcript).toContain('Y soltá el aire despacio.');
    expect(transcript).toContain('Volvemos.');
  });

  it('decodes entities so nothing is read aloud as "&amp;"', () => {
    expect(transcriptOf(parseSsml('<speak>Vos &amp; tu respiración</speak>'))).toBe(
      'Vos & tu respiración',
    );
  });

  it('drops tags it has no use for without eating their contents', () => {
    expect(transcriptOf(parseSsml('<speak><p><emphasis>Acá</emphasis> estás.</p></speak>'))).toBe(
      'Acá estás.',
    );
  });
});

describe('malformed input degrades rather than breaking', () => {
  it('survives a stray closing tag with the script intact', () => {
    const segments = parseSsml('<speak>Uno. </prosody>Dos.</speak>');
    expect(transcriptOf(segments)).toBe('Uno. Dos.');
  });

  it('returns nothing to say, rather than throwing, on empty input', () => {
    expect(parseSsml('')).toEqual([]);
  });
});

describe('the duration estimate', () => {
  it('counts the silences, which are most of a meditation', () => {
    const withPause = estimateDurationMs([
      { kind: 'speak', text: 'una dos tres', rate: 0.82 },
      { kind: 'pause', ms: 4000 },
    ]);
    const withoutPause = estimateDurationMs([{ kind: 'speak', text: 'una dos tres', rate: 0.82 }]);
    expect(withPause - withoutPause).toBe(4000);
  });

  it('takes longer at a slower rate', () => {
    const slow = estimateDurationMs([{ kind: 'speak', text: 'una dos tres', rate: 0.78 }]);
    const fast = estimateDurationMs([{ kind: 'speak', text: 'una dos tres', rate: 0.88 }]);
    expect(slow).toBeGreaterThan(fast);
  });
});

describe('the generation rules of PDR 9.4', () => {
  it('accepts a script inside the band', () => {
    expect(validateMeditation(parseSsml(SCRIPT))).toEqual([]);
  });

  it('rejects speech faster than the band allows', () => {
    const problems = validateMeditation(parseSsml('<speak><prosody rate="100%">Ya.</prosody></speak>'));
    expect(problems.map((p) => p.kind)).toContain('rate');
  });

  it('rejects a silence long enough to read as a stall', () => {
    const problems = validateMeditation(parseSsml(`<speak>Hola.<break time="${BREAK_MAX_MS + 1000}ms"/></speak>`));
    expect(problems.map((p) => p.kind)).toContain('break');
  });

  it('rejects a script with nothing to say', () => {
    expect(validateMeditation(parseSsml('<speak><break time="3s"/></speak>')).map((p) => p.kind)).toContain(
      'empty',
    );
  });
});
